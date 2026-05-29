use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, CloseAccount};

declare_id!("craz6HFVmz7Nuk9nSD6sxH4nbXXKF1bNPjjN3dmG4FJ");

// Constants
const JACKPOT_DELAY: i64 = 300; // 5 minutes after timer expires
const MAX_TOKEN_FEES: usize = 20; // max per-token fee overrides

#[program]
pub mod crazy_game_vanilla {
    use super::*;

    // ============================================================
    // PLATFORM CONFIG
    // ============================================================

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        default_fee_bps: u16,
    ) -> Result<()> {
        require!(default_fee_bps <= 1000, GameError::InvalidFee); // max 10%
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.operator = ctx.accounts.admin.key(); // default operator = admin
        config.default_fee_bps = default_fee_bps;
        config.token_fees = Vec::new();
        config.is_paused = false;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn update_default_fee(
        ctx: Context<UpdateConfig>,
        default_fee_bps: u16,
    ) -> Result<()> {
        require!(default_fee_bps <= 1000, GameError::InvalidFee);
        ctx.accounts.config.default_fee_bps = default_fee_bps;
        Ok(())
    }

    pub fn set_token_fee(
        ctx: Context<UpdateConfig>,
        mint: Pubkey,
        fee_bps: u16,
    ) -> Result<()> {
        require!(fee_bps <= 1000, GameError::InvalidFee);
        let config = &mut ctx.accounts.config;
        if let Some(entry) = config.token_fees.iter_mut().find(|e| e.mint == mint) {
            entry.fee_bps = fee_bps;
        } else {
            require!(config.token_fees.len() < MAX_TOKEN_FEES, GameError::TooManyTokenFees);
            config.token_fees.push(TokenFee { mint, fee_bps });
        }
        Ok(())
    }

    pub fn remove_token_fee(
        ctx: Context<UpdateConfig>,
        mint: Pubkey,
    ) -> Result<()> {
        ctx.accounts.config.token_fees.retain(|e| e.mint != mint);
        Ok(())
    }

    pub fn set_operator(
        ctx: Context<UpdateConfig>,
        operator: Pubkey,
    ) -> Result<()> {
        ctx.accounts.config.operator = operator;
        Ok(())
    }

    pub fn pause_platform(ctx: Context<UpdateConfig>) -> Result<()> {
        ctx.accounts.config.is_paused = true;
        Ok(())
    }

    pub fn unpause_platform(ctx: Context<UpdateConfig>) -> Result<()> {
        ctx.accounts.config.is_paused = false;
        Ok(())
    }

    pub fn close_config(ctx: Context<CloseConfig>) -> Result<()> {
        let config_info = ctx.accounts.config.to_account_info();
        let admin_info = ctx.accounts.admin.to_account_info();
        let data = config_info.try_borrow_data()?;
        let stored_admin = Pubkey::try_from(&data[8..40]).map_err(|_| GameError::Unauthorized)?;
        require!(stored_admin == admin_info.key(), GameError::Unauthorized);
        drop(data);
        let lamports = config_info.lamports();
        **config_info.try_borrow_mut_lamports()? = 0;
        **admin_info.try_borrow_mut_lamports()? += lamports;
        let mut data = config_info.try_borrow_mut_data()?;
        for byte in data.iter_mut() {
            *byte = 0;
        }
        Ok(())
    }

    // ============================================================
    // GAME
    // ============================================================

    pub fn initialize_game(
        ctx: Context<InitializeGame>,
        name: String,
        initial_deposit: u64,
        min_bet: u64,
        roi_bps: u64,
        timer_duration: i64,
        host_fee_bps: u64,
        timer_mode: u8,
        time_increment: i64,
    ) -> Result<()> {
        require!(!ctx.accounts.config.is_paused, GameError::PlatformPaused);
        require!(name.len() >= 3 && name.len() <= 30, GameError::InvalidName);
        require!(initial_deposit > 0, GameError::InvalidDeposit);
        require!(min_bet > 0 && min_bet <= initial_deposit, GameError::InvalidMinBet);
        require!(roi_bps >= 1000 && roi_bps <= 10000, GameError::InvalidRoi);
        require!(timer_duration >= 60 && timer_duration <= 86400, GameError::InvalidTimer);
        require!(host_fee_bps >= 100 && host_fee_bps <= 500, GameError::InvalidHostFee);
        require!(timer_mode <= 2, GameError::InvalidTimerMode);

        let farm_check = (initial_deposit / min_bet) * roi_bps;
        require!(farm_check >= 3000, GameError::FarmingProtection);

        let token_mint = ctx.accounts.token_mint.key();
        let platform_fee_bps = ctx.accounts.config
            .token_fees.iter()
            .find(|e| e.mint == token_mint)
            .map(|e| e.fee_bps as u64)
            .unwrap_or(ctx.accounts.config.default_fee_bps as u64);

        let platform_fee = initial_deposit * platform_fee_bps / 10000;
        let net_deposit = initial_deposit - platform_fee;

        // Transfer net deposit to game vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.host_token_account.to_account_info(),
                    to: ctx.accounts.game_vault.to_account_info(),
                    authority: ctx.accounts.host.to_account_info(),
                },
            ),
            net_deposit,
        )?;

        // Transfer platform fee to platform vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.host_token_account.to_account_info(),
                    to: ctx.accounts.platform_vault.to_account_info(),
                    authority: ctx.accounts.host.to_account_info(),
                },
            ),
            platform_fee,
        )?;

        let now = Clock::get()?.unix_timestamp;

        let game = &mut ctx.accounts.game;
        game.host = ctx.accounts.host.key();
        game.name = name;
        game.token_mint = token_mint;
        game.initial_deposit = initial_deposit;
        game.pool_amount = net_deposit;
        game.min_bet = min_bet;
        game.roi_bps = roi_bps;
        game.timer_duration = timer_duration;
        game.host_fee_bps = host_fee_bps;
        game.platform_fee_bps = platform_fee_bps;
        game.timer_mode = timer_mode;
        game.time_increment = time_increment;
        game.start_time = now;
        game.timer_end = now + timer_duration;
        game.pool_balance = net_deposit;
        game.reserved_balance = 0;
        game.cumulative_per_bet = 0;
        game.last_bettor = ctx.accounts.host.key();
        game.bet_count = 0;
        game.active_bet_count = 0;
        game.is_active = true;
        game.is_paused = false;
        game.jackpot_claimed = false;
        game.platform_fees_collected = platform_fee;
        game.host_vault = ctx.accounts.host_token_account.key();
        game.bump = ctx.bumps.game;

        // Host's initial bet (not queued — game creation is always solo)
        let bet = &mut ctx.accounts.initial_bet;
        bet.game = game.key();
        bet.player = ctx.accounts.host.key();
        bet.bet_index = 0;
        bet.bet_seed = 0;
        bet.amount = initial_deposit;
        bet.net_amount = net_deposit;
        bet.roi_target = net_deposit + (net_deposit * roi_bps / 10000);
        bet.accumulated_base = net_deposit;
        bet.cumulative_at_join = 0;
        bet.is_pending = false;
        bet.reserved = false;
        bet.withdrawn = false;
        bet.bump = ctx.bumps.initial_bet;

        game.bet_count = 1;
        game.active_bet_count = 1;

        emit!(GameCreated {
            game: game.key(),
            host: game.host,
            name: game.name.clone(),
            token_mint: game.token_mint,
            initial_deposit,
            min_bet,
            roi_bps,
            timer_duration,
            host_fee_bps,
            platform_fee_bps,
            timer_mode,
            time_increment,
        });

        Ok(())
    }

    // ============================================================
    // PLACE BET — Player queues a bet. NO writes to game account.
    // Tokens go to a per-bet escrow so even vault deposits don't conflict.
    // ============================================================

    pub fn place_bet(ctx: Context<PlaceBet>, amount: u64, _bet_seed: u64) -> Result<()> {
        let game = &ctx.accounts.game; // read-only!

        require!(!ctx.accounts.config.is_paused, GameError::PlatformPaused);
        require!(!game.is_paused, GameError::GamePaused);
        require!(game.is_active, GameError::GameNotActive);
        require!(amount >= game.min_bet, GameError::BetTooSmall);

        let now = Clock::get()?.unix_timestamp;
        require!(now < game.timer_end, GameError::TimerExpired);

        // Transfer full amount to per-bet escrow (NOT the shared vault)
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player_token_account.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                    authority: ctx.accounts.player.to_account_info(),
                },
            ),
            amount,
        )?;

        // Create bet in pending state — will be filled by process_bet
        let bet = &mut ctx.accounts.bet;
        bet.game = game.key();
        bet.player = ctx.accounts.player.key();
        bet.bet_index = 0; // set by process_bet
        bet.bet_seed = _bet_seed;
        bet.amount = amount;
        bet.net_amount = 0; // set by process_bet
        bet.roi_target = 0; // set by process_bet
        bet.accumulated_base = 0;
        bet.cumulative_at_join = 0; // set by process_bet
        bet.is_pending = true;
        bet.reserved = false;
        bet.withdrawn = false;
        bet.bump = ctx.bumps.bet;

        emit!(BetQueued {
            game: game.key(),
            player: ctx.accounts.player.key(),
            bet_seed: _bet_seed,
            amount,
        });

        Ok(())
    }

    // ============================================================
    // PROCESS BET — Operator (indexer) processes a queued bet.
    // This is the only instruction that writes to the game account
    // for bet processing, so there are ZERO write conflicts.
    // ============================================================

    pub fn process_bet(ctx: Context<ProcessBet>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let bet = &mut ctx.accounts.bet;

        require!(bet.is_pending, GameError::BetNotPending);
        require!(game.is_active, GameError::GameNotActive);

        let amount = bet.amount;

        // Calculate fees using game's stored fee rates
        let platform_fee = amount * game.platform_fee_bps / 10000;
        let host_fee = amount * game.host_fee_bps / 10000;
        let net_amount = amount - platform_fee - host_fee;

        let game_host = game.host;
        let game_name = game.name.clone();
        let game_bump = game.bump;
        let seeds = &[
            b"game".as_ref(),
            game_host.as_ref(),
            game_name.as_bytes(),
            &[game_bump],
        ];

        // Transfer net amount from escrow to game vault
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow.to_account_info(),
                    to: ctx.accounts.game_vault.to_account_info(),
                    authority: game.to_account_info(),
                },
                &[seeds],
            ),
            net_amount,
        )?;

        // Transfer platform fee from escrow to platform vault
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow.to_account_info(),
                    to: ctx.accounts.platform_vault.to_account_info(),
                    authority: game.to_account_info(),
                },
                &[seeds],
            ),
            platform_fee,
        )?;

        // Transfer host fee from escrow to host vault (or game vault if closed)
        if ctx.accounts.host_vault.to_account_info().lamports() > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow.to_account_info(),
                        to: ctx.accounts.host_vault.to_account_info(),
                        authority: game.to_account_info(),
                    },
                    &[seeds],
                ),
                host_fee,
            )?;
        } else {
            // Host token account closed — redirect to game vault
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow.to_account_info(),
                        to: ctx.accounts.game_vault.to_account_info(),
                        authority: game.to_account_info(),
                    },
                    &[seeds],
                ),
                host_fee,
            )?;
            game.pool_balance += host_fee;
        }

        // Close escrow, return rent to player
        token::close_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.escrow.to_account_info(),
                    destination: ctx.accounts.bettor.to_account_info(),
                    authority: game.to_account_info(),
                },
                &[seeds],
            ),
        )?;

        // Update game state (O(1) ROI calculation)
        game.cumulative_per_bet = game.cumulative_per_bet + net_amount / game.active_bet_count;
        game.active_bet_count += 1;
        game.pool_balance += net_amount;
        game.platform_fees_collected += platform_fee;

        // Update timer
        let now = Clock::get()?.unix_timestamp;
        match game.timer_mode {
            0 => game.timer_end = now + game.timer_duration,
            1 => game.timer_end = game.timer_end + game.time_increment,
            _ => game.timer_end = now + game.timer_duration,
        }

        // Update last bettor and bet count
        game.last_bettor = bet.player;
        let bet_index = game.bet_count;
        game.bet_count += 1;

        // Fill in bet fields
        bet.bet_index = bet_index;
        bet.net_amount = net_amount;
        bet.roi_target = net_amount + (net_amount * game.roi_bps / 10000);
        bet.cumulative_at_join = game.cumulative_per_bet;
        bet.is_pending = false;

        emit!(BetPlaced {
            game: game.key(),
            player: bet.player,
            bet_index,
            bet_seed: bet.bet_seed,
            amount,
            net_amount,
            timer_end: game.timer_end,
        });

        Ok(())
    }

    // ============================================================
    // CANCEL PENDING BET — Player reclaims tokens if crank is slow
    // or game ended while bet was pending.
    // ============================================================

    pub fn cancel_pending_bet(ctx: Context<CancelPendingBet>) -> Result<()> {
        let game = &ctx.accounts.game;
        let bet = &ctx.accounts.bet;
        let game_host = game.host;
        let game_name = game.name.clone();
        let seeds = &[
            b"game".as_ref(),
            game_host.as_ref(),
            game_name.as_bytes(),
            &[game.bump],
        ];

        // Return tokens from escrow to player
        let escrow_balance = ctx.accounts.escrow.amount;
        if escrow_balance > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow.to_account_info(),
                        to: ctx.accounts.player_token_account.to_account_info(),
                        authority: game.to_account_info(),
                    },
                    &[seeds],
                ),
                escrow_balance,
            )?;
        }

        // Close escrow, rent to player
        token::close_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.escrow.to_account_info(),
                    destination: ctx.accounts.player.to_account_info(),
                    authority: game.to_account_info(),
                },
                &[seeds],
            ),
        )?;

        emit!(BetCancelled {
            game: game.key(),
            player: bet.player,
            bet_seed: bet.bet_seed,
            amount: bet.amount,
        });

        // Bet PDA closed via Anchor's close = player attribute
        Ok(())
    }

    // ============================================================
    // RESERVE ROI / WITHDRAW / JACKPOT — unchanged logic
    // ============================================================

    pub fn reserve_roi(ctx: Context<ReserveRoi>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let bet = &mut ctx.accounts.bet;

        require!(!bet.is_pending, GameError::BetNotProcessed);
        require!(!bet.reserved, GameError::AlreadyReserved);
        require!(!bet.withdrawn, GameError::AlreadyWithdrawn);

        let accumulated = bet.accumulated_base +
            (game.cumulative_per_bet - bet.cumulative_at_join);

        require!(accumulated >= bet.roi_target, GameError::RoiNotReached);

        bet.reserved = true;
        bet.accumulated_base = accumulated;
        game.reserved_balance += bet.roi_target;
        game.active_bet_count -= 1;

        emit!(RoiReserved {
            game: game.key(),
            player: bet.player,
            bet_index: bet.bet_index,
            roi_target: bet.roi_target,
        });

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let bet = &mut ctx.accounts.bet;
        let game = &mut ctx.accounts.game;
        let game_host = game.host;
        let game_name = game.name.clone();
        let seeds = &[
            b"game".as_ref(),
            game_host.as_ref(),
            game_name.as_bytes(),
            &[game.bump],
        ];

        require!(bet.reserved, GameError::NotReserved);
        require!(!bet.withdrawn, GameError::AlreadyWithdrawn);
        require!(bet.player == ctx.accounts.player.key(), GameError::Unauthorized);

        let withdrawal_amount = bet.roi_target;

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.game_vault.to_account_info(),
                    to: ctx.accounts.player_token_account.to_account_info(),
                    authority: game.to_account_info(),
                },
                &[seeds],
            ),
            withdrawal_amount,
        )?;

        bet.withdrawn = true;
        game.reserved_balance -= withdrawal_amount;
        game.pool_balance -= withdrawal_amount;

        emit!(PlayerWithdrew {
            game: game.key(),
            player: ctx.accounts.player.key(),
            bet_index: bet.bet_index,
            amount: withdrawal_amount,
        });

        Ok(())
    }

    pub fn claim_jackpot(ctx: Context<ClaimJackpot>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let game_host = game.host;
        let game_name = game.name.clone();
        let seeds = &[
            b"game".as_ref(),
            game_host.as_ref(),
            game_name.as_bytes(),
            &[game.bump],
        ];

        require!(game.is_active, GameError::GameNotActive);
        require!(!game.jackpot_claimed, GameError::JackpotAlreadyClaimed);
        require!(ctx.accounts.claimant.key() == game.last_bettor, GameError::NotLastBettor);

        let now = Clock::get()?.unix_timestamp;
        require!(now >= game.timer_end + JACKPOT_DELAY, GameError::JackpotDelayNotMet);

        let jackpot = game.pool_balance - game.reserved_balance;
        require!(jackpot > 0, GameError::EmptyJackpot);

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.game_vault.to_account_info(),
                    to: ctx.accounts.claimant_token_account.to_account_info(),
                    authority: game.to_account_info(),
                },
                &[seeds],
            ),
            jackpot,
        )?;

        game.jackpot_claimed = true;
        game.is_active = false;
        game.pool_balance -= jackpot;

        emit!(JackpotClaimed {
            game: game.key(),
            claimant: ctx.accounts.claimant.key(),
            amount: jackpot,
        });

        Ok(())
    }

    // ============================================================
    // BOUNTY (operator-controlled, mode logic lives off-chain)
    // ============================================================

    pub fn pay_bounty(ctx: Context<PayBounty>, amount: u64) -> Result<()> {
        let game = &mut ctx.accounts.game;

        require!(game.is_active, GameError::GameNotActive);
        require!(amount > 0, GameError::InvalidBountyAmount);

        let available = game.pool_balance - game.reserved_balance;
        require!(available >= amount, GameError::InsufficientPoolForBounty);

        let game_host = game.host;
        let game_name = game.name.clone();
        let seeds = &[
            b"game".as_ref(),
            game_host.as_ref(),
            game_name.as_bytes(),
            &[game.bump],
        ];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.game_vault.to_account_info(),
                    to: ctx.accounts.recipient_token_account.to_account_info(),
                    authority: game.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;

        game.pool_balance -= amount;

        emit!(BountyPaid {
            game: game.key(),
            recipient: ctx.accounts.recipient_token_account.owner,
            amount,
        });

        Ok(())
    }

    // ============================================================
    // ADMIN — GAME PAUSE
    // ============================================================

    pub fn pause_game(ctx: Context<AdminGameAction>) -> Result<()> {
        ctx.accounts.game.is_paused = true;
        Ok(())
    }

    pub fn unpause_game(ctx: Context<AdminGameAction>) -> Result<()> {
        ctx.accounts.game.is_paused = false;
        Ok(())
    }

    // ============================================================
    // CLEANUP — CLOSE ACCOUNTS, RECOVER RENT
    // ============================================================

    pub fn close_game(ctx: Context<CloseGame>) -> Result<()> {
        let game = &ctx.accounts.game;
        let game_host = game.host;
        let game_name = game.name.clone();
        let seeds = &[
            b"game".as_ref(),
            game_host.as_ref(),
            game_name.as_bytes(),
            &[game.bump],
        ];

        token::close_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.game_vault.to_account_info(),
                    destination: ctx.accounts.host.to_account_info(),
                    authority: game.to_account_info(),
                },
                &[seeds],
            ),
        )?;

        emit!(GameClosed { game: game.key() });
        Ok(())
    }

    pub fn close_bet(ctx: Context<CloseBet>) -> Result<()> {
        emit!(BetClosed {
            game: ctx.accounts.game.key(),
            bet_index: ctx.accounts.bet.bet_index,
        });
        Ok(())
    }

    pub fn admin_force_close_game(ctx: Context<AdminForceCloseGame>) -> Result<()> {
        let game = &ctx.accounts.game;
        let game_host = game.host;
        let game_name = game.name.clone();
        let seeds = &[
            b"game".as_ref(),
            game_host.as_ref(),
            game_name.as_bytes(),
            &[game.bump],
        ];

        let vault_balance = ctx.accounts.game_vault.amount;
        if vault_balance > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.game_vault.to_account_info(),
                        to: ctx.accounts.platform_vault.to_account_info(),
                        authority: game.to_account_info(),
                    },
                    &[seeds],
                ),
                vault_balance,
            )?;
        }

        token::close_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.game_vault.to_account_info(),
                    destination: ctx.accounts.host.to_account_info(),
                    authority: game.to_account_info(),
                },
                &[seeds],
            ),
        )?;

        emit!(GameClosed { game: game.key() });
        Ok(())
    }
}

