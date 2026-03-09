import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import idl from '../crazy_game_vanilla.json';

export const PROGRAM_ID = new PublicKey('BcXdHwCZsXva93X92wV8S9jPJUnsu4XSiNGFwhCNcjuz');
export const TOKEN_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'); // devnet USDC
export const CONFIG_PDA = new PublicKey('BJhzrWgavoQbbsTxbpqmp4wqkFRAm7t3C6ct69VovkrL');
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

export function getBetPda(gamePda, betIndex) {
  const indexBuffer = Buffer.alloc(8);
  const view = new DataView(indexBuffer.buffer);
  view.setBigUint64(0, BigInt(betIndex), true);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('bet'), gamePda.toBuffer(), indexBuffer],
    PROGRAM_ID
  );
  return pda;
}
