# /create v10 changes — src/app/create/page.js

## Imports (add)
    import { Transaction } from '@solana/web3.js';
    import { getProgram, getGamePda, getGameVaultPda, getBetPda, CONFIG_PDA,
             SUPPORTED_TOKENS, tokenProgramFor, getTokenConfigPda, getPlatformVaultPda } from '@/lib/program';
(replace the old program.js import; TOKEN_MINT/TOKEN_PROGRAM_ID no longer hardcoded in the tx.)

## State (add)
    const [selectedToken, setSelectedToken] = useState(SUPPORTED_TOKENS[0]); // {symbol,mint,decimals,isToken2022}
salvadorMode values now: 'off' | 'fixed' | 'progressive' | 'random'.

## handleSubmit — replace the tx-building block (old lines ~150-205, the initializeGame().rpc()) with:
    const token = selectedToken;
    const mint = token.mint;
    const tokenProgram = tokenProgramFor(token);
    const dec = 10 ** token.decimals;                       // was hardcoded 1_000_000 (USDC)

    const program = getProgram(anchorWallet, connection);
    const gameName = form.name;
    const initialDeposit = new BN(Math.round(pf(form.initialDeposit) * dec));
    const minBet         = new BN(Math.round(pf(form.minBet) * dec));
    const roiBps         = new BN(Math.round(pf(form.roiPct) * 100));
    const timerDuration  = new BN(parseInt(form.timerDuration) * 60);
    const hostFeeBps     = new BN(Math.round(pf(form.hostFeePct) * 100));
    const timerMode      = form.timerMode === 'vanilla' ? 0 : form.timerMode === 'cumulative' ? 1 : 2;
    const timeIncrement  = new BN(form.timerMode !== 'vanilla' ? parseInt(form.timeIncrement) * 60 : 0);

    const salvadorModeNum = form.salvadorMode === 'off' ? 0 : form.salvadorMode === 'fixed' ? 1
                          : form.salvadorMode === 'progressive' ? 2 : 3;      // 3 = RANDOM
    const salvadorBps     = (salvadorModeNum === 1 || salvadorModeNum === 2) ? Math.round(pf(form.salvadorBps || '0') * 100) : 0;
    const salvadorStepBps = salvadorModeNum === 2 ? Math.round(pf(form.salvadorStepBps || '0') * 100) : 0;
    const salvadorCapBps  = salvadorModeNum === 2 ? Math.round(pf(form.salvadorCapBps || '0') * 100) : 0;

    const gamePda         = getGamePda(publicKey, gameName);
    const gameVaultPda    = getGameVaultPda(gamePda);
    const initialBetPda   = getBetPda(gamePda, 0);
    const tokenConfigPda  = getTokenConfigPda(mint);         // [v10] required — token must be onboarded
    const platformVaultPda= getPlatformVaultPda(mint);
    const hostTokenAccount= await getAssociatedTokenAddress(mint, publicKey, false, tokenProgram);

    // [v10] initialize_game (state; NO transfer; new tokenConfig acct) + fund_game (deposit), bundled atomically.
    const initIx = await program.methods
      .initializeGame(gameName, initialDeposit, minBet, roiBps, timerDuration, hostFeeBps,
                      timerMode, timeIncrement, salvadorModeNum, salvadorBps, salvadorStepBps, salvadorCapBps)
      .accounts({ game: gamePda, initialBet: initialBetPda, host: publicKey, tokenMint: mint,
                  config: CONFIG_PDA, tokenConfig: tokenConfigPda, systemProgram: SystemProgram.programId })
      .instruction();
    const fundIx = await program.methods
      .fundGame()
      .accounts({ game: gamePda, host: publicKey, tokenMint: mint, hostTokenAccount,
                  gameVault: gameVaultPda, platformVault: platformVaultPda, config: CONFIG_PDA,
                  tokenProgram, systemProgram: SystemProgram.programId, rent: SYSVAR_RENT_PUBKEY })
      .instruction();
    const sig = await program.provider.sendAndConfirm(new Transaction().add(initIx, fundIx));
    // (if anchor 0.30 account-resolution errors: swap .accounts(...) -> .accountsPartial(...))

## UI additions
1. TOKEN SELECTOR: card mapping SUPPORTED_TOKENS -> setSelectedToken(t). Replace hardcoded "(USDC)" labels
   with {selectedToken.symbol}. Deposit/minBet number->units uses selectedToken.decimals.
2. SALVADOR 'random' CARD: add to the modes array (near old line 436):
     { value: 'random', label: 'THE SALVADOR - RANDOM', desc: 'Each save rolls a VRF tier: usually small, rarely a jackpot' }
   Mode 'random' shows NO bps/step/cap inputs. Show a note: "Requires a >= $50 pool (per-token) and a
   random-enabled token." (the on-chain gate is random_min_pool.)
3. RANDOM FLOOR VALIDATION (client-side, mirrors contract): if salvadorMode==='random', require
   initialDeposit >= the token's random floor ($50-worth). Fetch it from the token's TokenConfig
   (getTokenConfigPda -> account.random_min_pool) OR hardcode per token. If 0 -> token not random-enabled.
4. FEE READ (v10): read fee from the selected token's TokenConfig.fee_bps (getTokenConfigPda) instead of
   the PlatformConfig token_fees scan (old useEffect ~line 108). Fallback to platform default if unset.

## Only USDC in SUPPORTED_TOKENS at launch -> the selector can be hidden/one-option until more onboarded.
