'use client';

import { useEffect, useState } from 'react';
import { Transfer } from '@/ui/examples/transfer';

const HydrationSafeTransfer = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="container">
        <div className="grid w-[40rem] grid-cols-[auto_1fr] items-center gap-4">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Transfer />
    </div>
  );
};

export default function Page() {
  return <HydrationSafeTransfer />;
}
