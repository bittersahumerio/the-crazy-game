// program.v10.js — v10 anchor client (STAGED; deploy day: replace program.js with this).
// Multi-token + TokenConfig/platform_vault PDAs + token-program detection.
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import idl from '../crazy_game_v11_idl.json';

export const PROGRAM_ID = new PublicKey('craz6HFVmz7Nuk9nSD6sxH4nbXXKF1bNPjjN3dmG4FJ');
export const CONFIG_PDA = new PublicKey('592ip99eLa7s9KrKekUyNnEzGrRPZBRbtQqqBawkzfwW');
export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// [v10] Tokens offered on /create. USDC seeded. Add admin-onboarded tokens here AFTER onboarding
// them on-chain (admin Tokens tab: init_platform_vault + set_token_config). isToken2022 => the ATA
// and tokenProgram use the Token-2022 program; randomFloor = the token-units $50-worth gate (0 = no random).
export const SUPPORTED_TOKENS = [
  { symbol: 'USDC', mint: USDC_MINT, decimals: 6, isToken2022: false },
];
export const TOKEN_MINT = USDC_MINT; // back-compat default

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
