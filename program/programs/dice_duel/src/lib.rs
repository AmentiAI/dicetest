//! ASHDUEL — 1v1 SOL dice, winner takes all, no house fee.
//!
//! Rolls are derived from Solana's SlotHashes sysvar after a commit delay.
//! Both wagers are locked before the reveal slot is produced, so neither
//! player can grind a favorable hash. There is no treasury and no fee CPI.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use anchor_lang::solana_program::sysvar::slot_hashes;

declare_id!("Djg4PX3upqax7GWrxWUjF3ydhbDDPqugM5QTsoNu14xx");

/// Slots to wait after join before the committed slot hash exists.
/// ~1.6s on mainnet/devnet at 400ms slots. Long enough that the hash
/// cannot be known at lock time; short enough that SlotHashes still holds it.
pub const REVEAL_DELAY_SLOTS: u64 = 4;
pub const MIN_WAGER_LAMPORTS: u64 = 1_000_000; // 0.001 SOL
pub const MAX_WAGER_LAMPORTS: u64 = 50_000_000_000; // 50 SOL
pub const SLOT_HASH_ENTRY_SIZE: usize = 40; // u64 slot + 32-byte hash

#[program]
pub mod dice_duel {
    use super::*;

    pub fn create_duel(
        ctx: Context<CreateDuel>,
        duel_id: u64,
        wager_lamports: u64,
    ) -> Result<()> {
        require!(
            wager_lamports >= MIN_WAGER_LAMPORTS,
            DiceError::WagerTooSmall
        );
        require!(
            wager_lamports <= MAX_WAGER_LAMPORTS,
            DiceError::WagerTooLarge
        );

        let clock = Clock::get()?;
        let duel_key = ctx.accounts.duel.key();
        let duel = &mut ctx.accounts.duel;
        duel.duel_id = duel_id;
        duel.host = ctx.accounts.host.key();
        duel.challenger = Pubkey::default();
        duel.wager_lamports = wager_lamports;
        duel.status = DuelStatus::Waiting as u8;
        duel.commit_slot = 0;
        duel.reveal_slot = 0;
        duel.host_roll = 0;
        duel.challenger_roll = 0;
        duel.winner = Pubkey::default();
        duel.slot_hash = [0u8; 32];
        duel.bump = ctx.bumps.duel;
        duel.created_slot = clock.slot;

        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.host.to_account_info(),
                    to: ctx.accounts.duel.to_account_info(),
                },
            ),
            wager_lamports,
        )?;

        emit!(DuelCreated {
            duel: duel_key,
            host: ctx.accounts.host.key(),
            duel_id,
            wager_lamports,
        });
        Ok(())
    }

    pub fn join_duel(ctx: Context<JoinDuel>) -> Result<()> {
        require!(
            ctx.accounts.challenger.key() != ctx.accounts.duel.host,
            DiceError::SelfJoin
        );
        require!(
            ctx.accounts.duel.status == DuelStatus::Waiting as u8,
            DiceError::NotWaiting
        );

        let wager = ctx.accounts.duel.wager_lamports;
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.challenger.to_account_info(),
                    to: ctx.accounts.duel.to_account_info(),
                },
            ),
            wager,
        )?;

        let clock = Clock::get()?;
        let duel_key = ctx.accounts.duel.key();
        let duel = &mut ctx.accounts.duel;
        duel.challenger = ctx.accounts.challenger.key();
        duel.commit_slot = clock.slot;
        duel.reveal_slot = clock
            .slot
            .checked_add(REVEAL_DELAY_SLOTS)
            .ok_or(DiceError::Overflow)?;
        duel.status = DuelStatus::Locked as u8;

        emit!(DuelLocked {
            duel: duel_key,
            host: duel.host,
            challenger: duel.challenger,
            commit_slot: duel.commit_slot,
            reveal_slot: duel.reveal_slot,
            wager_lamports: wager,
        });
        Ok(())
    }

    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        let duel = &ctx.accounts.duel;
        require!(duel.status == DuelStatus::Locked as u8, DiceError::NotLocked);
        require!(duel.challenger != Pubkey::default(), DiceError::NotLocked);

        let clock = Clock::get()?;
        require!(clock.slot > duel.reveal_slot, DiceError::RevealNotReady);

        let (slot_hash, used_slot) =
            read_slot_hash(&ctx.accounts.slot_hashes, duel.reveal_slot)?;

        let duel_key = ctx.accounts.duel.key();
        let (host_roll, challenger_roll) = derive_rolls(
            &slot_hash,
            &duel_key,
            &duel.host,
            &duel.challenger,
            duel.wager_lamports,
            used_slot,
        )?;

        let winner = if host_roll > challenger_roll {
            duel.host
        } else {
            duel.challenger
        };
        require!(
            winner == ctx.accounts.host.key() || winner == ctx.accounts.challenger.key(),
            DiceError::InvalidWinner
        );

        let pot = duel
            .wager_lamports
            .checked_mul(2)
            .ok_or(DiceError::Overflow)?;
        let duel_info = ctx.accounts.duel.to_account_info();
        require!(duel_info.lamports() >= pot, DiceError::InsufficientPot);

        let winner_info = if winner == ctx.accounts.host.key() {
            ctx.accounts.host.to_account_info()
        } else {
            ctx.accounts.challenger.to_account_info()
        };

        **duel_info.try_borrow_mut_lamports()? -= pot;
        **winner_info.try_borrow_mut_lamports()? += pot;

        let duel = &mut ctx.accounts.duel;
        duel.host_roll = host_roll;
        duel.challenger_roll = challenger_roll;
        duel.winner = winner;
        duel.slot_hash = slot_hash;
        duel.reveal_slot = used_slot;
        duel.status = DuelStatus::Settled as u8;

        emit!(DuelSettled {
            duel: duel_key,
            host: duel.host,
            challenger: duel.challenger,
            winner,
            host_roll,
            challenger_roll,
            reveal_slot: used_slot,
            slot_hash,
            pot,
        });
        Ok(())
    }

    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        require!(
            ctx.accounts.duel.status == DuelStatus::Waiting as u8,
            DiceError::NotWaiting
        );
        emit!(DuelCancelled {
            duel: ctx.accounts.duel.key(),
            host: ctx.accounts.host.key(),
        });
        Ok(())
    }

    pub fn refund_expired(ctx: Context<RefundExpired>) -> Result<()> {
        let duel = &ctx.accounts.duel;
        require!(duel.status == DuelStatus::Locked as u8, DiceError::NotLocked);

        require!(
            slot_hash_expired(&ctx.accounts.slot_hashes, duel.reveal_slot)?,
            DiceError::NotExpired
        );

        let wager = duel.wager_lamports;
        let duel_info = ctx.accounts.duel.to_account_info();
        require!(duel_info.lamports() >= wager * 2, DiceError::InsufficientPot);

        **duel_info.try_borrow_mut_lamports()? -= wager;
        **ctx.accounts.challenger.try_borrow_mut_lamports()? += wager;

        emit!(DuelRefunded {
            duel: ctx.accounts.duel.key(),
            host: duel.host,
            challenger: duel.challenger,
        });
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum DuelStatus {
    Waiting = 0,
    Locked = 1,
    Settled = 2,
    Cancelled = 3,
    Refunded = 4,
}

#[account]
#[derive(InitSpace)]
pub struct Duel {
    pub duel_id: u64,
    pub host: Pubkey,
    pub challenger: Pubkey,
    pub wager_lamports: u64,
    pub status: u8,
    pub commit_slot: u64,
    pub reveal_slot: u64,
    pub host_roll: u8,
    pub challenger_roll: u8,
    pub winner: Pubkey,
    pub slot_hash: [u8; 32],
    pub bump: u8,
    pub created_slot: u64,
}

#[derive(Accounts)]
#[instruction(duel_id: u64)]
pub struct CreateDuel<'info> {
    #[account(mut)]
    pub host: Signer<'info>,
    #[account(
        init,
        payer = host,
        space = 8 + Duel::INIT_SPACE,
        seeds = [b"duel", host.key().as_ref(), &duel_id.to_le_bytes()],
        bump
    )]
    pub duel: Account<'info, Duel>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinDuel<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,
    #[account(
        mut,
        seeds = [b"duel", duel.host.as_ref(), &duel.duel_id.to_le_bytes()],
        bump = duel.bump
    )]
    pub duel: Account<'info, Duel>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    pub settler: Signer<'info>,
    #[account(
        mut,
        seeds = [b"duel", duel.host.as_ref(), &duel.duel_id.to_le_bytes()],
        bump = duel.bump,
        has_one = host,
        has_one = challenger
    )]
    pub duel: Account<'info, Duel>,
    /// CHECK: constrained to duel.host
    #[account(mut)]
    pub host: UncheckedAccount<'info>,
    /// CHECK: constrained to duel.challenger
    #[account(mut)]
    pub challenger: UncheckedAccount<'info>,
    /// CHECK: SlotHashes sysvar — too large to deserialize; parsed by hand.
    #[account(address = slot_hashes::ID)]
    pub slot_hashes: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(mut)]
    pub host: Signer<'info>,
    #[account(
        mut,
        has_one = host,
        seeds = [b"duel", host.key().as_ref(), &duel.duel_id.to_le_bytes()],
        bump = duel.bump,
        close = host
    )]
    pub duel: Account<'info, Duel>,
}

