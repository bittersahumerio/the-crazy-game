'use client';
import Navbar from '@/components/Navbar';
import { useState } from 'react';

const faqs = [
  {
    q: 'What is The Crazy Game?',
    a: 'The Crazy Game is a decentralized, on-chain betting game built on Solana. Players place bets into a shared pool and compete to reach their ROI target — the point at which their bet has earned enough to be withdrawn at a profit. The last player to bet before the timer runs out wins the jackpot.',
  },
  {
    q: 'How do I play?',
    a: 'Connect your Solana wallet, find an active game, and place a bet. Every new bet extends the game timer and distributes a share of the bet amount to all existing active bettors. Once enough bets have been placed after yours, your position reaches its ROI target and you can withdraw your profit. If no new bets come in and the timer expires, the last bettor can claim the remaining pool as the jackpot.',
  },
  {
    q: 'What is the ROI target?',
    a: 'When you place a bet, a ROI target is set — this is the amount you need to accumulate before you can withdraw. Each new bet placed after yours distributes a portion of its value to all active bettors proportionally. Once your accumulated earnings reach your ROI target, your position is reserved and ready to withdraw.',
  },
  {
    q: 'What happens when the timer runs out?',
    a: 'When the timer expires, the last bettor can claim the jackpot — the remaining pool balance minus any reserved withdrawals. There is a 5-minute delay after the timer expires before the jackpot can be claimed, to ensure all pending ROI reservations are processed.',
  },
  {
    q: 'Can I create my own game?',
    a: 'Yes! Any player can host a game by going to the HOST page. You set the initial deposit, minimum bet size, ROI percentage, timer duration, timer mode, and host fee. You earn the host fee on every bet placed in your game.',
  },
  {
    q: 'What are the different timer modes?',
    a: 'Vanilla mode resets the timer to its full duration with every new bet. Cumulative mode starts with a base timer and adds a fixed increment with each bet — the timer grows over time. The host chooses the mode when creating the game.',
  },
  {
    q: 'What is Salvador Mode?',
    a: 'In a normal (Vanilla) game, only the last bettor standing when the timer expires wins. Salvador mode adds a second way to earn: a bounty for saving another player. When your bet pushes an earlier bet across its ROI target, so that player can cash out at their target, you are the one who got them there, and you collect a salvation bounty paid as a percentage of the current pool. The host picks one of three Salvador flavors: FIXED (a constant %), PROGRESSIVE (the bounty grows with each save, up to a cap), or INSANITY (each save rolls a random tier). The normal last-bettor-wins jackpot still applies on top.',
  },
  {
    q: 'What is Salvador Insanity?',
    a: (
      <>
        <p style={{ margin: '0 0 12px' }}>
          Insanity is the wildest Salvador flavor. Instead of a fixed or growing bounty, every save rolls a provably-fair, on-chain (VRF) tier. Most saves pay a small slice of the pool, but a save can rarely hit a big one, up to half the pool. Insanity games need at least a $50 pool for the roll to be enabled.
        </p>
        <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: '340px', fontSize: '13px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 500 }}>Chance</th>
              <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 500 }}>Bounty (of pool)</th>
            </tr>
          </thead>
          <tbody>
            {[['50%', '0.2%'], ['30%', '0.5%'], ['15%', '1.5%'], ['4.9%', '10%'], ['0.1%', '50%']].map(([chance, bounty]) => (
              <tr key={chance}>
                <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>{chance}</td>
                <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>{bounty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    ),
  },
  {
    q: 'What fees are charged?',
    a: 'The platform fee depends on which token the game is played in: 3% for USDC and other curated tokens, and 5% for any other token a host brings themselves. Unproven tokens carry a higher fee because platform fees are collected in that game’s own token — if it loses value, so do the fees we hold. On top of that, the host sets their own fee of 1-5%. Both are deducted from each bet, and a portion of the platform fee funds the weekly Heat pot.',
  },
  {
    q: 'Why does placing a bet cost me a little SOL?',
    a: (
      <div>
        <p style={{ marginBottom: '10px' }}>
          Placing a bet costs roughly <strong>0.005 SOL</strong> up front — but most of that is a refundable
          deposit, not a fee. Solana charges rent to create accounts, and your bet needs two of them:
        </p>
        <ul style={{ margin: '0 0 10px 18px', lineHeight: 1.8 }}>
          <li>
            <strong>~0.002 SOL — escrow account.</strong> Holds your bet until it is confirmed into the game.
            Refunded automatically, within seconds, the moment your bet is processed.
          </li>
          <li>
            <strong>~0.0024 SOL — your bet account.</strong> Tracks your position and ROI progress. Refunded when
            that account is closed: automatically when you withdraw your winnings, or with one click from the
            &quot;Reclaimable rent&quot; panel on your profile once the game has finished.
          </li>
          <li>
            <strong>~0.0004 SOL — Insanity games only.</strong> Pays for the on-chain random roll (VRF) that
            decides Salvador bounties. This one is not refundable.
          </li>
          <li>
            <strong>~0.000005 SOL — the standard Solana network fee.</strong> Not refundable.
          </li>
        </ul>
        <p>
          So in a normal game you get essentially all of it back. In an Insanity game you are out about
          0.0004 SOL per bet, which is what pays for the randomness.
        </p>
      </div>
    ),
  },
  {
    q: 'What are Seeds?',
    a: 'Seeds are airdrop points earned by playing the game. You earn Seeds proportional to the platform fees you pay, and they will count toward a future token airdrop. For now, only games played in USDC earn Seeds — support for other tokens is coming.',
  },
  {
    q: 'What is the weekly Heat?',
    a: 'Every week, a pot is funded by a portion of platform fees. Players earn Scovilles based on the SOL value of the fees they pay (1 Scoville per 0.0001 SOL), and the top players by Scovilles split the pot at the end of the week — 50% rolls over into the next week, so the pot never dies. Fees paid in any token count: they are converted to SOL, so every game feeds the Heat.',
  },
  {
    q: 'Is the game provably fair?',
    a: 'Yes. The entire game logic runs on a Solana smart contract. All bets, withdrawals, ROI calculations, and jackpot claims are on-chain and verifiable by anyone. The frontend is just a convenience layer — you can always interact with the contract directly via CLI.',
  },
  {
    q: 'What happens if the frontend goes down?',
    a: 'Your funds are safe on-chain regardless of the frontend. You can always interact with the smart contract directly using the Solana CLI or any compatible wallet. The contract is fully permissionless.',
  },
  {
    q: 'What wallets are supported?',
    a: 'Any Solana wallet that supports dApps is compatible, including Phantom, Solflare, and Backpack. Games can be played in USDC or other whitelisted tokens (such as GRID), chosen by the host when they create the game.',
  },
];

const terms = [
  {
    title: 'Acceptance of Terms',
    body: 'By accessing or using The Crazy Game platform, you agree to be bound by these Terms and Conditions. If you do not agree, do not use the platform.',
  },
  {
    title: 'Nature of the Platform',
    body: 'The Crazy Game is a decentralized application (dApp) running on the Solana blockchain. All game logic is executed by smart contracts. The platform operates without a central authority controlling outcomes. Results are determined entirely by on-chain logic and participant actions.',
  },
  {
    title: 'Eligibility',
    body: 'You must be at least 18 years of age to use this platform. By using The Crazy Game, you represent and warrant that you are at least 18 years old. It is your responsibility to ensure that your use of the platform complies with all laws and regulations applicable in your jurisdiction. The platform may not be available or legal in all jurisdictions.',
  },
  {
    title: 'Risk Disclosure',
    body: 'Participation in The Crazy Game involves significant financial risk. You may lose all funds you deposit. Cryptocurrency values are volatile. Smart contracts, while audited, may contain undiscovered vulnerabilities. Past performance does not guarantee future results. Never bet more than you can afford to lose.',
  },
  {
    title: 'No Refunds',
    body: 'All transactions are final and irreversible on the blockchain. The Crazy Game does not offer refunds on any bets placed. Once a transaction is confirmed on-chain, it cannot be reversed.',
  },
  {
    title: 'Platform Fees',
    body: 'The platform charges fees as described in the FAQ section. These fees are non-refundable and are used to fund platform operations, the weekly Heat pot, and future development.',
  },
  {
    title: 'Seeds and Airdrop',
    body: 'Seeds are points earned through platform activity. They represent a potential future airdrop allocation and have no guaranteed monetary value. The Crazy Game reserves the right to modify the Seeds system, multipliers, and airdrop terms at any time. Seeds do not constitute a security, financial instrument, or any form of investment contract.',
  },
  {
    title: 'User Conduct',
    body: 'You agree not to use the platform for any unlawful purpose, to attempt to exploit or manipulate the smart contract, or to harass other users. The platform reserves the right to ban wallet addresses from off-chain features (username, socials, chat) for violations of these terms.',
  },
  {
    title: 'Data and Privacy',
    body: 'The platform collects wallet addresses and any profile information you voluntarily provide (username, Twitter, Telegram, Discord). This data is stored off-chain on our servers and is used solely for platform functionality. We do not sell your data to third parties.',
  },
  {
    title: 'Disclaimers',
    body: 'The Crazy Game is provided "as is" without warranties of any kind. We do not guarantee uninterrupted service, freedom from bugs, or the security of the platform. In no event shall The Crazy Game be liable for any loss of funds, data, or profits arising from use of the platform.',
  },
  {
    title: 'Changes to Terms',
    body: 'We reserve the right to update these Terms and Conditions at any time. Continued use of the platform after changes are posted constitutes acceptance of the updated terms.',
  },
  {
    title: 'Contact',
    body: 'For questions or support, use the Support page on this platform.',
  },
];

function AccordionItem({ q, a, title, body }) {
  const [open, setOpen] = useState(false);
  const question = q || title;
  const answer = a || body;
  return (
    <div style={{ borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: '18px 0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
      >
        <span style={{ fontSize: '15px', color: open ? 'var(--accent)' : 'var(--text-primary)', fontWeight: 500 }}>
          {question}
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--accent)', transform: open ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, marginLeft: '16px' }}>+</span>
      </div>
      {open && (
        <div style={{ paddingBottom: '18px', fontSize: '14px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
          {answer}
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  const [section, setSection] = useState('faq');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
      <Navbar />
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '48px', color: 'var(--accent)', letterSpacing: '0.05em', marginBottom: '8px' }}>
          {section === 'faq' ? 'FAQ' : 'TERMS & CONDITIONS'}
        </h1>
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '40px' }}>
          {section === 'faq' ? 'Everything you need to know about The Crazy Game.' : 'Please read these terms carefully before using the platform.'}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '40px' }}>
          {[['faq', 'HOW TO PLAY'], ['terms', 'TERMS & CONDITIONS']].map(([key, label]) => (
            <button key={key} onClick={() => setSection(key)} style={{ padding: '8px 20px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '12px', letterSpacing: '0.08em', background: section === key ? 'var(--accent)' : 'var(--bg-card)', color: section === key ? '#000' : 'var(--text-secondary)' }}>
              {label}
            </button>
          ))}
        </div>

        <div>
          {section === 'faq'
            ? faqs.map((item, i) => <AccordionItem key={i} {...item} />)
            : terms.map((item, i) => <AccordionItem key={i} {...item} />)
          }
        </div>
      </div>
    </div>
  );
}