// ============================================================
// ACCOUNTS
// ============================================================

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init, payer = admin,
        space = PlatformConfig::SIZE,
        seeds = [b"config"], bump
    )]
    pub config: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin)]
    pub config: Account<'info, PlatformConfig>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseConfig<'info> {
    /// CHECK: manually verified admin and handled close
    #[account(mut, seeds = [b"config"], bump)]
    pub config: UncheckedAccount<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct InitializeGame<'info> {
    #[account(
        init, payer = host,
        space = Game::SIZE,
        seeds = [b"game", host.key().as_ref(), name.as_bytes()], bump
    )]
    pub game: Account<'info, Game>,

    #[account(
        init, payer = host,
        space = Bet::SIZE,
        seeds = [b"bet", game.key().as_ref(), &0u64.to_le_bytes()], bump
    )]
    pub initial_bet: Account<'info, Bet>,

    #[account(mut)]
    pub host: Signer<'info>,

    pub token_mint: Account<'info, token::Mint>,

    #[account(
        mut,
        constraint = host_token_account.owner == host.key(),
        constraint = host_token_account.mint == token_mint.key()
    )]
    pub host_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed, payer = host,
        token::mint = token_mint, token::authority = game,
        seeds = [b"vault", game.key().as_ref()], bump
    )]
    pub game_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub platform_vault: Account<'info, TokenAccount>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// ── PlaceBet: game is READ-ONLY, player writes only to own accounts ──