#[derive(Accounts)]
pub struct RefundExpired<'info> {
    pub crank: Signer<'info>,
    #[account(
        mut,
        has_one = host,
        has_one = challenger,
        seeds = [b"duel", duel.host.as_ref(), &duel.duel_id.to_le_bytes()],
        bump = duel.bump,
        close = host
    )]
    pub duel: Account<'info, Duel>,
    /// CHECK: constrained to duel.host
    #[account(mut)]
    pub host: UncheckedAccount<'info>,
    /// CHECK: constrained to duel.challenger
    #[account(mut)]
    pub challenger: UncheckedAccount<'info>,
    /// CHECK: SlotHashes sysvar
    #[account(address = slot_hashes::ID)]
    pub slot_hashes: UncheckedAccount<'info>,
}

#[event]
pub struct DuelCreated {
    pub duel: Pubkey,
    pub host: Pubkey,
    pub duel_id: u64,
    pub wager_lamports: u64,
}

#[event]
pub struct DuelLocked {
    pub duel: Pubkey,
    pub host: Pubkey,
    pub challenger: Pubkey,
    pub commit_slot: u64,
    pub reveal_slot: u64,
    pub wager_lamports: u64,
}

#[event]
pub struct DuelSettled {
    pub duel: Pubkey,
    pub host: Pubkey,
    pub challenger: Pubkey,
    pub winner: Pubkey,
    pub host_roll: u8,
    pub challenger_roll: u8,
    pub reveal_slot: u64,
    pub slot_hash: [u8; 32],
    pub pot: u64,
}

