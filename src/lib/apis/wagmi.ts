import { getConnectorClient, switchChain as wagmiSwitchChain } from '@wagmi/core';
import { toHex } from 'viem';
import { ChainId, chains } from '@/configs/chains';
import { wagmiConfig } from '../utils/wagmi';

export type SwitchChainParams = {
  chainId: ChainId;
  useAntiMev?: boolean;
};

export async function switchChain(params: SwitchChainParams) {
  if (chains[params.chainId].rpcUrls.antiMev == null) {
    await wagmiSwitchChain(wagmiConfig, { chainId: params.chainId });
    return;
  }
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
