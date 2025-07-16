import { SkipToken, skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { waitForTransactionReceipt } from '@wagmi/core';
import {
  getBalance,
  GetBalanceParams,
  getDecimals,
  GetDecimalsParams,
  getSymbol,
  GetSymbolParams,
  transfer,
  TransferParams,
} from '../apis/tokens';
import { wagmiConfig } from '../utils/wagmi';

export function useDecimals(params: GetDecimalsParams | SkipToken) {
  return useQuery({
    queryKey: ['decimals', params],
    queryFn:
      params !== skipToken
        ? async () => {
            return await getDecimals(params);
          }
        : skipToken,
    staleTime: Infinity,
  });
}

export function useSymbol(params: GetSymbolParams | SkipToken) {
  return useQuery({
    queryKey: ['symbol', params],
    queryFn:
      params !== skipToken
        ? async () => {
            return await getSymbol(params);
          }
        : skipToken,
    staleTime: Infinity,
  });
}

export type UseBalanceParams = Omit<GetBalanceParams, 'decimals'>;

export function useBalance(params: UseBalanceParams | SkipToken) {
  const { data: decimals } = useDecimals(
    params !== skipToken ? { chainId: params.chainId, address: params.address } : skipToken,
  );

  const apiParams = params !== skipToken && decimals != null ? { ...params, decimals } : skipToken;

  return useQuery({
    queryKey: ['balance', apiParams],
    queryFn:
      apiParams !== skipToken
        ? async () => {
            return await getBalance(apiParams);
          }
        : skipToken,
  });
}

export function useTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: TransferParams) => {
      const { onStep, onUpdateStep } = params;

      const hash = await transfer(params);

      // Add transaction confirmation step
      const confirmStepId = onStep?.({
        emoji: '⏳',
        title: 'Waiting for transaction confirmation',
        description: 'Monitoring blockchain for transaction inclusion',
        data: { transactionHash: hash },
      });

      try {
        const receipt = await waitForTransactionReceipt(wagmiConfig, {
          chainId: params.chainId,
          hash,
        });

        if (confirmStepId != null) {
          onUpdateStep?.(confirmStepId, {
            status: 'success',
            data: {
              transactionHash: hash,
              blockNumber: receipt.blockNumber.toString(),
              gasUsed: receipt.gasUsed.toString(),
              status: receipt.status,
            },
          });
        }

        // Add final confirmation step
        const finalConfirmStepId = onStep?.({
          emoji: '✅',
          title: 'Transaction confirmed onchain',
          description: `Transaction included in block ${receipt.blockNumber}`,
          data: {
            blockNumber: receipt.blockNumber.toString(),
            gasUsed: receipt.gasUsed.toString(),
            transactionHash: hash,
          },
        });

        if (finalConfirmStepId != null) {
          onUpdateStep?.(finalConfirmStepId, { status: 'success' });
        }
      } catch (error) {
        if (confirmStepId != null) {
          onUpdateStep?.(confirmStepId, {
            status: 'error',
            data: {
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
        throw error;
      }

      queryClient.invalidateQueries({
        queryKey: ['balance', { chainId: params.chainId, account: params.account }],
      });
    },
  });
}
