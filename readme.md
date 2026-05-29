# The Crazy Game

A decentralized last-bettor-wins game built on Solana.

## How It Works

Each game has a pool and a countdown timer. Players place bets to earn ROI — when enough bets accumulate, early players can withdraw their returns. The last player to bet before the timer runs out wins the entire remaining pool as the jackpot.

- **Place a bet** — contribute to the pool and start accumulating ROI
- **Withdraw** — once your ROI target is reached, withdraw your returns at any time
- **Win the jackpot** — be the last bettor when the timer expires

## Game Modes

- **Vanilla** — timer resets to full on each bet
- **Cumulative** — each bet adds a fixed amount of time
- **Random** — each bet adds a random amount of time (VRF)

## Repository Structure

```
/                   — Next.js frontend
contract/           — Solana smart contract (Rust/Anchor)
```

## Tech Stack

- **Frontend:** Next.js, Solana Wallet Adapter
- **Smart Contract:** Rust, Anchor Framework
- **Chain:** Solana

## Smart Contract

The contract is fully open source. Core mechanics:

- O(1) ROI calculation via cumulative accounting
- Reserved balance system to protect player funds from jackpot claims
- 5-minute jackpot delay after timer expiry
- Permissionless `reserve_roi` instruction
- Platform fee: 1% (USDC)
- Host fee: 1-5% (set by game host)

## Links

- [Play](https://thecrazygame.com) — coming soon
- [Leaderboard](https://thecrazygame.com/leaderboard) — coming soon

## License

