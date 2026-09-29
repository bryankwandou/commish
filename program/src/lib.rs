//! Commish: affiliate commissions held on-chain through the refund window.
//!
//! A brand funds a USDC vault owned by its campaign. Every referred sale
//! reserves the creator's cut in its own account; the brand can only take
//! back what is not reserved. When the refund window closes, anyone can
//! release the payout to the current payee. Before that, the payee can sell
//! the pending commission to a buyer who pays now and collects at release.
//!
//! Written for binary size, since deploy rent is paid per byte: records are
//! read in place as `#[repr(C)]` structs (no copies, no bounds checks), all
//! CPIs share one helper, and the entrypoint is hand-rolled.
#![no_std]

use core::mem::{size_of, MaybeUninit};
use pinocchio::{
    cpi::{invoke_signed_unchecked, CpiAccount, Seed, Signer},
    instruction::{InstructionAccount, InstructionView},
    sysvars::{clock::Clock, Sysvar},
    AccountView, Address,
};

/// CmSHpw9QTwvRSNCCBrQz275ESTCw8D79Z8jjhWmPJfFB
pub const ID: Address = Address::new_from_array([
    174, 210, 181, 24, 191, 205, 137, 11, 191, 132, 171, 186, 79, 186, 118, 55, 49, 239, 193, 199, 14,
    171, 182, 232, 212, 134, 208, 99, 161, 93, 77, 86,
]);
/// TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
const TOKEN: Address = Address::new_from_array([
    6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172, 28, 180, 133, 237, 95,
    91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169,
]);
const SYSTEM: Address = Address::new_from_array([0; 32]);

pub const MAX_BPS: u16 = 5_000;
pub const MAX_HOLD: i64 = 90 * 24 * 60 * 60;

const TAG_CAMPAIGN: u8 = 1;
const TAG_COMMISSION: u8 = 2;
const VERSION: u8 = 1;
pub const FLAG_SOLD: u8 = 1;

type Key = [u8; 32];

/// PDA `["campaign", brand, id_le]`. 176 bytes.
#[repr(C)]
pub struct Campaign {
    pub tag: u8,
    pub version: u8,
    pub bump: u8,
    _pad: [u8; 5],
    pub brand: Key,
    pub attestor: Key,
    pub mint: Key,
    pub vault: Key,
    pub id: u64,
    pub hold: i64,
    pub reserved: u64,
    pub paid: u64,
    pub bps: u16,
    _pad2: u16,
    pub count: u32,
}

/// PDA `["commission", campaign, order_hash]`. 184 bytes. Closed, with its
/// rent returned to `rent_payer`, when paid or cancelled.
#[repr(C)]
pub struct Commission {
    pub tag: u8,
    pub version: u8,
    pub bump: u8,
    pub flags: u8,
    _pad: [u8; 4],
    pub campaign: Key,
    pub creator: Key,
    pub payee: Key,
    pub rent_payer: Key,
    pub order_hash: Key,
    pub amount: u64,
    pub release_at: i64,
}

/// The leading fields of an SPL token account (165 bytes on chain).
#[repr(C)]
struct TokenAccount {
    mint: Key,
    owner: Key,
    amount: u64,
    _delegate: [u8; 36],
    state: u8,
}

const CAMPAIGN_LEN: usize = size_of::<Campaign>();
const COMMISSION_LEN: usize = size_of::<Commission>();
const _: () = assert!(CAMPAIGN_LEN == 176 && COMMISSION_LEN == 184);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum E {
    InvalidInstruction = 6000,
    NotEnoughAccounts,
    MissingSigner,
    InvalidAccount,
    WrongAttestor,
    WrongBrand,
    WrongAccount,
    InvalidCommission,
    InvalidHold,
    ZeroCommission,
    InsufficientBudget,
    StillHeld,
    AlreadyDue,
    NotPayee,
    InvalidPrice,
    Overflow,
    TooManyAccounts,
    Runtime,
}

