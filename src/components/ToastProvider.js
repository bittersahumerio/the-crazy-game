'use client';
import { Toaster } from 'react-hot-toast';

export default function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#1a1a1a',
          color: '#fff',
          border: '1px solid #333',
          fontFamily: 'var(--font-body)',
        },
        success: {
          iconTheme: { primary: '#00ff88', secondary: '#000' },
        },
        error: {
          iconTheme: { primary: '#ff4444', secondary: '#000' },
        },
      }}
    />
  );
}