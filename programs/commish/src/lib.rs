use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

declare_id!("CATB1wHyUmBTzVS2WiAgL8uweDGVb7bapPvqopTN2a6b");

pub const MAX_COMMISSION_BPS: u16 = 5_000;
pub const MAX_HOLD_SECONDS: i64 = 90 * 24 * 60 * 60;

#[program]
pub mod commish {
    use super::*;

    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        id: u64,
        commission_bps: u16,
        hold_seconds: i64,
        attestor: Pubkey,
    ) -> Result<()> {
        require!(
            commission_bps > 0 && commission_bps <= MAX_COMMISSION_BPS,
            CommishError::InvalidCommission
        );
        require!(
            (0..=MAX_HOLD_SECONDS).contains(&hold_seconds),
            CommishError::InvalidHold
        );
        ctx.accounts.campaign.set_inner(Campaign {
            brand: ctx.accounts.brand.key(),
            attestor,
            mint: ctx.accounts.mint.key(),
            id,
            commission_bps,
            hold_seconds,
            reserved: 0,
            paid: 0,
            bump: ctx.bumps.campaign,
        });
        Ok(())
    }

    pub fn join_campaign(ctx: Context<JoinCampaign>) -> Result<()> {
        ctx.accounts.affiliate.set_inner(Affiliate {
            campaign: ctx.accounts.campaign.key(),
            wallet: ctx.accounts.wallet.key(),
            pending: 0,
            earned: 0,
            bump: ctx.bumps.affiliate,
        });
        Ok(())
    }

    pub fn record_sale(
        ctx: Context<RecordSale>,
        order_hash: [u8; 32],
        order_amount: u64,
    ) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let amount = u64::try_from(
            (order_amount as u128) * (campaign.commission_bps as u128) / 10_000,
        )
        .map_err(|_| CommishError::MathOverflow)?;
        require!(amount > 0, CommishError::ZeroCommission);

        let free = ctx
            .accounts
            .vault
            .amount
            .checked_sub(campaign.reserved)
            .ok_or(CommishError::MathOverflow)?;
        require!(free >= amount, CommishError::InsufficientBudget);

        campaign.reserved = campaign
            .reserved
            .checked_add(amount)
            .ok_or(CommishError::MathOverflow)?;
        let affiliate = &mut ctx.accounts.affiliate;
        affiliate.pending = affiliate
            .pending
            .checked_add(amount)
            .ok_or(CommishError::MathOverflow)?;

        let now = Clock::get()?.unix_timestamp;
        ctx.accounts.commission.set_inner(Commission {
            campaign: campaign.key(),
            affiliate: affiliate.wallet,
            order_hash,
            order_amount,
            amount,
            release_at: now
                .checked_add(campaign.hold_seconds)
                .ok_or(CommishError::MathOverflow)?,
            status: CommissionStatus::Pending,
            bump: ctx.bumps.commission,
        });
        emit!(SaleRecorded {
            campaign: campaign.key(),
            affiliate: affiliate.wallet,
            order_hash,
            amount,
        });
        Ok(())
    }

    pub fn cancel_commission(ctx: Context<CancelCommission>) -> Result<()> {
        let commission = &mut ctx.accounts.commission;
        require!(
            commission.status == CommissionStatus::Pending,
            CommishError::NotPending
        );
        let campaign = &mut ctx.accounts.campaign;
        campaign.reserved = campaign
            .reserved
            .checked_sub(commission.amount)
            .ok_or(CommishError::MathOverflow)?;
        let affiliate = &mut ctx.accounts.affiliate;
        affiliate.pending = affiliate
            .pending
            .checked_sub(commission.amount)
            .ok_or(CommishError::MathOverflow)?;
        commission.status = CommissionStatus::Cancelled;
        Ok(())
    }

    // Permissionless: anyone may crank a payout once the hold has passed.
    pub fn release(ctx: Context<Release>) -> Result<()> {
        let commission = &mut ctx.accounts.commission;
        require!(
            commission.status == CommissionStatus::Pending,
            CommishError::NotPending
        );
        require!(
            Clock::get()?.unix_timestamp >= commission.release_at,
            CommishError::StillHeld
        );
        let amount = commission.amount;

        let campaign = &ctx.accounts.campaign;
        let brand = campaign.brand;
        let id = campaign.id.to_le_bytes();
        let seeds: &[&[u8]] = &[b"campaign", brand.as_ref(), &id, &[campaign.bump]];
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.affiliate_ata.to_account_info(),
                    authority: ctx.accounts.campaign.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        let campaign = &mut ctx.accounts.campaign;
        campaign.reserved = campaign
            .reserved
            .checked_sub(amount)
            .ok_or(CommishError::MathOverflow)?;
        campaign.paid = campaign
            .paid
            .checked_add(amount)
            .ok_or(CommishError::MathOverflow)?;
        let affiliate = &mut ctx.accounts.affiliate;
        affiliate.pending = affiliate
            .pending
            .checked_sub(amount)
            .ok_or(CommishError::MathOverflow)?;
        affiliate.earned = affiliate
            .earned
            .checked_add(amount)
            .ok_or(CommishError::MathOverflow)?;
        commission.status = CommissionStatus::Paid;
        emit!(CommissionPaid {
            campaign: campaign.key(),
            affiliate: affiliate.wallet,
            order_hash: commission.order_hash,
            amount,
        });
        Ok(())
    }

    // The brand can take back only what is not owed to affiliates.
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let campaign = &ctx.accounts.campaign;
        let free = ctx
            .accounts
            .vault
            .amount
            .checked_sub(campaign.reserved)
            .ok_or(CommishError::MathOverflow)?;
        require!(amount > 0 && amount <= free, CommishError::InsufficientBudget);

        let brand = campaign.brand;
        let id = campaign.id.to_le_bytes();
        let seeds: &[&[u8]] = &[b"campaign", brand.as_ref(), &id, &[campaign.bump]];
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.brand_ata.to_account_info(),
                    authority: ctx.accounts.campaign.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            ctx.accounts.mint.decimals,
        )
    }
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct CreateCampaign<'info> {
    #[account(mut)]
    pub brand: Signer<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = brand,
        space = 8 + Campaign::INIT_SPACE,
        seeds = [b"campaign", brand.key().as_ref(), &id.to_le_bytes()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(
        init,
        payer = brand,
        associated_token::mint = mint,
        associated_token::authority = campaign,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinCampaign<'info> {
    #[account(mut)]
    pub wallet: Signer<'info>,
    pub campaign: Account<'info, Campaign>,
    #[account(
        init,
        payer = wallet,
        space = 8 + Affiliate::INIT_SPACE,
        seeds = [b"affiliate", campaign.key().as_ref(), wallet.key().as_ref()],
        bump
    )]
    pub affiliate: Account<'info, Affiliate>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(order_hash: [u8; 32])]