type R<T = ()> = Result<T, E>;

const MAX_ACCOUNTS: usize = 7;

/// Protocol fee, taken from each commission at release: 1% (100 bps).
pub const FEE_BPS: u64 = 100;

/// Owner of the fee token account: ETcQvsQek2w9feLfsqoe4AypCWfnrSwQiv3djqocaP2m.
pub const TREASURY: Key = [
    199, 249, 18, 123, 71, 65, 244, 7, 224, 1, 161, 150, 188, 148, 217, 61, 182, 105, 175, 161, 104,
    91, 67, 177, 82, 187, 244, 86, 213, 53, 181, 150,
];

/// Hand-rolled entrypoint on the lazy context: reads at most 7 accounts and
/// returns the error code directly.
#[cfg(any(target_os = "solana", target_arch = "bpf"))]
#[no_mangle]
pub unsafe extern "C" fn entrypoint(input: *mut u8) -> u64 {
    use pinocchio::entrypoint::lazy::{InstructionContext, MaybeAccount};
    let mut ctx = InstructionContext::new_unchecked(input);
    let n = ctx.remaining() as usize;
    if n > MAX_ACCOUNTS {
        return E::TooManyAccounts as u64;
    }
    let mut slots = [const { MaybeUninit::<AccountView>::uninit() }; MAX_ACCOUNTS];
    for i in 0..n {
        let a = match ctx.next_account_unchecked() {
            MaybeAccount::Account(a) => a,
            // The runtime only marks an account as a duplicate of an earlier
        // one, so slot `j` (j < i) is already written.
        MaybeAccount::Duplicated(j) => slots.get_unchecked(j as usize).assume_init_ref().clone(),
        };
        slots[i].write(a);
    }
    let accounts = core::slice::from_raw_parts(slots.as_ptr() as *const AccountView, n);
    match process(accounts, ctx.instruction_data_unchecked()) {
        Ok(()) => 0,
        Err(e) => e as u64,
    }
}

#[cfg(any(target_os = "solana", target_arch = "bpf"))]
pinocchio::nostd_panic_handler!();

/// Instruction data is an 8-byte header (tag in byte 0, rest zero) followed
/// by the arguments, so the arguments sit 8-byte aligned in the input buffer
/// and are read in place as `#[repr(C)]` structs.
pub fn process(a: &[AccountView], data: &[u8]) -> R {
    need(data.len() >= 8, E::InvalidInstruction)?;
    let x = unsafe { data.as_ptr().add(8) };
    let n = data.len() - 8;
    // SAFETY (all arms): `args` checks the exact length; the runtime places
    // instruction data 8-byte aligned, so the arguments are aligned too.
    match data[0] {
        0 => create_campaign(a, unsafe { &*(args::<CreateArgs>(x, n)?) }),
        1 => record_sale(a, unsafe { &*(args::<SaleArgs>(x, n)?) }),
        2 => cancel(a),
        3 => release(a),
        4 => withdraw(a, unsafe { *(args::<u64>(x, n)?) }),
        5 => sell(a, unsafe { *(args::<u64>(x, n)?) }),
        _ => Err(E::InvalidInstruction),
    }
}

#[repr(C)]
pub struct CreateArgs {
    pub id: u64,
    pub hold: i64,
    pub bps: u16,
    pub bump: u8,
    _pad: [u8; 5],
    pub lamports: u64,
    pub attestor: Key,
}

#[repr(C)]
pub struct SaleArgs {
    pub order_hash: Key,
    pub order_amount: u64,
    pub creator: Key,
    pub lamports: u64,
    pub bump: u8,
    _pad: [u8; 7],
}

#[inline(always)]
fn args<T>(x: *const u8, n: usize) -> R<*const T> {
    need(n == size_of::<T>(), E::InvalidInstruction)?;
    Ok(x as *const T)
}

// ------------------------------------------------------------------ helpers

