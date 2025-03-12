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
  if (chains[params.chainId].rpcUrls.antiMev != null) {
    const client = await getConnectorClient(wagmiConfig);
    await client.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: toHex(params.chainId),
          chainName: chains[params.chainId].name,
          nativeCurrency: chains[params.chainId].nativeCurrency,
          rpcUrls:
            params.useAntiMev === true
              ? chains[params.chainId].rpcUrls.antiMev.http
              : chains[params.chainId].rpcUrls.default.http,
          blockExplorerUrls:
            chains[params.chainId].blockExplorers != null
              ? [chains[params.chainId].blockExplorers!.default.url]
              : [],
        },
      ],
    });
  }
  await wagmiSwitchChain(wagmiConfig, { chainId: params.chainId });
}
