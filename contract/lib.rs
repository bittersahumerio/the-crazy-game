use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("BcXdHwCZsXva93X92wV8S9jPJUnsu4XSiNGFwhCNcjuz");

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
        config.default_fee_bps = default_fee_bps;
        config.token_fees = Vec::new();
        config.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn update_default_fee(
        ctx: Context<UpdateConfig>,
        default_fee_bps: u16,
    ) -> Result<()> {
        require!(default_fee_bps <= 1000, GameError::InvalidFee); // max 10%
        ctx.accounts.config.default_fee_bps = default_fee_bps;
        Ok(())
    }

    pub fn set_token_fee(
        ctx: Context<UpdateConfig>,
        mint: Pubkey,
        fee_bps: u16,
    ) -> Result<()> {
        require!(fee_bps <= 1000, GameError::InvalidFee); // max 10%
        let config = &mut ctx.accounts.config;

        // Update existing or add new
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
        let config = &mut ctx.accounts.config;
        config.token_fees.retain(|e| e.mint != mint);
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
        // Validations
        require!(name.len() >= 3 && name.len() <= 30, GameError::InvalidName);
        require!(initial_deposit > 0, GameError::InvalidDeposit);
        require!(min_bet > 0 && min_bet <= initial_deposit, GameError::InvalidMinBet);
        require!(roi_bps >= 1000 && roi_bps <= 100000, GameError::InvalidRoi);
        require!(timer_duration >= 60 && timer_duration <= 86400, GameError::InvalidTimer);
        require!(host_fee_bps >= 100 && host_fee_bps <= 500, GameError::InvalidHostFee);
        require!(timer_mode <= 2, GameError::InvalidTimerMode);

        // Farming protection
        let farm_check = (initial_deposit / min_bet) * roi_bps;
        require!(farm_check >= 3000, GameError::FarmingProtection);

        // Get platform fee from config (per-token override or default)
        let token_mint = ctx.accounts.token_mint.key();
        let platform_fee_bps = ctx.accounts.config
            .token_fees
            .iter()
            .find(|e| e.mint == token_mint)
            .map(|e| e.fee_bps as u64)
            .unwrap_or(ctx.accounts.config.default_fee_bps as u64);

        // Calculate fees
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
        game.jackpot_claimed = false;
        game.platform_fees_collected = platform_fee;
        game.bump = ctx.bumps.game;

        // Record host's initial bet
        let bet = &mut ctx.accounts.initial_bet;
        bet.game = game.key();
        bet.player = ctx.accounts.host.key();
        bet.bet_index = 0;
        bet.amount = initial_deposit;
        bet.net_amount = net_deposit;
        bet.roi_target = net_deposit + (net_deposit * roi_bps / 10000);
        bet.accumulated_base = net_deposit;
        bet.cumulative_at_join = 0;
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

    pub fn place_bet(ctx: Context<PlaceBet>, amount: u64) -> Result<()> {
        let game = &mut ctx.accounts.game;

        require!(game.is_active, GameError::GameNotActive);
        require!(amount >= game.min_bet, GameError::BetTooSmall);

        let now = Clock::get()?.unix_timestamp;
        require!(now < game.timer_end, GameError::TimerExpired);

        // Use platform_fee_bps stored at game creation time
        let platform_fee = amount * game.platform_fee_bps / 10000;
        let host_fee = amount * game.host_fee_bps / 10000;
        let net_amount = amount - platform_fee - host_fee;
        // Transfer net amount to game vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player_token_account.to_account_info(),
                    to: ctx.accounts.game_vault.to_account_info(),
                    authority: ctx.accounts.player.to_account_info(),
                },
            ),
            net_amount,
        )?;

        // Transfer platform fee to platform vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player_token_account.to_account_info(),
                    to: ctx.accounts.platform_vault.to_account_info(),
                    authority: ctx.accounts.player.to_account_info(),
                },
            ),
            platform_fee,
        )?;

        // Transfer host fee to host vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player_token_account.to_account_info(),
                    to: ctx.accounts.host_vault.to_account_info(),
                    authority: ctx.accounts.player.to_account_info(),
                },
            ),
            host_fee,
        )?;

        // Update cumulative per bet (O(1) ROI calculation)
        game.cumulative_per_bet = game.cumulative_per_bet + net_amount / game.active_bet_count;
        game.active_bet_count += 1;
        game.pool_balance += net_amount;
        game.platform_fees_collected += platform_fee;

        // Update timer based on mode
        match game.timer_mode {
            0 => game.timer_end = now + game.timer_duration,
            1 => game.timer_end = game.timer_end + game.time_increment,
            _ => game.timer_end = now + game.timer_duration,
        }

        // Update last bettor and bet count
        game.last_bettor = ctx.accounts.player.key();
        let bet_index = game.bet_count;
        game.bet_count += 1;

        // Record bet
        let bet = &mut ctx.accounts.bet;
        bet.game = game.key();
        bet.player = ctx.accounts.player.key();
        bet.bet_index = bet_index;
        bet.amount = amount;
        bet.net_amount = net_amount;
        bet.roi_target = net_amount + (net_amount * game.roi_bps / 10000);
        bet.accumulated_base = 0;
        bet.cumulative_at_join = game.cumulative_per_bet;
        bet.reserved = false;
        bet.withdrawn = false;
        bet.bump = ctx.bumps.bet;

        emit!(BetPlaced {
            game: game.key(),
            player: ctx.accounts.player.key(),
            bet_index,
            amount,
            net_amount,
            timer_end: game.timer_end,
        });

        Ok(())
    }

    pub fn reserve_roi(ctx: Context<ReserveRoi>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let bet = &mut ctx.accounts.bet;

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
}