#[derive(Accounts)]
#[instruction(amount: u64, bet_seed: u64)]
pub struct PlaceBet<'info> {
    /// Game is READ-ONLY — no write conflicts between simultaneous bets
    #[account(seeds = [b"game", game.host.as_ref(), game.name.as_bytes()], bump = game.bump)]
    pub game: Account<'info, Game>,

    #[account(
        init, payer = player,
        space = Bet::SIZE,
        seeds = [b"bet", game.key().as_ref(), &bet_seed.to_le_bytes()], bump
    )]
    pub bet: Account<'info, Bet>,

    /// Per-bet escrow: unique token account, no shared writes
    #[account(
        init, payer = player,
        token::mint = token_mint,
        token::authority = game,
        seeds = [b"escrow", game.key().as_ref(), &bet_seed.to_le_bytes()], bump
    )]
    pub escrow: Account<'info, TokenAccount>,

    #[account(mut)]
    pub player: Signer<'info>,

    #[account(constraint = token_mint.key() == game.token_mint)]
    pub token_mint: Account<'info, token::Mint>,

    #[account(
        mut,
        constraint = player_token_account.owner == player.key(),
        constraint = player_token_account.mint == game.token_mint
    )]
    pub player_token_account: Account<'info, TokenAccount>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// ── ProcessBet: operator-only, sequential game state updates ──
