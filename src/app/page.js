'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      localStorage.setItem('referral_code', ref);
    }
    router.replace('/games');
  }, []);

  return null;
}

export default function Home() {
  return <Suspense fallback={null}><HomeInner /></Suspense>;
}
