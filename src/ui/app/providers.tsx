'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Provider as JotaiProvider } from 'jotai';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { FC, ReactNode, useEffect, useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { store } from '@/lib/utils/jotai';
import { queryClient } from '@/lib/utils/react-query';
import { wagmiConfig } from '@/lib/utils/wagmi';
import { Toaster } from '@/ui/shadcn/sonner';
import { ErrorHandler } from './error-handler';
import { RainbowKitProvider } from './rainbow-kit-provider';

const ClientOnlyComponents: FC<{ children: ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <>
      <ReactQueryDevtools />
      <Toaster />
      <ErrorHandler />
      {children}
    </>
  );
};

export const Providers: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <JotaiProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <NextThemesProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <RainbowKitProvider>
              <ClientOnlyComponents>{children}</ClientOnlyComponents>
            </RainbowKitProvider>
          </NextThemesProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </JotaiProvider>
  );
};