#[derive(Accounts)]
pub struct ProcessBet<'info> {
    #[account(mut, seeds = [b"game", game.host.as_ref(), game.name.as_bytes()], bump = game.bump)]
    pub game: Box<Account<'info, Game>>,

    #[account(
        mut,
        seeds = [b"bet", game.key().as_ref(), &bet.bet_seed.to_le_bytes()],
        bump = bet.bump,
        constraint = bet.game == game.key() @ GameError::Unauthorized,
        constraint = bet.is_pending @ GameError::BetNotPending,
    )]
    pub bet: Box<Account<'info, Bet>>,

    #[account(
        mut,
        seeds = [b"escrow", game.key().as_ref(), &bet.bet_seed.to_le_bytes()],
        bump,
        constraint = escrow.mint == game.token_mint,
    )]
    pub escrow: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"vault", game.key().as_ref()], bump
    )]
    pub game_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub platform_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = host_vault.key() == game.host_vault @ GameError::InvalidHostVault
    )]
    /// CHECK: validated against stored host_vault, may be closed
    pub host_vault: UncheckedAccount<'info>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, PlatformConfig>>,

    #[account(constraint = operator.key() == config.operator @ GameError::Unauthorized)]
    pub operator: Signer<'info>,

    /// CHECK: receives escrow rent refund, must be the original bettor
    #[account(mut, constraint = bettor.key() == bet.player @ GameError::Unauthorized)]
    pub bettor: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