pub struct RecordSale<'info> {
    #[account(mut)]
    pub attestor: Signer<'info>,
    #[account(mut, has_one = attestor @ CommishError::WrongAttestor)]
    pub campaign: Account<'info, Campaign>,
    #[account(
        associated_token::mint = campaign.mint,
        associated_token::authority = campaign,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"affiliate", campaign.key().as_ref(), affiliate.wallet.as_ref()],
        bump = affiliate.bump,
        has_one = campaign
    )]
    pub affiliate: Account<'info, Affiliate>,
    // One account per order: the same order can never be paid twice.
    #[account(
        init,
        payer = attestor,
        space = 8 + Commission::INIT_SPACE,
        seeds = [b"commission", campaign.key().as_ref(), &order_hash],
        bump
    )]
    pub commission: Account<'info, Commission>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelCommission<'info> {
    pub attestor: Signer<'info>,
    #[account(mut, has_one = attestor @ CommishError::WrongAttestor)]
    pub campaign: Account<'info, Campaign>,
    #[account(
        mut,
        seeds = [b"commission", campaign.key().as_ref(), &commission.order_hash],
        bump = commission.bump,
        has_one = campaign
    )]
    pub commission: Account<'info, Commission>,
    #[account(
        mut,
        seeds = [b"affiliate", campaign.key().as_ref(), commission.affiliate.as_ref()],
        bump = affiliate.bump
    )]
    pub affiliate: Account<'info, Affiliate>,
}

#[derive(Accounts)]
pub struct Release<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,
    #[account(mut, has_one = mint)]
    pub campaign: Account<'info, Campaign>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = campaign,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"commission", campaign.key().as_ref(), &commission.order_hash],
        bump = commission.bump,
        has_one = campaign
    )]
    pub commission: Account<'info, Commission>,
    #[account(
        mut,
        seeds = [b"affiliate", campaign.key().as_ref(), commission.affiliate.as_ref()],
        bump = affiliate.bump
    )]
    pub affiliate: Account<'info, Affiliate>,
    /// CHECK: must equal the wallet recorded on the commission.
    #[account(address = commission.affiliate @ CommishError::WrongAffiliate)]
    pub affiliate_wallet: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = cranker,
        associated_token::mint = mint,
        associated_token::authority = affiliate_wallet,
        associated_token::token_program = token_program
    )]
    pub affiliate_ata: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub brand: Signer<'info>,
    #[account(mut, has_one = brand @ CommishError::WrongBrand, has_one = mint)]
    pub campaign: Account<'info, Campaign>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = campaign,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = brand,
        associated_token::mint = mint,
        associated_token::authority = brand,
        associated_token::token_program = token_program
    )]
    pub brand_ata: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub brand: Pubkey,
    pub attestor: Pubkey,
    pub mint: Pubkey,
    pub id: u64,
    pub commission_bps: u16,
    pub hold_seconds: i64,
    pub reserved: u64,
    pub paid: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Affiliate {
    pub campaign: Pubkey,
    pub wallet: Pubkey,
    pub pending: u64,
    pub earned: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum CommissionStatus {
    Pending,
    Paid,
    Cancelled,
}

#[account]
#[derive(InitSpace)]
pub struct Commission {
    pub campaign: Pubkey,
    pub affiliate: Pubkey,
    pub order_hash: [u8; 32],
    pub order_amount: u64,
    pub amount: u64,
    pub release_at: i64,
    pub status: CommissionStatus,
    pub bump: u8,
}

#[event]
pub struct SaleRecorded {
    pub campaign: Pubkey,
    pub affiliate: Pubkey,
    pub order_hash: [u8; 32],
    pub amount: u64,
}

#[event]
pub struct CommissionPaid {
    pub campaign: Pubkey,
    pub affiliate: Pubkey,
    pub order_hash: [u8; 32],
    pub amount: u64,
}

#[error_code]
pub enum CommishError {
    #[msg("Commission must be between 1 and 5000 basis points")]
    InvalidCommission,
    #[msg("Hold must be between 0 and 90 days")]
    InvalidHold,
    #[msg("Only the campaign attestor can record or cancel sales")]
    WrongAttestor,
    #[msg("Only the brand can withdraw")]
    WrongBrand,
    #[msg("Affiliate wallet does not match the commission")]
    WrongAffiliate,
    #[msg("Commission rounds to zero")]
    ZeroCommission,
    #[msg("Budget left after reserved commissions is too small")]
    InsufficientBudget,
    #[msg("Commission is not pending")]
    NotPending,
    #[msg("Commission is still inside the refund hold")]
    StillHeld,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
