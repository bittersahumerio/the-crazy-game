import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import idl from '../crazy_game_vanilla.json';

export const PROGRAM_ID = new PublicKey('craz6HFVmz7Nuk9nSD6sxH4nbXXKF1bNPjjN3dmG4FJ');
export const TOKEN_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // mainnet USDC
export const CONFIG_PDA = new PublicKey('592ip99eLa7s9KrKekUyNnEzGrRPZBRbtQqqBawkzfwW');
export function getProgram(wallet, connection) {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  return new Program(idl, provider);
}

export function getGamePda(hostPublicKey, gameName) {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('game'),
      hostPublicKey.toBuffer(),
      Buffer.from(gameName),
    ],
    PROGRAM_ID
  );
  return pda;
}

export function getGameVaultPda(gamePda) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), gamePda.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

export function getBetPda(gamePda, seed) {
  const seedBuffer = Buffer.alloc(8);
  const view = new DataView(seedBuffer.buffer);
  view.setBigUint64(0, BigInt(seed), true);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('bet'), gamePda.toBuffer(), seedBuffer],
    PROGRAM_ID
  );
  return pda;
}

export function getEscrowPda(gamePda, seed) {
  const seedBuffer = Buffer.alloc(8);
  const view = new DataView(seedBuffer.buffer);
  view.setBigUint64(0, BigInt(seed), true);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), gamePda.toBuffer(), seedBuffer],
    PROGRAM_ID
  );
  return pda;
}

export function generateBetSeed() {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  const view = new DataView(arr.buffer);
  return view.getBigUint64(0, true);
}