// ── CancelPendingBet: player reclaims tokens from pending bet ──
#[derive(Accounts)]
pub struct CancelPendingBet<'info> {
    #[account(seeds = [b"game", game.host.as_ref(), game.name.as_bytes()], bump = game.bump)]
    pub game: Account<'info, Game>,

    #[account(
        mut,
        close = player,
        seeds = [b"bet", game.key().as_ref(), &bet.bet_seed.to_le_bytes()],
        bump = bet.bump,
        constraint = bet.game == game.key() @ GameError::Unauthorized,
        constraint = bet.is_pending @ GameError::BetNotPending,
        constraint = bet.player == player.key() @ GameError::Unauthorized,
    )]
    pub bet: Account<'info, Bet>,

    #[account(
        mut,
        seeds = [b"escrow", game.key().as_ref(), &bet.bet_seed.to_le_bytes()],
        bump,
    )]
    pub escrow: Account<'info, TokenAccount>,

    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        constraint = player_token_account.owner == player.key(),
        constraint = player_token_account.mint == game.token_mint
    )]
    pub player_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ReserveRoi<'info> {
    #[account(mut, seeds = [b"game", game.host.as_ref(), game.name.as_bytes()], bump = game.bump)]
    pub game: Account<'info, Game>,

    #[account(
        mut,
        seeds = [b"bet", game.key().as_ref(), &bet.bet_seed.to_le_bytes()],
        bump = bet.bump
    )]
    pub bet: Account<'info, Bet>,

    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, seeds = [b"game", game.host.as_ref(), game.name.as_bytes()], bump = game.bump)]
    pub game: Account<'info, Game>,

    #[account(
        mut,
        seeds = [b"bet", game.key().as_ref(), &bet.bet_seed.to_le_bytes()],
        bump = bet.bump
    )]
    pub bet: Account<'info, Bet>,

    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        constraint = player_token_account.owner == player.key(),
        constraint = player_token_account.mint == game.token_mint
    )]
    pub player_token_account: Account<'info, TokenAccount>,

    #[account(mut, seeds = [b"vault", game.key().as_ref()], bump)]
    pub game_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimJackpot<'info> {
    #[account(mut, seeds = [b"game", game.host.as_ref(), game.name.as_bytes()], bump = game.bump)]
    pub game: Account<'info, Game>,

    #[account(mut)]
    pub claimant: Signer<'info>,

    #[account(
        mut,
        constraint = claimant_token_account.owner == claimant.key(),
        constraint = claimant_token_account.mint == game.token_mint
    )]
    pub claimant_token_account: Account<'info, TokenAccount>,

    #[account(mut, seeds = [b"vault", game.key().as_ref()], bump)]
    pub game_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct PayBounty<'info> {
    #[account(mut, seeds = [b"game", game.host.as_ref(), game.name.as_bytes()], bump = game.bump)]
    pub game: Account<'info, Game>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,

    #[account(constraint = operator.key() == config.operator @ GameError::Unauthorized)]
    pub operator: Signer<'info>,

    #[account(mut, constraint = recipient_token_account.mint == game.token_mint)]
    pub recipient_token_account: Account<'info, TokenAccount>,

    #[account(mut, seeds = [b"vault", game.key().as_ref()], bump)]
    pub game_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminGameAction<'info> {
    #[account(
        mut,
        seeds = [b"game", game.host.as_ref(), game.name.as_bytes()],
        bump = game.bump
    )]
    pub game: Account<'info, Game>,

    #[account(seeds = [b"config"], bump = config.bump, has_one = admin)]
    pub config: Account<'info, PlatformConfig>,

    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseGame<'info> {
    #[account(
        mut, close = host,
        seeds = [b"game", game.host.as_ref(), game.name.as_bytes()],
        bump = game.bump,
        constraint = game.jackpot_claimed @ GameError::JackpotNotClaimed,
        constraint = game.pool_balance == 0 @ GameError::PoolNotEmpty,
    )]
    pub game: Account<'info, Game>,

    #[account(mut, seeds = [b"vault", game.key().as_ref()], bump)]
    pub game_vault: Account<'info, TokenAccount>,

    /// CHECK: must be game host
    #[account(mut, constraint = host.key() == game.host @ GameError::Unauthorized)]
    pub host: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CloseBet<'info> {
    #[account(seeds = [b"game", game.host.as_ref(), game.name.as_bytes()], bump = game.bump)]
    pub game: Account<'info, Game>,

    #[account(
        mut, close = recipient,
        seeds = [b"bet", game.key().as_ref(), &bet.bet_seed.to_le_bytes()],
        bump = bet.bump,
        constraint = bet.game == game.key() @ GameError::Unauthorized,
        constraint = bet.withdrawn || (!game.is_active && !bet.reserved && !bet.is_pending) @ GameError::BetNotCloseable,
    )]
    pub bet: Account<'info, Bet>,

    /// CHECK: rent goes to original bettor
    #[account(mut, constraint = recipient.key() == bet.player @ GameError::Unauthorized)]
    pub recipient: AccountInfo<'info>,

    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct AdminForceCloseGame<'info> {
    #[account(
        mut, close = host,
        seeds = [b"game", game.host.as_ref(), game.name.as_bytes()],
        bump = game.bump,
        constraint = game.jackpot_claimed @ GameError::JackpotNotClaimed,
    )]
    pub game: Account<'info, Game>,

    #[account(mut, seeds = [b"vault", game.key().as_ref()], bump)]
    pub game_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub platform_vault: Account<'info, TokenAccount>,

    #[account(seeds = [b"config"], bump = config.bump, has_one = admin)]
    pub config: Account<'info, PlatformConfig>,

    pub admin: Signer<'info>,

    /// CHECK: must be game host
    #[account(mut, constraint = host.key() == game.host @ GameError::Unauthorized)]
    pub host: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