#[inline(always)]
fn need(ok: bool, e: E) -> R {
    if ok {
        Ok(())
    } else {
        Err(e)
    }
}

/// Out-of-line 32-byte copy (a call is shorter than four load/store pairs).
#[inline(never)]
fn cp(dst: &mut Key, src: &Key) {
    *dst = *src;
}

#[inline(always)]
fn signer(a: &AccountView) -> R {
    need(a.is_signer(), E::MissingSigner)
}

#[inline(always)]
fn addr(a: &AccountView) -> &Key {
    a.address().as_array()
}

/// Key equality, out of line: one call instead of an inlined 32-byte compare
/// at every check.
#[inline(never)]
fn eq(a: &Key, b: &Key) -> bool {
    a == b
}

/// The Clock sysvar cannot fail to load inside a program; if it ever did,
/// the unwrap aborts the transaction.
#[inline(never)]
fn now() -> i64 {
    Clock::get().unwrap().unix_timestamp
}

/// `amount * bps / 10_000` without u128 division code. Exact, no overflow.
#[inline(never)]
fn bps_of(amount: u64, bps: u16) -> u64 {
    let b = bps as u64;
    (amount / 10_000) * b + (amount % 10_000) * b / 10_000
}

/// Data pointer of an account owned by `owner` with exactly `len` bytes and,
/// if `tag` is non-zero, carrying that record tag and the current version.
/// Null otherwise. Returned in a register; callers turn null into an error.
#[inline(never)]
fn rec(a: &AccountView, owner: &Address, len: usize, tag: u8) -> *mut u8 {
    if !a.owned_by(owner) || a.data_len() != len {
        return core::ptr::null_mut();
    }
    let p = a.data_ptr() as *mut u8;
    // SAFETY: every record checked here is longer than one byte.
    if tag != 0 && unsafe { *p != tag } {
        return core::ptr::null_mut();
    }
    p
}

#[inline(always)]
fn ok<T>(p: *mut T) -> R<*mut T> {
    if p.is_null() {
        Err(E::InvalidAccount)
    } else {
        Ok(p)
    }
}

#[inline(always)]
fn campaign(a: &AccountView) -> R<&mut Campaign> {
    // SAFETY: owner, exact length and tag checked; account data is 8-byte aligned.
    Ok(unsafe { &mut *(ok(rec(a, &ID, CAMPAIGN_LEN, TAG_CAMPAIGN))? as *mut Campaign) })
}

/// A commission together with the campaign it belongs to.
#[inline(never)]
fn commission<'a>(camp: &'a AccountView, com: &'a AccountView) -> R<(&'a mut Campaign, &'a mut Commission)> {
    let c = campaign(camp)?;
    // SAFETY: as in `campaign`.
    let m = unsafe { &mut *(ok(rec(com, &ID, COMMISSION_LEN, TAG_COMMISSION))? as *mut Commission) };
    need(eq(&m.campaign, addr(camp)), E::WrongAccount)?;
    Ok((c, m))
}

/// An initialised SPL token account (legacy program) of `mint`, or null.
#[inline(never)]
fn token_ptr(a: &AccountView, mint: &Key) -> *mut TokenAccount {
    let t = rec(a, &TOKEN, 165, 0) as *mut TokenAccount;
    // SAFETY: owner and length checked; the struct covers the first 109 bytes.
    if t.is_null() || unsafe { (*t).state != 1 || !eq(&(*t).mint, mint) } {
        return core::ptr::null_mut();
    }
    t
}

#[inline(always)]
fn token<'a>(a: &'a AccountView, mint: &Key) -> R<&'a TokenAccount> {
    Ok(unsafe { &*ok(token_ptr(a, mint))? })
}