#[event]
pub struct DuelCancelled {
    pub duel: Pubkey,
    pub host: Pubkey,
}

#[event]
pub struct DuelRefunded {
    pub duel: Pubkey,
    pub host: Pubkey,
    pub challenger: Pubkey,
}

#[error_code]
pub enum DiceError {
    #[msg("Wager below 0.001 SOL")]
    WagerTooSmall,
    #[msg("Wager above 50 SOL")]
    WagerTooLarge,
    #[msg("Host cannot join their own duel")]
    SelfJoin,
    #[msg("Duel is not waiting for a challenger")]
    NotWaiting,
    #[msg("Duel is not locked")]
    NotLocked,
    #[msg("Reveal slot has not been produced yet")]
    RevealNotReady,
    #[msg("Target slot hash is not in the sysvar (too early or expired)")]
    SlotHashUnavailable,
    #[msg("Slot hash has expired from the sysvar; refund instead")]
    NotExpired,
    #[msg("SlotHashes account data is malformed")]
    InvalidSlotHashes,
    #[msg("Winner is not a participant")]
    InvalidWinner,
    #[msg("Escrow holds less than the pot")]
    InsufficientPot,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Could not derive unequal dice from hash")]
    DiceDerivationFailed,
}

/// SlotHashes layout: u64 count, then `count` entries of (u64 slot, [u8;32] hash),
/// newest first. We require the exact committed reveal slot so the seed is
/// fixed at join time — players cannot pick a later hash.
fn read_slot_hash(account: &AccountInfo, target_slot: u64) -> Result<([u8; 32], u64)> {
    require_keys_eq!(*account.key, slot_hashes::ID);
    let data = account.try_borrow_data()?;
    require!(data.len() >= 8, DiceError::InvalidSlotHashes);
    let count = u64::from_le_bytes(
        data[0..8]
            .try_into()
            .map_err(|_| DiceError::InvalidSlotHashes)?,
    ) as usize;
    require!(count > 0, DiceError::InvalidSlotHashes);

    let newest_slot = u64::from_le_bytes(
        data[8..16]
            .try_into()
            .map_err(|_| DiceError::InvalidSlotHashes)?,
    );
    if newest_slot < target_slot {
        return err!(DiceError::RevealNotReady);
    }

    for i in 0..count {
        let offset = 8 + i * SLOT_HASH_ENTRY_SIZE;
        require!(
            offset + SLOT_HASH_ENTRY_SIZE <= data.len(),
            DiceError::InvalidSlotHashes
        );
        let slot = u64::from_le_bytes(
            data[offset..offset + 8]
                .try_into()
                .map_err(|_| DiceError::InvalidSlotHashes)?,
        );
        if slot == target_slot {
            let mut hash = [0u8; 32];
            hash.copy_from_slice(&data[offset + 8..offset + 40]);
            return Ok((hash, slot));
        }
    }
    err!(DiceError::SlotHashUnavailable)
}

