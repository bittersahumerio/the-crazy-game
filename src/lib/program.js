// program.v10.js — v10 anchor client (STAGED; deploy day: replace program.js with this).
// Multi-token + TokenConfig/platform_vault PDAs + token-program detection.
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getMint, getTokenMetadata } from '@solana/spl-token';
import idl from '../crazy_game_v11_idl.json';

export const PROGRAM_ID = new PublicKey('craz6HFVmz7Nuk9nSD6sxH4nbXXKF1bNPjjN3dmG4FJ');
export const CONFIG_PDA = new PublicKey('592ip99eLa7s9KrKekUyNnEzGrRPZBRbtQqqBawkzfwW');
export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
// [SOL games] wSOL is the on-chain game token for SOL-denominated games; the UI presents it as "SOL"
// and wraps/unwraps native SOL around every money path so players never handle wSOL directly.
export const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// [v10] Tokens offered on /create. USDC seeded. Add admin-onboarded tokens here AFTER onboarding
// them on-chain (admin Tokens tab: init_platform_vault + set_token_config). isToken2022 => the ATA
// and tokenProgram use the Token-2022 program; randomFloor = the token-units $50-worth gate (0 = no random).
export const SUPPORTED_TOKENS = [
  { symbol: 'USDC', mint: USDC_MINT, decimals: 6, isToken2022: false },
  { symbol: 'GRID', mint: new PublicKey('GaZ6nyh7PqrbrD9JcBPtjF2PQWewvuc3qgK54Phrpump'), decimals: 6, isToken2022: true },
  { symbol: 'SOL', mint: WSOL_MINT, decimals: 9, isToken2022: false },
];
export const TOKEN_MINT = USDC_MINT; // back-compat default

// [Insanity economics] Per-bet SOL fee for Insanity (MagicBlock VRF) games — funds the operator wallet that
// fronts the VRF cost (~0.0005 SOL/roll). Flat 0.0003 SOL is safe up to an ~80% salvation rate; paired with
// the min-ROI-50% floor (see project_tcg_custom_token_design). Admin-tunable knob (constant for now).
// Non-Insanity games (Vanilla/Fixed/Progressive) pay NO such fee.
export const OPERATOR_TREASURY = new PublicKey('79qzqdvKR4ac86TucW434Ug6PW7fghRgN7Dn9wkZ2NoE');
export const INSANITY_BET_FEE_LAMPORTS = 300_000; // 0.0003 SOL
export const INSANITY_MIN_ROI_PCT = 50;

// [Phase 3] One-time SOL fee charged to the FIRST creator who introduces a custom token (covers the operator's
// fronted onboard rent, ~0.002-0.003 SOL, + margin). Bundled in the create tx, client-side. Later games in an
// already-onboarded token pay nothing.
export const CUSTOM_TOKEN_ONBOARD_FEE_LAMPORTS = 10_000_000; // 0.01 SOL

export function tokenProgramFor(t) { return t && t.isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID; }
export function getTokenBySymbol(sym) { return SUPPORTED_TOKENS.find(t => t.symbol === sym) || SUPPORTED_TOKENS[0]; }
export function getTokenByMint(mint) { const m = mint.toBase58 ? mint.toBase58() : String(mint); return SUPPORTED_TOKENS.find(t => t.mint.toBase58() === m); }

export function getProgram(wallet, connection) {
  return new Program(idl, new AnchorProvider(connection, wallet, { commitment: 'confirmed' }));
}

export function getGamePda(hostPublicKey, gameName) {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('game'), hostPublicKey.toBuffer(), Buffer.from(gameName)], PROGRAM_ID);
  return pda;
}
export function getGameVaultPda(gamePda) {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('vault'), gamePda.toBuffer()], PROGRAM_ID);
  return pda;
}
// [v14] Per-game host-fee vault: a program PDA token account whose token authority is the HOST. process_bet
// deposits the host fee here; the host collects it with a plain host-signed transfer/close. Derivable from the
// game PDA alone (no on-chain read), so it works even after the game account is closed.
export function getHostFeeVaultPda(gamePda) {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('host_fee'), gamePda.toBuffer()], PROGRAM_ID);
  return pda;
}
export function getBetPda(gamePda, seed) {
  const b = Buffer.alloc(8); new DataView(b.buffer).setBigUint64(0, BigInt(seed), true);
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('bet'), gamePda.toBuffer(), b], PROGRAM_ID);
  return pda;
}
export function getEscrowPda(gamePda, seed) {
  const b = Buffer.alloc(8); new DataView(b.buffer).setBigUint64(0, BigInt(seed), true);
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('escrow'), gamePda.toBuffer(), b], PROGRAM_ID);
  return pda;
}
export function generateBetSeed() {
  const arr = new Uint8Array(8); crypto.getRandomValues(arr);
  return new DataView(arr.buffer).getBigUint64(0, true);
}

// [v10] new PDAs
export function getTokenConfigPda(mint) {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('token_config'), new PublicKey(mint).toBuffer()], PROGRAM_ID);
  return pda;
}
export function getPlatformVaultPda(mint) {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('platform_vault'), new PublicKey(mint).toBuffer()], PROGRAM_ID);
  return pda;
}
// Detect a mint's token program from its on-chain owner (fallback for tokens not in SUPPORTED_TOKENS).
export async function detectTokenProgram(connection, mint) {
  const info = await connection.getAccountInfo(new PublicKey(mint));
  return (info && info.owner.equals(TOKEN_2022_PROGRAM_ID)) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
}

