'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get('ref');
    console.log('ReferralCapture: ref param =', ref, 'stored =', localStorage.getItem('referral_code'));
    if (ref && !localStorage.getItem('referral_code')) {
      localStorage.setItem('referral_code', ref);
      console.log('ReferralCapture: saved ref code', ref);
    }
  }, [searchParams]);

  return null;
}
