//! Commish on Pinocchio: the same six instructions as the Anchor program,
//! the same account seeds, the same error codes (6000+), the same event
//! encoding, plus `sell_commission` for early payout.

use pinocchio::{
    cpi::{invoke_signed, Seed, Signer},
    entrypoint,
    error::ProgramError,
    instruction::{InstructionAccount, InstructionView},
    sysvars::{clock::Clock, Sysvar},
    AccountView, Address, ProgramResult,
};
use pinocchio_system::instructions::CreateAccount;

entrypoint!(process_instruction);

pub const ID: Address = Address::from_str_const("F5ZfVzJ9i9bdu18sS3SHjitbvErKrS6XdBYU52Kc8ijW");
const TOKEN: Address = Address::from_str_const("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022: Address = Address::from_str_const("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ATA_PROGRAM: Address =
    Address::from_str_const("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

pub const MAX_COMMISSION_BPS: u16 = 5_000;
pub const MAX_HOLD_SECONDS: i64 = 90 * 24 * 60 * 60;

// Account tags (first byte of every account this program owns).
const TAG_CAMPAIGN: u8 = 1;
const TAG_AFFILIATE: u8 = 2;
const TAG_COMMISSION: u8 = 3;

// Campaign: tag | brand | attestor | mint | id | bps | hold | reserved | paid | bump
mod campaign {
    pub const BRAND: usize = 1;
    pub const ATTESTOR: usize = 33;
    pub const MINT: usize = 65;
    pub const ID: usize = 97;
    pub const BPS: usize = 105;
    pub const HOLD: usize = 107;
    pub const RESERVED: usize = 115;
    pub const PAID: usize = 123;
    pub const BUMP: usize = 131;
    pub const LEN: usize = 132;
}

// Affiliate: tag | campaign | wallet | pending | earned | bump
mod affiliate {
    pub const CAMPAIGN: usize = 1;
    pub const WALLET: usize = 33;
    pub const PENDING: usize = 65;
    pub const EARNED: usize = 73;
    pub const BUMP: usize = 81;
    pub const LEN: usize = 82;
}

// Commission: tag | campaign | affiliate | payee | order_hash | order_amount
//             | amount | release_at | status | bump
mod commission {
    pub const CAMPAIGN: usize = 1;
    pub const AFFILIATE: usize = 33;
    pub const PAYEE: usize = 65;
    pub const ORDER_HASH: usize = 97;
    pub const ORDER_AMOUNT: usize = 129;
    pub const AMOUNT: usize = 137;
    pub const RELEASE_AT: usize = 145;
    pub const STATUS: usize = 153;
    pub const BUMP: usize = 154;
    pub const LEN: usize = 155;
}

const PENDING: u8 = 0;
const PAID: u8 = 1;
const CANCELLED: u8 = 2;

// Same order and numbering as the Anchor `CommishError` enum.
#[derive(Clone, Copy)]
pub enum CommishError {
    InvalidCommission = 6000,
    InvalidHold,
    WrongAttestor,
    WrongBrand,
    WrongAffiliate,
    ZeroCommission,
    InsufficientBudget,
    NotPending,
    StillHeld,
    MathOverflow,
    WrongAccount,
    NotSeller,
}

impl From<CommishError> for ProgramError {
    fn from(e: CommishError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

type R<T> = Result<T, ProgramError>;

fn fail<T>(e: CommishError) -> R<T> {
    Err(e.into())
}

fn rd64(d: &[u8], o: usize) -> u64 {
    u64::from_le_bytes(d[o..o + 8].try_into().unwrap())
}

fn wr64(d: &mut [u8], o: usize, v: u64) {
    d[o..o + 8].copy_from_slice(&v.to_le_bytes());
}

fn key(d: &[u8], o: usize) -> [u8; 32] {
    d[o..o + 32].try_into().unwrap()
}

fn add(a: u64, b: u64) -> R<u64> {
    a.checked_add(b).ok_or(CommishError::MathOverflow.into())
}

fn sub(a: u64, b: u64) -> R<u64> {
    a.checked_sub(b).ok_or(CommishError::MathOverflow.into())
}

fn signer(a: &AccountView) -> ProgramResult {
    if a.is_signer() {
        Ok(())
    } else {
        Err(ProgramError::MissingRequiredSignature)
    }
}

/// An account this program created, with the expected tag and size.
fn owned(a: &AccountView, tag: u8, len: usize) -> ProgramResult {
    if !a.owned_by(&ID) || a.data_len() != len || a.try_borrow()?[0] != tag {
        return fail(CommishError::WrongAccount);
    }
    Ok(())
}

fn token_program(a: &AccountView) -> ProgramResult {
    if a.address() != &TOKEN && a.address() != &TOKEN_2022 {
        return Err(ProgramError::IncorrectProgramId);
    }
    Ok(())
}

fn ata_address(wallet: &Address, token_program: &Address, mint: &Address) -> Address {
    Address::find_program_address(
        &[wallet.as_ref(), token_program.as_ref(), mint.as_ref()],
        &ATA_PROGRAM,
    )
    .0
}

/// The campaign's vault: the canonical ATA of (campaign, mint).
fn vault_amount(vault: &AccountView, campaign: &AccountView, mint: &Address, tp: &Address) -> R<u64> {
    if vault.address() != &ata_address(campaign.address(), tp, mint) || !vault.owned_by(tp) {
        return fail(CommishError::WrongAccount);
    }
    Ok(rd64(&vault.try_borrow()?, 64))
}

fn mint_decimals(mint: &AccountView, tp: &Address) -> R<u8> {
    if !mint.owned_by(tp) {
        return fail(CommishError::WrongAccount);
    }
    Ok(mint.try_borrow()?[44])
}

fn create_pda(
    payer: &AccountView,
    target: &AccountView,
    space: usize,
    seeds: &[&[u8]],
    bump: u8,
) -> ProgramResult {
    let bump = [bump];
    let mut s: [Seed; 4] = core::array::from_fn(|_| Seed::from(&[] as &[u8]));
    for (i, seed) in seeds.iter().enumerate() {
        s[i] = Seed::from(*seed);
    }
    s[seeds.len()] = Seed::from(&bump);
    let signer = Signer::from(&s[..=seeds.len()]);
    CreateAccount::with_minimum_balance(payer, target, space as u64, &ID, None)?
        .invoke_signed(&[signer])
}

fn create_ata(
    payer: &AccountView,
    ata: &AccountView,
    wallet: &AccountView,
    mint: &AccountView,
    system: &AccountView,
    tp: &AccountView,
    idempotent: bool,
) -> ProgramResult {
    if ata.address() != &ata_address(wallet.address(), tp.address(), mint.address()) {
        return fail(CommishError::WrongAccount);
    }
    let data = [idempotent as u8];
    let metas = [
        InstructionAccount::writable_signer(payer.address()),
        InstructionAccount::writable(ata.address()),
        InstructionAccount::readonly(wallet.address()),
        InstructionAccount::readonly(mint.address()),
        InstructionAccount::readonly(system.address()),
        InstructionAccount::readonly(tp.address()),
    ];
    let ix = InstructionView { program_id: &ATA_PROGRAM, data: &data, accounts: &metas };
    invoke_signed(&ix, &[payer, ata, wallet, mint, system, tp], &[])
}

#[allow(clippy::too_many_arguments)]
fn transfer_checked(
    tp: &AccountView,
    from: &AccountView,
    mint: &AccountView,
    to: &AccountView,
    authority: &AccountView,
    amount: u64,
    decimals: u8,
    signers: &[Signer],
) -> ProgramResult {
    let mut data = [0u8; 10];
    data[0] = 12;
    data[1..9].copy_from_slice(&amount.to_le_bytes());
    data[9] = decimals;
    let metas = [
        InstructionAccount::writable(from.address()),
        InstructionAccount::readonly(mint.address()),
        InstructionAccount::writable(to.address()),
        InstructionAccount::readonly_signer(authority.address()),
    ];
    let ix = InstructionView { program_id: tp.address(), data: &data, accounts: &metas };
    invoke_signed(&ix, &[from, mint, to, authority], signers)
}

/// Anchor-compatible event: "Program data: <8-byte discriminator || fields>".
fn emit(disc: [u8; 8], campaign: &[u8], affiliate: &[u8], order_hash: &[u8], amount: u64) {
    let mut buf = [0u8; 8 + 32 + 32 + 32 + 8];
    buf[..8].copy_from_slice(&disc);
    buf[8..40].copy_from_slice(campaign);
    buf[40..72].copy_from_slice(affiliate);
    buf[72..104].copy_from_slice(order_hash);
    buf[104..].copy_from_slice(&amount.to_le_bytes());
    #[cfg(target_os = "solana")]
    unsafe {
        let parts: [&[u8]; 1] = [&buf];
        pinocchio::syscalls::sol_log_data(parts.as_ptr() as *const u8, 1);
    }
    #[cfg(not(target_os = "solana"))]
    let _ = buf;
}

const EV_SALE_RECORDED: [u8; 8] = [142, 88, 165, 117, 120, 73, 169, 110];
const EV_COMMISSION_PAID: [u8; 8] = [114, 253, 151, 65, 215, 46, 30, 247];
const EV_COMMISSION_SOLD: [u8; 8] = [163, 30, 158, 13, 165, 26, 165, 160];

pub fn process_instruction(
    program_id: &Address,
    accounts: &mut [AccountView],
    data: &[u8],
) -> ProgramResult {
    if program_id != &ID {
        return Err(ProgramError::IncorrectProgramId);
    }
    let (tag, args) = data.split_first().ok_or(ProgramError::InvalidInstructionData)?;
    match tag {
        0 => create_campaign(accounts, args),
        1 => join_campaign(accounts),
        2 => record_sale(accounts, args),
        3 => cancel_commission(accounts),
        4 => release(accounts),
        5 => withdraw(accounts, args),
        6 => sell_commission(accounts, args),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

fn args<const N: usize>(a: &[u8]) -> R<&[u8; N]> {
    a.try_into().map_err(|_| ProgramError::InvalidInstructionData)
}

/// 0. brand(s,w) mint campaign(w) vault(w) token_program ata_program system
/// data: id u64 | commission_bps u16 | hold_seconds i64 | attestor [32]
fn create_campaign(accounts: &mut [AccountView], a: &[u8]) -> ProgramResult {
    let [brand, mint, camp, vault, tp, _ata, system, ..] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    let a = args::<50>(a)?;
    let id = &a[0..8];
    let bps = u16::from_le_bytes([a[8], a[9]]);
    let hold = i64::from_le_bytes(a[10..18].try_into().unwrap());
    signer(brand)?;
    token_program(tp)?;
    mint_decimals(mint, tp.address())?;
    if bps == 0 || bps > MAX_COMMISSION_BPS {
        return fail(CommishError::InvalidCommission);
    }
    if !(0..=MAX_HOLD_SECONDS).contains(&hold) {
        return fail(CommishError::InvalidHold);
    }
    let seeds: [&[u8]; 3] = [b"campaign", brand.address().as_ref(), id];
    let (pda, bump) = Address::find_program_address(&seeds, &ID);
    if camp.address() != &pda {
        return fail(CommishError::WrongAccount);
    }
    create_pda(brand, camp, campaign::LEN, &seeds, bump)?;
    {
        let mut d = camp.try_borrow_mut()?;
        d[0] = TAG_CAMPAIGN;
        d[campaign::BRAND..campaign::BRAND + 32].copy_from_slice(brand.address().as_ref());
        d[campaign::ATTESTOR..campaign::ATTESTOR + 32].copy_from_slice(&a[18..50]);
        d[campaign::MINT..campaign::MINT + 32].copy_from_slice(mint.address().as_ref());
        d[campaign::ID..campaign::ID + 8].copy_from_slice(id);
        d[campaign::BPS..campaign::BPS + 2].copy_from_slice(&bps.to_le_bytes());
        d[campaign::HOLD..campaign::HOLD + 8].copy_from_slice(&hold.to_le_bytes());
        d[campaign::BUMP] = bump;
    }
    create_ata(brand, vault, camp, mint, system, tp, false)
}

/// 1. wallet(s,w) campaign affiliate(w) system
fn join_campaign(accounts: &mut [AccountView]) -> ProgramResult {
    let [wallet, camp, aff, _system, ..] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    signer(wallet)?;
    owned(camp, TAG_CAMPAIGN, campaign::LEN)?;
    let seeds: [&[u8]; 3] = [b"affiliate", camp.address().as_ref(), wallet.address().as_ref()];
    let (pda, bump) = Address::find_program_address(&seeds, &ID);
    if aff.address() != &pda {
        return fail(CommishError::WrongAccount);
    }
    create_pda(wallet, aff, affiliate::LEN, &seeds, bump)?;
    let mut d = aff.try_borrow_mut()?;
    d[0] = TAG_AFFILIATE;
    d[affiliate::CAMPAIGN..affiliate::CAMPAIGN + 32].copy_from_slice(camp.address().as_ref());
    d[affiliate::WALLET..affiliate::WALLET + 32].copy_from_slice(wallet.address().as_ref());
    d[affiliate::BUMP] = bump;
    Ok(())
}

/// 2. attestor(s,w) campaign(w) vault affiliate(w) commission(w) token_program system
/// data: order_hash [32] | order_amount u64
fn record_sale(accounts: &mut [AccountView], a: &[u8]) -> ProgramResult {
    let [attestor, camp, vault, aff, com, tp, _system, ..] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    let a = args::<40>(a)?;
    let order_hash = &a[0..32];
    let order_amount = rd64(a, 32);
    signer(attestor)?;
    token_program(tp)?;
    owned(camp, TAG_CAMPAIGN, campaign::LEN)?;
    owned(aff, TAG_AFFILIATE, affiliate::LEN)?;

    let (bps, hold, reserved, mint) = {
        let c = camp.try_borrow()?;
        if key(&c, campaign::ATTESTOR) != *attestor.address().as_array() {
            return fail(CommishError::WrongAttestor);
        }
        (
            u16::from_le_bytes([c[campaign::BPS], c[campaign::BPS + 1]]),
            rd64(&c, campaign::HOLD) as i64,
            rd64(&c, campaign::RESERVED),
            Address::new_from_array(key(&c, campaign::MINT)),
        )
    };
    let wallet = {
        let d = aff.try_borrow()?;
        if key(&d, affiliate::CAMPAIGN) != *camp.address().as_array() {
            return fail(CommishError::WrongAccount);
        }
        key(&d, affiliate::WALLET)
    };

    let amount = u64::try_from(order_amount as u128 * bps as u128 / 10_000)
        .map_err(|_| ProgramError::from(CommishError::MathOverflow))?;
    if amount == 0 {
        return fail(CommishError::ZeroCommission);
    }
    let free = sub(vault_amount(vault, camp, &mint, tp.address())?, reserved)?;
    if free < amount {
        return fail(CommishError::InsufficientBudget);
    }

    // One account per order: the same order can never be paid twice.
    let seeds: [&[u8]; 3] = [b"commission", camp.address().as_ref(), order_hash];
    let (pda, bump) = Address::find_program_address(&seeds, &ID);
    if com.address() != &pda {
        return fail(CommishError::WrongAccount);
    }
    create_pda(attestor, com, commission::LEN, &seeds, bump)?;

    {
        let mut c = camp.try_borrow_mut()?;
        wr64(&mut c, campaign::RESERVED, add(reserved, amount)?);
    }
    {
        let mut d = aff.try_borrow_mut()?;
        let pending = add(rd64(&d, affiliate::PENDING), amount)?;
        wr64(&mut d, affiliate::PENDING, pending);
    }
    let release_at = Clock::get()?
        .unix_timestamp
        .checked_add(hold)
        .ok_or(ProgramError::from(CommishError::MathOverflow))?;
    {
        let mut d = com.try_borrow_mut()?;
        d[0] = TAG_COMMISSION;
        d[commission::CAMPAIGN..commission::CAMPAIGN + 32].copy_from_slice(camp.address().as_ref());
        d[commission::AFFILIATE..commission::AFFILIATE + 32].copy_from_slice(&wallet);
        d[commission::PAYEE..commission::PAYEE + 32].copy_from_slice(&wallet);
        d[commission::ORDER_HASH..commission::ORDER_HASH + 32].copy_from_slice(order_hash);
        wr64(&mut d, commission::ORDER_AMOUNT, order_amount);
        wr64(&mut d, commission::AMOUNT, amount);
        wr64(&mut d, commission::RELEASE_AT, release_at as u64);
        d[commission::STATUS] = PENDING;
        d[commission::BUMP] = bump;
    }
    emit(EV_SALE_RECORDED, camp.address().as_ref(), &wallet, order_hash, amount);
    Ok(())
}

/// Loads a pending commission of `camp` and the affiliate it belongs to.
/// Returns (amount, release_at, payee, order_hash).
fn load_pending(
    camp: &AccountView,
    com: &AccountView,
    aff: &AccountView,
) -> R<(u64, i64, [u8; 32], [u8; 32])> {
    owned(camp, TAG_CAMPAIGN, campaign::LEN)?;
    owned(com, TAG_COMMISSION, commission::LEN)?;
    owned(aff, TAG_AFFILIATE, affiliate::LEN)?;
    let d = com.try_borrow()?;
    if key(&d, commission::CAMPAIGN) != *camp.address().as_array() {
        return fail(CommishError::WrongAccount);
    }
    {
        let a = aff.try_borrow()?;
        if key(&a, affiliate::CAMPAIGN) != *camp.address().as_array()
            || key(&a, affiliate::WALLET) != key(&d, commission::AFFILIATE)
        {
            return fail(CommishError::WrongAccount);
        }
    }
    if d[commission::STATUS] != PENDING {
        return fail(CommishError::NotPending);
    }
    Ok((
        rd64(&d, commission::AMOUNT),
        rd64(&d, commission::RELEASE_AT) as i64,
        key(&d, commission::PAYEE),
        key(&d, commission::ORDER_HASH),
    ))
}

/// 3. attestor(s) campaign(w) commission(w) affiliate(w)
fn cancel_commission(accounts: &mut [AccountView]) -> ProgramResult {
    let [attestor, camp, com, aff, ..] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    signer(attestor)?;
    owned(camp, TAG_CAMPAIGN, campaign::LEN)?;
    if key(&camp.try_borrow()?, campaign::ATTESTOR) != *attestor.address().as_array() {
        return fail(CommishError::WrongAttestor);
    }
    let (amount, ..) = load_pending(camp, com, aff)?;
    {
        let mut c = camp.try_borrow_mut()?;
        let reserved = sub(rd64(&c, campaign::RESERVED), amount)?;
        wr64(&mut c, campaign::RESERVED, reserved);
    }
    {
        let mut d = aff.try_borrow_mut()?;
        let pending = sub(rd64(&d, affiliate::PENDING), amount)?;
        wr64(&mut d, affiliate::PENDING, pending);
    }
    com.try_borrow_mut()?[commission::STATUS] = CANCELLED;
    Ok(())
}

fn campaign_signer_parts(camp: &AccountView) -> R<([u8; 32], [u8; 8], [u8; 1], Address)> {
    let c = camp.try_borrow()?;
    Ok((
        key(&c, campaign::BRAND),
        c[campaign::ID..campaign::ID + 8].try_into().unwrap(),
        [c[campaign::BUMP]],
        Address::new_from_array(key(&c, campaign::MINT)),
    ))
}

/// 4. Permissionless: anyone may crank a payout once the hold has passed.
/// cranker(s,w) campaign(w) mint vault(w) commission(w) affiliate(w)
/// payee_wallet payee_ata(w) token_program ata_program system
fn release(accounts: &mut [AccountView]) -> ProgramResult {
    let [cranker, camp, mint, vault, com, aff, payee, payee_ata, tp, _ata, system, ..] = accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    signer(cranker)?;
    token_program(tp)?;
    let (amount, release_at, payee_key, order_hash) = load_pending(camp, com, aff)?;
    if Clock::get()?.unix_timestamp < release_at {
        return fail(CommishError::StillHeld);
    }
    if *payee.address().as_array() != payee_key {
        return fail(CommishError::WrongAffiliate);
    }
    let (brand, id, bump, mint_key) = campaign_signer_parts(camp)?;
    if mint.address() != &mint_key {
        return fail(CommishError::WrongAccount);
    }
    vault_amount(vault, camp, &mint_key, tp.address())?;
    let decimals = mint_decimals(mint, tp.address())?;

    create_ata(cranker, payee_ata, payee, mint, system, tp, true)?;
    let seeds = [Seed::from(b"campaign"), Seed::from(&brand), Seed::from(&id), Seed::from(&bump)];
    transfer_checked(tp, vault, mint, payee_ata, camp, amount, decimals, &[Signer::from(&seeds)])?;

    {
        let mut c = camp.try_borrow_mut()?;
        let reserved = sub(rd64(&c, campaign::RESERVED), amount)?;
        let paid = add(rd64(&c, campaign::PAID), amount)?;
        wr64(&mut c, campaign::RESERVED, reserved);
        wr64(&mut c, campaign::PAID, paid);
    }
    let wallet = {
        let mut d = aff.try_borrow_mut()?;
        let pending = sub(rd64(&d, affiliate::PENDING), amount)?;
        let earned = add(rd64(&d, affiliate::EARNED), amount)?;
        wr64(&mut d, affiliate::PENDING, pending);
        wr64(&mut d, affiliate::EARNED, earned);
        key(&d, affiliate::WALLET)
    };
    com.try_borrow_mut()?[commission::STATUS] = PAID;
    emit(EV_COMMISSION_PAID, camp.address().as_ref(), &wallet, &order_hash, amount);
    Ok(())
}

/// 5. The brand can take back only what is not owed to affiliates.
/// brand(s,w) campaign mint vault(w) brand_ata(w) token_program ata_program system
/// data: amount u64
fn withdraw(accounts: &mut [AccountView], a: &[u8]) -> ProgramResult {
    let [brand, camp, mint, vault, brand_ata, tp, _ata, system, ..] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    let amount = rd64(args::<8>(a)?, 0);
    signer(brand)?;
    token_program(tp)?;
    owned(camp, TAG_CAMPAIGN, campaign::LEN)?;
    let (brand_key, id, bump, mint_key) = campaign_signer_parts(camp)?;
    if *brand.address().as_array() != brand_key {
        return fail(CommishError::WrongBrand);
    }
    if mint.address() != &mint_key {
        return fail(CommishError::WrongAccount);
    }
    let reserved = rd64(&camp.try_borrow()?, campaign::RESERVED);
    let free = sub(vault_amount(vault, camp, &mint_key, tp.address())?, reserved)?;
    if amount == 0 || amount > free {
        return fail(CommishError::InsufficientBudget);
    }
    let decimals = mint_decimals(mint, tp.address())?;
    create_ata(brand, brand_ata, brand, mint, system, tp, true)?;
    let seeds = [Seed::from(b"campaign"), Seed::from(&brand_key), Seed::from(&id), Seed::from(&bump)];
    transfer_checked(tp, vault, mint, brand_ata, camp, amount, decimals, &[Signer::from(&seeds)])
}

/// 6. Early payout: the current payee sells a pending commission to a buyer
/// (a liquidity provider) for `price`, paid now. The buyer then receives the
/// payout at release, and carries the refund risk until then.
/// seller(s) buyer(s) campaign commission(w) affiliate mint buyer_ata(w) seller_ata(w) token_program
/// data: price u64
fn sell_commission(accounts: &mut [AccountView], a: &[u8]) -> ProgramResult {
    let [seller, buyer, camp, com, aff, mint, buyer_ata, seller_ata, tp, ..] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    let price = rd64(args::<8>(a)?, 0);
    signer(seller)?;
    signer(buyer)?;
    token_program(tp)?;
    let (amount, _, payee_key, order_hash) = load_pending(camp, com, aff)?;
    if *seller.address().as_array() != payee_key {
        return fail(CommishError::NotSeller);
    }
    if price == 0 || price > amount {
        return fail(CommishError::InsufficientBudget);
    }
    let mint_key = Address::new_from_array(key(&camp.try_borrow()?, campaign::MINT));
    if mint.address() != &mint_key || !seller_ata.owned_by(tp.address()) {
        return fail(CommishError::WrongAccount);
    }
    if key(&seller_ata.try_borrow()?, 32) != payee_key {
        return fail(CommishError::WrongAccount);
    }
    let decimals = mint_decimals(mint, tp.address())?;
    transfer_checked(tp, buyer_ata, mint, seller_ata, buyer, price, decimals, &[])?;
    com.try_borrow_mut()?[commission::PAYEE..commission::PAYEE + 32]
        .copy_from_slice(buyer.address().as_ref());
    emit(EV_COMMISSION_SOLD, camp.address().as_ref(), buyer.address().as_ref(), &order_hash, price);
    Ok(())
}
