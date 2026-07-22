# Admin "TOKENS" tab — src/app/claroscuro/page.js (add a sidebar item + card)

## Imports (add): getTokenConfigPda, getPlatformVaultPda, detectTokenProgram from '@/lib/program';
   SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, PublicKey from '@solana/web3.js'; BN from '@coral-xyz/anchor'.

## Core action — onboard or update a token (operator/admin wallet signs):
    async function onboardToken({ mintStr, feeBps, minBetFloorUsd, randomMinPoolUsd, decimals }) {
      const program = getProgram(anchorWallet, connection);
      const mint = new PublicKey(mintStr);
      const tokenProgram = await detectTokenProgram(connection, mint);
      const platformVault = getPlatformVaultPda(mint);
      const tokenConfig   = getTokenConfigPda(mint);
      const unit = 10 ** decimals;
      const ixs = [];
      // init_platform_vault ONCE per mint (skip if the vault already exists)
      if (!(await connection.getAccountInfo(platformVault))) {
        ixs.push(await program.methods.initPlatformVault()
          .accounts({ payer: publicKey, tokenMint: mint, platformVault, config: CONFIG_PDA,
                      tokenProgram, systemProgram: SystemProgram.programId, rent: SYSVAR_RENT_PUBKEY })
          .instruction());
      }
      // set_token_config(fee_bps u16, min_bet_floor u64, random_min_pool u64) — floors in TOKEN UNITS.
      // random_min_pool = 0 disables random Salvador for this token; = $50-worth enables it + is the gate.
      ixs.push(await program.methods
        .setTokenConfig(feeBps, new BN(Math.round(minBetFloorUsd * unit)), new BN(Math.round(randomMinPoolUsd * unit)))
        .accounts({ tokenConfig, tokenMint: mint, config: CONFIG_PDA, operator: publicKey, systemProgram: SystemProgram.programId })
        .instruction());
      return await program.provider.sendAndConfirm(new Transaction().add(...ixs));
    }

## UI: sidebar item "TOKENS"; a card with a form: mint address, decimals, fee % (->bps),
##     min-bet floor $ (USDC ~0.50), random-pool floor $ (e.g. 50; 0 = no random). Submit -> onboardToken().
##     List existing TokenConfig PDAs (read getTokenConfigPda for known mints) showing fee/floors.

## AT LAUNCH the single must-do: onboard USDC BEFORE any game can be created (initialize_game requires the
##   tokenConfig acct to exist). USDC: decimals 6, fee = current platform default (e.g. 100 bps),
##   minBetFloorUsd = 0.50, randomMinPoolUsd = 50. Then add USDC to SUPPORTED_TOKENS (already seeded).