// ============================================================
// STATE
// ============================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TokenFee {
    pub mint: Pubkey,    // 32
    pub fee_bps: u16,    // 2
}

#[account]
pub struct PlatformConfig {
    pub admin: Pubkey,              // 32
    pub operator: Pubkey,           // 32
    pub default_fee_bps: u16,       // 2
    pub token_fees: Vec<TokenFee>,  // 4 + (34 * MAX_TOKEN_FEES)
    pub is_paused: bool,            // 1
    pub bump: u8,                   // 1
}

impl PlatformConfig {
    pub const SIZE: usize = 8 + 32 + 32 + 2 + (4 + 34 * MAX_TOKEN_FEES) + 1 + 1 + 64;
}

#[account]
pub struct Game {
    pub host: Pubkey,                   // 32
    pub name: String,                   // 4 + 30
    pub token_mint: Pubkey,             // 32
    pub initial_deposit: u64,           // 8
    pub pool_amount: u64,               // 8
    pub min_bet: u64,                   // 8
    pub roi_bps: u64,                   // 8
    pub timer_duration: i64,            // 8
    pub host_fee_bps: u64,              // 8
    pub platform_fee_bps: u64,          // 8
    pub timer_mode: u8,                 // 1
    pub time_increment: i64,            // 8
    pub start_time: i64,                // 8
    pub timer_end: i64,                 // 8
    pub pool_balance: u64,              // 8
    pub reserved_balance: u64,          // 8
    pub cumulative_per_bet: u64,        // 8
    pub last_bettor: Pubkey,            // 32
    pub bet_count: u64,                 // 8
    pub is_active: bool,                // 1
    pub is_paused: bool,                // 1
    pub jackpot_claimed: bool,          // 1
    pub platform_fees_collected: u64,   // 8
    pub active_bet_count: u64,          // 8
    pub host_vault: Pubkey,             // 32
    pub bump: u8,                       // 1
}

