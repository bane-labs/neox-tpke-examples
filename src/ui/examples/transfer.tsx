'use client';

import { skipToken } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { ComponentProps, FC, useEffect, useState } from 'react';
import { isAddress } from 'viem';
import { ChainId, chains } from '@/configs/chains';
import { useBalance, useDecimals, useSymbol, useTransfer } from '@/lib/hooks/tokens';
import { accountAtom, chainIdAtom } from '@/lib/states/evm';
import { formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/shadcn';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';

export const Transfer: FC<ComponentProps<'div'>> = ({ className, ...props }) => {
  const chainId = useAtomValue(chainIdAtom);

  const account = useAtomValue(accountAtom);

  const [tokenChainId, setTokenChainId] = useState<ChainId | null>(null);

  const [tokenText, setTokenText] = useState('');

  const changeToken = (text: string) => {
    setTokenChainId(chainId);
    setTokenText(text);
  };

  const token =
    tokenText === chains[chainId].nativeCurrency.symbol
      ? null
      : isAddress(tokenText)
        ? tokenText
        : skipToken;

  const { data: balance } = useBalance(
    chainId === tokenChainId && account != null && token !== skipToken
      ? { chainId, address: token, account }
      : skipToken,
  );

  const { data: symbol } = useSymbol(
    chainId === tokenChainId && token !== skipToken ? { chainId, address: token } : skipToken,
  );

  const { data: decimals } = useDecimals(
    chainId === tokenChainId && token !== skipToken ? { chainId, address: token } : skipToken,
  );

  const [to, setTo] = useState('');

  const [amount, setAmount] = useState('');

  const { mutateAsync: mutationTransfer, isPending: transfering } = useTransfer();

  const transfer = async () => {
    // eslint-disable-next-line no-console
    console.log('🖱️  Regular transfer button clicked');
    if (
      chainId === tokenChainId &&
      account != null &&
      token !== skipToken &&
      decimals != null &&
      isAddress(to) &&
      amount !== ''
    ) {
      // eslint-disable-next-line no-console
      console.log('✅ All conditions met, starting regular transfer...');
      await mutationTransfer({ chainId, address: token, account, decimals, to, amount });
    } else {
      // eslint-disable-next-line no-console
      console.log('❌ Transfer conditions not met:', {
        chainIdMatch: chainId === tokenChainId,
        hasAccount: account != null,
        validToken: token !== skipToken,
        hasDecimals: decimals != null,
        validTo: isAddress(to),
        hasAmount: amount !== '',
      });
    }
  };

  const { mutateAsync: mutationAntiMevTransfer, isPending: antiMevTransfering } = useTransfer();

  const antiMevTransfer = async () => {
    // eslint-disable-next-line no-console
    console.log('🛡️  AntiMEV transfer button clicked');
    if (
      chainId === tokenChainId &&
      account != null &&
      token !== skipToken &&
      decimals != null &&
      isAddress(to) &&
      amount !== ''
    ) {
      // eslint-disable-next-line no-console
      console.log('✅ All conditions met, starting AntiMEV transfer...');
      await mutationAntiMevTransfer({
        chainId,
        address: token,
        account,
        decimals,
        to,
        amount,
        useAntiMev: true,
      });
    } else {
      // eslint-disable-next-line no-console
      console.log('❌ AntiMEV transfer conditions not met:', {
        chainIdMatch: chainId === tokenChainId,
        hasAccount: account != null,
        validToken: token !== skipToken,
        hasDecimals: decimals != null,
        validTo: isAddress(to),
        hasAmount: amount !== '',
      });
    }
  };

  useEffect(() => {
    setTokenChainId(chainId);
    setTokenText('');
  }, [chainId]);

  return (
    <div
      className={cn('grid w-[40rem] grid-cols-[auto_1fr] items-center gap-4', className)}
      {...props}
    >
      <div>Account:</div>
      <div>{account}</div>

      <div>Token:</div>
      <Input
        placeholder={`${chains[chainId].nativeCurrency.symbol} or 0x...`}
        value={tokenText}
        onChange={event => changeToken(event.target.value)}
      />

      <div>Balance:</div>
      <div>
        {formatNumber(balance)} {symbol}
      </div>

      <div>To:</div>
      <Input placeholder="0x..." value={to} onChange={event => setTo(event.target.value)} />

      <div>Amount:</div>
      <Input placeholder="0.00" value={amount} onChange={event => setAmount(event.target.value)} />

      <div className="col-span-2 flex items-center place-self-start">
        <Button loading={transfering} onClick={transfer}>
          Send
        </Button>

        {chains[chainId].rpcUrls.antiMev != null && (
          <>
            <Button className="ml-4" loading={antiMevTransfering} onClick={antiMevTransfer}>
              Send (AntiMEV)
            </Button>
            <div className="ml-2 text-sm text-muted-foreground">
              AntiMEV protects against MEV attacks. If it fails, try the regular Send button.
            </div>
          </>
        )}
      </div>
    </div>
  );
};