/// One CPI helper for the System and Token programs. `flags` holds two bits
/// per account: bit 2i = writable, bit 2i+1 = signer.
#[inline(never)]
fn cpi(program: &Address, accs: &[&AccountView], flags: u32, data: &[u8], signers: &[Signer]) {
    let mut metas = [const { MaybeUninit::<InstructionAccount>::uninit() }; 3];
    let mut views = [const { MaybeUninit::<CpiAccount>::uninit() }; 3];
    let mut f = flags;
    for (i, acc) in accs.iter().enumerate() {
        metas[i].write(InstructionAccount::new(acc.address(), f & 1 != 0, f & 2 != 0));
        CpiAccount::init_from_account_view(acc, &mut views[i]);
        f >>= 2;
    }
    let n = accs.len();
    // SAFETY: the first `n` slots are initialised. Records are only touched
    // through raw pointers, so no Rust borrow of account data is outstanding
    // in the runtime's borrow flags. A failing CPI aborts the transaction.
    unsafe {
        let ix = InstructionView {
            program_id: program,
            accounts: core::slice::from_raw_parts(metas.as_ptr() as *const InstructionAccount, n),
            data,
        };
        invoke_signed_unchecked(&ix, core::slice::from_raw_parts(views.as_ptr() as *const CpiAccount, n), signers);
    }
}

/// SPL Token `Transfer` (legacy program only).
#[inline(never)]
/// The token program account must be among the instruction's accounts (the
/// runtime refuses a CPI to a program that is not), but its address needs no
/// check here: the CPI always targets the legacy token program by id.
fn transfer(from: &AccountView, to: &AccountView, auth: &AccountView, amount: u64, signers: &[Signer]) {
    let mut d = [3u8; 9];
    d[1..].copy_from_slice(&amount.to_le_bytes());
    // from: w, to: w, authority: signer
    cpi(&TOKEN, &[from, to, auth], 0b10_01_01, &d, signers);
}

/// Transfer out of the vault, signed by the campaign PDA.
#[inline(never)]
fn pay_out(camp: &AccountView, c: &Campaign, vault: &AccountView, to: &AccountView, amount: u64) {
    let id = c.id.to_le_bytes();
    let bump = [c.bump];
    let seeds = [Seed::from(b"campaign"), Seed::from(&c.brand), Seed::from(&id), Seed::from(&bump)];
    transfer(vault, to, camp, amount, &[Signer::from(&seeds)])
}

/// Create the PDA `[seed, a, b, bump]` owned by this program with `len`
/// zeroed bytes, funded with `lamports` by `payer`. The client passes the
/// rent-exempt minimum; the runtime rejects any new account below it. The runtime only lets the new account
/// sign when the seeds and bump derive to its address, so a wrong bump fails
/// the CPI; and CreateAccount refuses an address that is already in use, so
/// the same seeds can never be created twice.
#[inline(never)]
fn create(payer: &AccountView, acct: &AccountView, seed: &[u8], a: &Key, b: &[u8], bump: u8, lamports: u64, len: usize) -> R<*mut u8> {
    signer(payer)?;
    let mut d = [0u8; 52];
    d[4..12].copy_from_slice(&lamports.to_le_bytes());
    d[12..20].copy_from_slice(&(len as u64).to_le_bytes());
    d[20..].copy_from_slice(ID.as_ref());
    let bb = [bump];
    let seeds = [Seed::from(seed), Seed::from(a), Seed::from(b), Seed::from(&bb)];
    // payer: w+s, new account: w+s
    cpi(&SYSTEM, &[payer, acct], 0b11_11, &d, &[Signer::from(&seeds)]);
    ok(rec(acct, &ID, len, 0))
}

/// Write a record's tag, version and bump in one store.
#[inline(always)]
fn header(p: *mut u8, tag: u8, bump: u8) {
    // SAFETY: `p` is a freshly created record, 8-byte aligned.
    unsafe { *(p as *mut u32) = tag as u32 | (VERSION as u32) << 8 | (bump as u32) << 16 };
}