impl Game {
    pub const SIZE: usize = 8 + 32 + (4 + 30) + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8
        + 1 + 8 + 8 + 8 + 8 + 8 + 8 + 32 + 8 + 1 + 1 + 1 + 8 + 8 + 32 + 1 + 64;
}

#[account]
pub struct Bet {
    pub game: Pubkey,           // 32
    pub player: Pubkey,         // 32
    pub bet_index: u64,         // 8
    pub bet_seed: u64,          // 8
    pub amount: u64,            // 8
    pub net_amount: u64,        // 8
    pub roi_target: u64,        // 8
    pub accumulated_base: u64,  // 8
    pub cumulative_at_join: u64,// 8
    pub is_pending: bool,       // 1
    pub reserved: bool,         // 1
    pub withdrawn: bool,        // 1
    pub bump: u8,               // 1
}

impl Bet {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 64;
}

// ============================================================
// EVENTS
// ============================================================

#[event]
pub struct GameCreated {
    pub game: Pubkey,
    pub host: Pubkey,
    pub name: String,
    pub token_mint: Pubkey,
    pub initial_deposit: u64,
    pub min_bet: u64,
    pub roi_bps: u64,
    pub timer_duration: i64,
    pub host_fee_bps: u64,
    pub platform_fee_bps: u64,
    pub timer_mode: u8,
    pub time_increment: i64,
}

