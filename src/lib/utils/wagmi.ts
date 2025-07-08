import { getDefaultWallets } from '@rainbow-me/rainbowkit';
import {
  createConfig,
  getConnectorClient,
  BaseError as WagmiBaseError,
  switchChain as wagmiSwitchChain,
} from '@wagmi/core';
import {
  Chain,
  createClient,
  http,
  toHex,
  BaseError as ViemBaseError,
  UserRejectedRequestError as ViemUserRejectedRequestError,
} from 'viem';
import { appName, walletConnectProjectId } from '@/configs/app';
import { ChainId, chains, supportedChainIds } from '@/configs/chains';
import { UnknownEvmError, UserRejectedRequestError } from '../errors/evm';

export const wagmiConfig = createConfig({
  chains: supportedChainIds.map(chainId => chains[chainId]) as [Chain, ...Chain[]],
  client: ({ chain }) => {
    return createClient({ chain, transport: http() });
  },
  connectors:
    typeof window !== 'undefined'
      ? getDefaultWallets({ appName, projectId: walletConnectProjectId }).connectors
      : undefined,
});

export function convertMaybeEvmError(error: Error): Error {
  if (error instanceof WagmiBaseError) {
    return new UnknownEvmError(error.shortMessage, { cause: error });
  }
  if (error instanceof ViemBaseError) {
    if (error.walk(error => error instanceof ViemUserRejectedRequestError) != null) {
      return new UserRejectedRequestError(undefined, { cause: error });
    }
    return new UnknownEvmError(error.shortMessage, { cause: error });
  }
  return error;
}

export type SwitchChainParams = {
  chainId: ChainId;
  useAntiMev?: boolean;
};

export async function switchChain(params: SwitchChainParams) {
  // eslint-disable-next-line no-console
  console.log('🔄 Starting chain switch:', {
    chainId: params.chainId,
    useAntiMev: params.useAntiMev,
    chainName: chains[params.chainId].name,
  });

  try {
    // First, try to switch to the correct chain
    // eslint-disable-next-line no-console
    console.log('⛓️  Switching to chain:', params.chainId);
    await wagmiSwitchChain(wagmiConfig, { chainId: params.chainId });
    // eslint-disable-next-line no-console
    console.log('✅ Chain switch successful');

    // If AntiMEV is requested and available, try to add the AntiMEV RPC configuration
    if (params.useAntiMev === true && chains[params.chainId].rpcUrls.antiMev != null) {
      // eslint-disable-next-line no-console
      console.log('🛡️  Setting up AntiMEV RPC...');
      try {
        const client = await getConnectorClient(wagmiConfig);
        // eslint-disable-next-line no-console
        console.log('📡 Got connector client, adding AntiMEV chain...');

        const chainConfig = {
          chainId: toHex(params.chainId),
          chainName: `${chains[params.chainId].name}`,
          nativeCurrency: chains[params.chainId].nativeCurrency,
          rpcUrls: chains[params.chainId].rpcUrls.antiMev.http,
          blockExplorerUrls:
            chains[params.chainId].blockExplorers != null
              ? [chains[params.chainId].blockExplorers!.default.url]
              : [],
        };

        // eslint-disable-next-line no-console
        console.log('📋 AntiMEV chain config:', chainConfig);

        // Try to add the AntiMEV RPC as an alternative for the same chain
        await client.request({
          method: 'wallet_addEthereumChain',
          params: [chainConfig],
        });
        // eslint-disable-next-line no-console
        console.log('✅ AntiMEV RPC added successfully');
      } catch (addChainError) {
        // If adding the AntiMEV chain fails, we can still proceed with the regular chain
        // The AntiMEV functionality will work with the public client in the transfer function
        console.warn(
          '⚠️  Failed to add AntiMEV RPC to wallet, but AntiMEV transfers will still work:',
          addChainError,
        );
      }
    } else if (params.useAntiMev === true) {
      // eslint-disable-next-line no-console
      console.log('ℹ️  AntiMEV requested but not available for this chain');
    }

    // eslint-disable-next-line no-console
    console.log('🎉 Chain switch process completed successfully');
  } catch (error) {
    console.error('❌ Chain switch failed:', error);

    // Enhanced error handling for common wallet connection issues
    if (error instanceof Error) {
      // eslint-disable-next-line no-console
      console.log('🔍 Analyzing error message:', error.message);

      if (
        error.message.includes('Could not establish connection') ||
        error.message.includes('Receiving end does not exist')
      ) {
        console.error('🔌 Wallet connection lost detected');
        throw new UnknownEvmError(
          'Wallet connection lost. Please refresh the page and reconnect your wallet.',
          { cause: error, needFix: false },
        );
      }
      if (error.message.includes('User rejected')) {
        // eslint-disable-next-line no-console
        console.log('🚫 User rejected chain switch');
        throw new UserRejectedRequestError('Chain switch was cancelled.', { cause: error });
      }
    }
    throw error;
  }
}