/// Move every lamport of `acct` to `to` and close it.
#[inline(never)]
fn close(acct: &AccountView, to: &AccountView) {
    let (mut acct, mut to) = (acct.clone(), to.clone());
    // Total lamports in existence fit in a u64, so this sum cannot overflow.
    to.set_lamports(to.lamports() + acct.lamports());
    acct.set_lamports(0);
    // SAFETY: records are only accessed through raw pointers; nothing holds a
    // runtime borrow of this account.
    unsafe { acct.close_unchecked() };
}

// -------------------------------------------------------------- instructions

/// 0. brand(s,w) campaign(w) vault mint system
/// args: CreateArgs { id, hold, bps, bump, lamports, attestor }
fn create_campaign(a: &[AccountView], x: &CreateArgs) -> R {
    let [brand, camp, vault, mint, ..] = a else { return Err(E::NotEnoughAccounts) };
    let (bps, hold) = (x.bps, x.hold);
    need(bps > 0 && bps <= MAX_BPS, E::InvalidCommission)?;
    need((0..=MAX_HOLD).contains(&hold), E::InvalidHold)?;
    ok(rec(mint, &TOKEN, 82, 0))?;
    // The vault is the campaign's own token account of this mint (the client
    // creates the campaign's ATA earlier in the same transaction).
    need(eq(&token(vault, addr(mint))?.owner, addr(camp)), E::WrongAccount)?;

    let id = x.id.to_le_bytes();
    let p = create(brand, camp, b"campaign", addr(brand), &id, x.bump, x.lamports, CAMPAIGN_LEN)?;
    // SAFETY: freshly allocated, owned by us, CAMPAIGN_LEN zeroed bytes.
    let c = unsafe { &mut *(p as *mut Campaign) };
    header(p, TAG_CAMPAIGN, x.bump);
    cp(&mut c.brand, addr(brand));
    cp(&mut c.attestor, &x.attestor);
    cp(&mut c.mint, addr(mint));
    cp(&mut c.vault, addr(vault));
    c.id = x.id;
    c.hold = hold;
    c.bps = bps;
    Ok(())
}

/// 1. attestor(s) payer(s,w) campaign(w) vault commission(w) system
/// args: SaleArgs { order_hash, order_amount, creator, lamports, bump }
fn record_sale(a: &[AccountView], x: &SaleArgs) -> R {
    let [attestor, payer, camp, vault, com, ..] = a else { return Err(E::NotEnoughAccounts) };
    signer(attestor)?;
    let c = campaign(camp)?;
    need(eq(&c.attestor, addr(attestor)), E::WrongAttestor)?;
    need(eq(&c.vault, addr(vault)), E::WrongAccount)?;
    let balance = token(vault, &c.mint)?.amount;
    let amount = bps_of(x.order_amount, c.bps);
    need(amount > 0, E::ZeroCommission)?;
    // Invariant: reserved <= vault balance (the vault only pays out reserved
    // commissions or unreserved budget), and token supplies fit in a u64.
    need(c.reserved + amount <= balance, E::InsufficientBudget)?;
    let release_at = now() + c.hold; // hold <= 90 days

    // One account per order hash: the same order can never be paid twice.
    let p = create(payer, com, b"commission", addr(camp), &x.order_hash, x.bump, x.lamports, COMMISSION_LEN)?;
    // SAFETY: freshly allocated, owned by us, COMMISSION_LEN zeroed bytes.
    let m = unsafe { &mut *(p as *mut Commission) };
    header(p, TAG_COMMISSION, x.bump);
    cp(&mut m.campaign, addr(camp));
    cp(&mut m.creator, &x.creator);
    cp(&mut m.payee, &x.creator);
    cp(&mut m.rent_payer, addr(payer));
    cp(&mut m.order_hash, &x.order_hash);
    m.amount = amount;
    m.release_at = release_at;

    c.reserved += amount; // cannot overflow: reserved + amount <= vault balance
    Ok(())
}

