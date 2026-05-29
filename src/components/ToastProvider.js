'use client';
import { Toaster } from 'react-hot-toast';

export default function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          fontFamily: 'var(--font-body)',
        },
        success: {
          iconTheme: { primary: 'var(--accent)', secondary: '#000' },
        },
        error: {
          iconTheme: { primary: 'var(--accent-red)', secondary: '#fff' },
        },
      }}
    />
  );
}