// [v10] AUTOMATIC per-mint token info — reads decimals + token program + symbol ON-CHAIN (cached),
// so ANY onboarded mint works everywhere with zero hardcoding.
const _tokenInfoCache = {};
const KNOWN_SYMBOLS = { 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC', 'So11111111111111111111111111111111111111112': 'SOL' };
export async function getTokenInfo(connection, mint) {
  const key = mint && mint.toBase58 ? mint.toBase58() : String(mint);
  if (_tokenInfoCache[key]) return _tokenInfoCache[key];
  const mintPk = new PublicKey(key);
  const info = await connection.getAccountInfo(mintPk);
  const tokenProgram = (info && info.owner.equals(TOKEN_2022_PROGRAM_ID)) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const m = await getMint(connection, mintPk, 'confirmed', tokenProgram);
  let symbol = KNOWN_SYMBOLS[key] || null;
  let image = null;
  let name = null;
  // [2026-07-13] Primary source: backend DAS getAsset -> real name/symbol/logo for ANY token (classic SPL OR
  // Token-2022). Server-side (needs the Helius key). This is what makes launchpad tokens show a real identity
  // instead of a mint fragment. Backend caches per mint.
  const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
  try {
    const r = await fetch(`${API_URL}/api/tokens/${key}/meta`);
    if (r.ok) {
      const md = await r.json();
      if (md) {
        if (md.name) name = md.name;
        if (!symbol && md.symbol) symbol = md.symbol;
        if (md.image) image = md.image;
      }
    }
  } catch (e) {}
  // Fallback: Token-2022 on-chain metadata if DAS was unavailable / gave nothing (keeps cards working if the
  // backend is down). Classic-SPL tokens have no on-chain fallback here -> letter badge, as before.
  if ((!symbol || !image || !name) && tokenProgram.equals(TOKEN_2022_PROGRAM_ID)) {
    try {
      const md = await getTokenMetadata(connection, mintPk, 'confirmed', tokenProgram);
      if (md) {
        if (!symbol && md.symbol) symbol = md.symbol.trim();
        if (!name && md.name) name = md.name.trim();
        if (!image && md.uri) { try { const j = await (await fetch(md.uri)).json(); if (j && j.image) image = j.image; } catch (e) {} }
      }
    } catch (e) {}
  }
  if (!symbol) symbol = key.slice(0, 4).toUpperCase();
  const result = { mint: mintPk, decimals: m.decimals, tokenProgram, isToken2022: tokenProgram.equals(TOKEN_2022_PROGRAM_ID), symbol, image, name };
  _tokenInfoCache[key] = result;
  return result;
}

// [v10] The ONBOARDED tokens (every TokenConfig on-chain) with on-chain info + config. Onboard a mint
// (set_token_config) and it auto-appears here — no code change. NOTE: this uses getProgramAccounts
// (account.all()), which the browser RPC proxy BLOCKS. Use it only server-side (full-node RPC).
// In the browser, use getSelectableTokens() below, which relies on single-account reads.
export async function getOnboardedTokens(program, connection) {
  const configs = await program.account.tokenConfig.all();
  const out = [];
  for (const c of configs) {
    try {
      const ti = await getTokenInfo(connection, c.account.mint);
      out.push({ ...ti, feeBps: c.account.feeBps, minBetFloor: c.account.minBetFloor, randomMinPool: c.account.randomMinPool });
    } catch (e) { /* skip unreadable mint */ }
  }
  return out;
}

// [v10] Read one mint's on-chain TokenConfig (fee + floors) with a SINGLE getAccountInfo — no
// getProgramAccounts, so it works through the browser RPC proxy (which blocks gPA). Returns null if
// the mint isn't onboarded. Layout after the 8-byte discriminator: 32 mint, u16 fee_bps,
// u64 min_bet_floor, u64 random_min_pool, u8 bump (offsets are anchored at the front).
export async function getTokenConfigOnChain(connection, mint) {
  const info = await connection.getAccountInfo(getTokenConfigPda(mint));
  if (!info) return null;
  const b = info.data;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return {
    feeBps: dv.getUint16(40, true),
    minBetFloor: dv.getBigUint64(42, true).toString(),
    randomMinPool: dv.getBigUint64(50, true).toString(),
  };
}

// [v10] Tokens offered on /create, each fully described FROM CHAIN (decimals, token program, symbol,
// fee, and min-bet / random-pool floors). SUPPORTED_TOKENS is only the candidate mint list; any
// candidate without an on-chain TokenConfig is dropped. Single-account reads only (proxy-safe), so a
// newly-onboarded mint becomes fully playable the moment its address is added to SUPPORTED_TOKENS —
// with no per-mint decimals/fee/floor code. (Full zero-config enumeration needs server-side gPA.)
export async function getSelectableTokens(connection) {
  const out = [];
  for (const t of SUPPORTED_TOKENS) {
    try {
      const cfg = await getTokenConfigOnChain(connection, t.mint);
      if (!cfg) continue;
      const ti = await getTokenInfo(connection, t.mint);
      out.push({ ...ti, feeBps: cfg.feeBps, minBetFloor: cfg.minBetFloor, randomMinPool: cfg.randomMinPool });
    } catch (e) { /* skip */ }
  }
  return out;
}
