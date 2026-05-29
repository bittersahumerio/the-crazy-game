'use client';
import { usePlatformStatus } from '@/hooks/usePlatformStatus';

export default function PausedBanner() {
  const { paused } = usePlatformStatus();
  if (!paused) return null;

  return (
    <div style={{
      background: 'var(--accent-red)',
      color: '#fff',
      padding: '10px 16px',
      textAlign: 'center',
      fontFamily: 'var(--font-body)',
      fontSize: '13px',
      letterSpacing: '0.05em',
      fontWeight: '600',
      position: 'sticky',
      top: 0,
      zIndex: 150,
      borderBottom: '1px solid rgba(0,0,0,0.3)',
    }}>
      ⚠ PLATFORM PAUSED &mdash; betting is temporarily disabled. We'll be back shortly.
    </div>
  );
}
