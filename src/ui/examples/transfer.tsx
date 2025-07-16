'use client';

import { skipToken } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { ComponentProps, FC, useEffect, useState } from 'react';
import { isAddress } from 'viem';
import { ChainId, chains } from '@/configs/chains';
import { useBalance, useDecimals, useSymbol, useTransfer } from '@/lib/hooks/tokens';
import { useTransferSteps } from '@/lib/hooks/transfer-steps';
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

  const { steps, addStep, updateStep, clearSteps, startTracking, stopTracking } =
    useTransferSteps();

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
    if (
      chainId === tokenChainId &&
      account != null &&
      token !== skipToken &&
      decimals != null &&
      isAddress(to) &&
      amount !== ''
    ) {
      startTracking();
      try {
        await mutationTransfer({
          chainId,
          address: token,
          account,
          decimals,
          to,
          amount,
          onStep: addStep,
          onUpdateStep: updateStep,
        });
        stopTracking();
      } catch (error) {
        stopTracking();
        throw error;
      }
    }
  };

  const { mutateAsync: mutationAntiMevTransfer, isPending: antiMevTransfering } = useTransfer();

  const antiMevTransfer = async () => {
    if (
      chainId === tokenChainId &&
      account != null &&
      token !== skipToken &&
      decimals != null &&
      isAddress(to) &&
      amount !== ''
    ) {
      startTracking();
      try {
        await mutationAntiMevTransfer({
          chainId,
          address: token,
          account,
          decimals,
          to,
          amount,
          useAntiMev: true,
          onStep: addStep,
          onUpdateStep: updateStep,
        });
        stopTracking();
      } catch (error) {
        stopTracking();
        throw error;
      }
    }
  };

  useEffect(() => {
    setTokenChainId(chainId);
    setTokenText('');
    clearSteps();
  }, [chainId, clearSteps]);

  const formatStepData = (data?: Record<string, unknown>) => {
    if (data == null) return null;

    return Object.entries(data).map(([key, value]) => {
      let formattedValue: string;
      if (typeof value === 'object' && value != null) {
        formattedValue = JSON.stringify(value);
      } else {
        formattedValue = String(value);
      }

      return (
        <div key={key} className="mb-1">
          <span className="font-semibold text-gray-800 dark:text-gray-200">{key}:</span>{' '}
          <span className="break-all">{formattedValue}</span>
        </div>
      );
    });
  };

  return (
    <div className={cn('w-full max-w-4xl', className)} {...props}>
      <div className="grid w-[40rem] grid-cols-[auto_1fr] items-center gap-4">
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
        <Input
          placeholder="0.00"
          value={amount}
          onChange={event => setAmount(event.target.value)}
        />

        <div className="col-span-2 flex items-center place-self-start">
          <Button loading={transfering} onClick={transfer}>
            Send
          </Button>

          {chains[chainId].rpcUrls.antiMev != null && (
            <Button className="ml-4" loading={antiMevTransfering} onClick={antiMevTransfer}>
              Send (AntiMEV)
            </Button>
          )}

          <Button
            variant="outline"
            className="ml-4"
            onClick={clearSteps}
            disabled={transfering || antiMevTransfering}
          >
            Clear Steps
          </Button>
        </div>
      </div>

      {/* Steps Canvas */}
      {steps.length > 0 && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            🔍 Transfer Process Steps
          </h3>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-start space-x-3 rounded-md border p-3 text-sm',
                  step.status === 'success' &&
                    'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
                  step.status === 'error' &&
                    'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
                  step.status === 'pending' &&
                    'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20',
                )}
              >
                <div className="flex-shrink-0">
                  <span className="text-lg">{step.emoji}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {index + 1}. {step.title}
                    </span>
                    <div
                      className={cn(
                        'inline-flex h-2 w-2 rounded-full',
                        step.status === 'success' && 'bg-green-500',
                        step.status === 'error' && 'bg-red-500',
                        step.status === 'pending' && 'animate-pulse bg-yellow-500',
                      )}
                    />
                  </div>
                  {step.description != null && step.description !== '' && (
                    <p className="mt-1 text-gray-600 dark:text-gray-300">{step.description}</p>
                  )}
                  {step.data != null && (
                    <div className="mt-2 max-h-32 overflow-y-auto rounded bg-gray-100 px-3 py-2 font-mono text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      {formatStepData(step.data)}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {step.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