// ============================================================
// ACCOUNTS
// ============================================================

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = PlatformConfig::SIZE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin
    )]
    pub config: Account<'info, PlatformConfig>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct InitializeGame<'info> {
    #[account(
        init,
        payer = host,
        space = Game::SIZE,
        seeds = [b"game", host.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,

    #[account(
        init,
        payer = host,
        space = Bet::SIZE,
        seeds = [b"bet", game.key().as_ref(), &0u64.to_le_bytes()],
        bump
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
        init_if_needed,
        payer = host,
        token::mint = token_mint,
        token::authority = game,
        seeds = [b"vault", game.key().as_ref()],
        bump
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

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut, seeds = [b"game", game.host.as_ref(), game.name.as_bytes()], bump = game.bump)]
    pub game: Account<'info, Game>,

    #[account(
        init,
        payer = player,
        space = Bet::SIZE,
        seeds = [b"bet", game.key().as_ref(), &game.bet_count.to_le_bytes()],
        bump
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

    #[account(
        mut,
        seeds = [b"vault", game.key().as_ref()],
        bump
    )]
    pub game_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub platform_vault: Account<'info, TokenAccount>,
     #[account(
        mut,
        constraint = host_vault.owner == game.host,
        constraint = host_vault.mint == game.token_mint
    )]
    pub host_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ReserveRoi<'info> {
    #[account(mut, seeds = [b"game", game.host.as_ref(), game.name.as_bytes()], bump = game.bump)]
    pub game: Account<'info, Game>,

    #[account(
        mut,
        seeds = [b"bet", game.key().as_ref(), &bet.bet_index.to_le_bytes()],
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
        seeds = [b"bet", game.key().as_ref(), &bet.bet_index.to_le_bytes()],
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

    #[account(
        mut,
        seeds = [b"vault", game.key().as_ref()],
        bump
    )]
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

    #[account(
        mut,
        seeds = [b"vault", game.key().as_ref()],
        bump
    )]
    pub game_vault: Account<'info, TokenAccount>,

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
    pub default_fee_bps: u16,      // 2
    pub token_fees: Vec<TokenFee>, // 4 + (34 * MAX_TOKEN_FEES)
    pub bump: u8,                   // 1
}

impl PlatformConfig {
    pub const SIZE: usize = 8 + 32 + 2 + (4 + 34 * MAX_TOKEN_FEES) + 1 + 64;
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
    pub jackpot_claimed: bool,          // 1
    pub platform_fees_collected: u64,   // 8
    pub active_bet_count: u64,          // 8
    pub bump: u8,                       // 1
}

impl Game {
    pub const SIZE: usize = 8 + 32 + (4 + 30) + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 8 + 8 + 8 + 8 + 8 + 32 + 8 + 1 + 1 + 8 + 8 + 1 + 64;
}

#[account]
pub struct Bet {
    pub game: Pubkey,           // 32
    pub player: Pubkey,         // 32
    pub bet_index: u64,         // 8
    pub amount: u64,            // 8
    pub net_amount: u64,        // 8
    pub roi_target: u64,        // 8
    pub accumulated_base: u64,  // 8
    pub cumulative_at_join: u64,// 8
    pub reserved: bool,         // 1
    pub withdrawn: bool,        // 1
    pub bump: u8,               // 1
}

impl Bet {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 64;
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

#[event]
pub struct BetPlaced {
    pub game: Pubkey,
    pub player: Pubkey,
    pub bet_index: u64,
    pub amount: u64,
    pub net_amount: u64,
    pub timer_end: i64,
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
    #[msg("Invalid ROI — must be between 10% and 1000%")]
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
}