/// 2. attestor(s) campaign(w) commission(w) rent_payer(w)
/// A refund inside the window: the reservation returns to the brand's budget.
fn cancel(a: &[AccountView]) -> R {
    let [attestor, camp, com, rent_payer, ..] = a else { return Err(E::NotEnoughAccounts) };
    signer(attestor)?;
    let (c, m) = commission(camp, com)?;
    need(eq(&c.attestor, addr(attestor)), E::WrongAttestor)?;
    need(eq(&m.rent_payer, addr(rent_payer)), E::WrongAccount)?;
    // Once the refund window has passed, the commission is owed.
    need(now() < m.release_at, E::AlreadyDue)?;
    let amount = m.amount;
    c.reserved -= amount; // reserved includes every open commission
    close(com, rent_payer);
    Ok(())
}

/// 3. campaign(w) vault(w) commission(w) payee_token(w) rent_payer(w) token_program fee_token(w)
/// Permissionless once the refund window has passed. Pays the current payee
/// the commission minus the 1% fee, which goes to the treasury's token account.
fn release(a: &[AccountView]) -> R {
    let [camp, vault, com, dest, rent_payer, _token_program, fee_dest, ..] = a else { return Err(E::NotEnoughAccounts) };
    let (c, m) = commission(camp, com)?;
    need(now() >= m.release_at, E::StillHeld)?;
    need(eq(&c.vault, addr(vault)), E::WrongAccount)?;
    need(eq(&m.rent_payer, addr(rent_payer)), E::WrongAccount)?;
    need(eq(&token(dest, &c.mint)?.owner, &m.payee), E::NotPayee)?;
    need(eq(&token(fee_dest, &c.mint)?.owner, &TREASURY), E::WrongAccount)?;
    let amount = m.amount;
    // Divide first so no product can overflow; the fee rounds down.
    let fee = amount / (10_000 / FEE_BPS);
    pay_out(camp, c, vault, dest, amount - fee);
    pay_out(camp, c, vault, fee_dest, fee); // SPL Token accepts a zero transfer
    c.reserved -= amount; // reserved includes every open commission
    c.paid += amount;
    close(com, rent_payer);
    Ok(())
}

/// 4. brand(s) campaign vault(w) dest(w) token_program
/// args: amount u64. The brand can only take back what is not reserved.
fn withdraw(a: &[AccountView], amount: u64) -> R {
    let [brand, camp, vault, dest, _token_program, ..] = a else { return Err(E::NotEnoughAccounts) };
    signer(brand)?;
    let c = campaign(camp)?;
    need(eq(&c.brand, addr(brand)), E::WrongBrand)?;
    need(eq(&c.vault, addr(vault)), E::WrongAccount)?;
    let balance = token(vault, &c.mint)?.amount;
    need(amount > 0 && c.reserved + amount <= balance, E::InsufficientBudget)?;
    pay_out(camp, c, vault, dest, amount);
    Ok(())
}

/// 5. payee(s) buyer(s) campaign commission(w) buyer_token(w) payee_token(w) token_program
/// args: price u64. Early payout: the buyer pays `price` now, becomes the
/// payee, collects the full commission at release and carries the refund
/// risk until then.
fn sell(a: &[AccountView], price: u64) -> R {
    let [payee, buyer, camp, com, from, to, _token_program, ..] = a else { return Err(E::NotEnoughAccounts) };
    signer(payee)?;
    signer(buyer)?;
    let (c, m) = commission(camp, com)?;
    need(eq(&m.payee, addr(payee)), E::NotPayee)?;
    need(now() < m.release_at, E::AlreadyDue)?;
    need(price > 0 && price <= m.amount, E::InvalidPrice)?;
    // Paid in the campaign's mint: the token program only moves funds
    // between two accounts of the same mint.
    token(to, &c.mint)?;
    transfer(from, to, buyer, price, &[]);
    cp(&mut m.payee, addr(buyer));
    m.flags |= FLAG_SOLD;
    Ok(())
}