fn slot_hash_expired(account: &AccountInfo, target_slot: u64) -> Result<bool> {
    require_keys_eq!(*account.key, slot_hashes::ID);
    let data = account.try_borrow_data()?;
    require!(data.len() >= 8, DiceError::InvalidSlotHashes);
    let count = u64::from_le_bytes(
        data[0..8]
            .try_into()
            .map_err(|_| DiceError::InvalidSlotHashes)?,
    ) as usize;
    if count == 0 {
        return Ok(false);
    }
    let last = 8 + (count - 1) * SLOT_HASH_ENTRY_SIZE;
    require!(last + 8 <= data.len(), DiceError::InvalidSlotHashes);
    let oldest_slot = u64::from_le_bytes(
        data[last..last + 8]
            .try_into()
            .map_err(|_| DiceError::InvalidSlotHashes)?,
    );
    Ok(oldest_slot > target_slot)
}

/// SHA-256(slot_hash || duel || host || challenger || wager || slot || counter)
/// then rejection-sample two d6s so 252..255 are discarded (unbiased 1–6).
/// Ties increment counter and re-hash until the rolls differ.
pub fn derive_rolls(
    slot_hash: &[u8; 32],
    duel: &Pubkey,
    host: &Pubkey,
    challenger: &Pubkey,
    wager: u64,
    reveal_slot: u64,
) -> Result<(u8, u8)> {
    for counter in 0u64..64 {
        let digest = hashv(&[
            slot_hash,
            duel.as_ref(),
            host.as_ref(),
            challenger.as_ref(),
            &wager.to_le_bytes(),
            &reveal_slot.to_le_bytes(),
            &counter.to_le_bytes(),
        ]);
        let bytes = digest.to_bytes();
        if let (Some(host_roll), Some(challenger_roll)) = (d6(&bytes, 0), d6(&bytes, 1)) {
            if host_roll != challenger_roll {
                return Ok((host_roll, challenger_roll));
            }
        }
    }
    err!(DiceError::DiceDerivationFailed)
}

fn d6(bytes: &[u8], index: usize) -> Option<u8> {
    let x = *bytes.get(index)?;
    if x >= 252 {
        None
    } else {
        Some((x % 6) + 1)
    }
}