/// Emitted by place_bet — bet is queued, tokens in escrow
#[event]
pub struct BetQueued {
    pub game: Pubkey,
    pub player: Pubkey,
    pub bet_seed: u64,
    pub amount: u64,
}

/// Emitted by process_bet — bet is active in the game
#[event]
pub struct BetPlaced {
    pub game: Pubkey,
    pub player: Pubkey,
    pub bet_index: u64,
    pub bet_seed: u64,
    pub amount: u64,
    pub net_amount: u64,
    pub timer_end: i64,
}

/// Emitted by cancel_pending_bet — tokens returned to player
#[event]
pub struct BetCancelled {
    pub game: Pubkey,
    pub player: Pubkey,
    pub bet_seed: u64,
    pub amount: u64,
}

#[event]
pub struct RoiReserved {
    pub game: Pubkey,
    pub player: Pubkey,
    pub bet_index: u64,
    pub roi_target: u64,
}

#[event]
pub struct PlayerWithdrew {
    pub game: Pubkey,
    pub player: Pubkey,
    pub bet_index: u64,
    pub amount: u64,
}

#[event]
pub struct JackpotClaimed {
    pub game: Pubkey,
    pub claimant: Pubkey,
    pub amount: u64,
}

#[event]
pub struct BountyPaid {
    pub game: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
}

#[event]
pub struct GameClosed {
    pub game: Pubkey,
}

#[event]
pub struct BetClosed {
    pub game: Pubkey,
    pub bet_index: u64,
}

// ============================================================
// ERRORS
// ============================================================

#[error_code]
pub enum GameError {
    #[msg("Invalid game name — must be 3-30 characters")]
    InvalidName,
    #[msg("Invalid initial deposit")]
    InvalidDeposit,
    #[msg("Invalid minimum bet")]
    InvalidMinBet,
    #[msg("Invalid ROI — must be between 10% and 100%")]
    InvalidRoi,
    #[msg("Invalid timer duration")]
    InvalidTimer,
    #[msg("Invalid host fee — must be between 1% and 5%")]
    InvalidHostFee,
    #[msg("Invalid timer mode")]
    InvalidTimerMode,
    #[msg("Game parameters too easy to farm")]
    FarmingProtection,
    #[msg("Game is not active")]
    GameNotActive,
    #[msg("Bet amount is below minimum")]
    BetTooSmall,
    #[msg("Timer has expired")]
    TimerExpired,
    #[msg("ROI target not yet reached")]
    RoiNotReached,
    #[msg("Bet already reserved")]
    AlreadyReserved,
    #[msg("Bet already withdrawn")]
    AlreadyWithdrawn,
    #[msg("Bet is not reserved")]
    NotReserved,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Only the last bettor can claim the jackpot")]
    NotLastBettor,
    #[msg("Jackpot already claimed")]
    JackpotAlreadyClaimed,
    #[msg("Jackpot delay not yet met — wait 5 minutes after timer expires")]
    JackpotDelayNotMet,
    #[msg("Jackpot is empty")]
    EmptyJackpot,
    #[msg("Invalid fee — must be between 0% and 10%")]
    InvalidFee,
    #[msg("Too many token fee overrides")]
    TooManyTokenFees,
    #[msg("Invalid host vault")]
    InvalidHostVault,
    #[msg("Platform is paused")]
    PlatformPaused,
    #[msg("Game is paused")]
    GamePaused,
    #[msg("Jackpot must be claimed before closing game")]
    JackpotNotClaimed,
    #[msg("Pool must be empty before closing game")]
    PoolNotEmpty,
    #[msg("Bet cannot be closed yet")]
    BetNotCloseable,
    #[msg("Invalid bounty amount")]
    InvalidBountyAmount,
    #[msg("Insufficient pool for bounty")]
    InsufficientPoolForBounty,
    #[msg("Bet is still pending — not yet processed")]
    BetNotProcessed,
    #[msg("Bet is not pending")]
    BetNotPending,
}