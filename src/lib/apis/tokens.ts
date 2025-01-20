import {
  getTransactionCount,
  readContract,
  sendTransaction,
  signMessage,
  getBalance as wagmiGetBalance,
  writeContract,
} from '@wagmi/core';
import {
  Address,
  createPublicClient,
  getChainContractAddress,
  Hash,
  Hex,
  http,
  InternalRpcError,
  toHex,
  BaseError as ViemBaseError,
} from 'viem';
import { ChainId, chains } from '@/configs/chains';
import { erc20Abi } from '../abis/erc20';
import { InternalError } from '../errors/common';
import { amountToRawAmount, rawAmountToAmount } from '../utils/misc';
import { wagmiConfig } from '../utils/wagmi';
import { switchChain } from './wagmi';

export type GetDecimalsParams = {
  chainId: ChainId;
  address: Address | null;
};

export async function getDecimals(params: GetDecimalsParams): Promise<number> {
  if (params.address == null) {
    return chains[params.chainId].nativeCurrency.decimals;
  }
  const decimals = await readContract(wagmiConfig, {
    chainId: params.chainId,
    address: params.address,
    abi: erc20Abi,
    functionName: 'decimals',
  });
  return decimals;
}

export type GetSymbolParams = {
  chainId: ChainId;
  address: Address | null;
};

export async function getSymbol(params: GetDecimalsParams): Promise<string> {
  if (params.address == null) {
    return chains[params.chainId].nativeCurrency.symbol;
  }
  const symbol = await readContract(wagmiConfig, {
    chainId: params.chainId,
    address: params.address,
    abi: erc20Abi,
    functionName: 'symbol',
  });
  return symbol;
}

export type GetBalanceParams = {
  chainId: ChainId;
  address: Address | null;
  account: Address;
  decimals: number;
};

export async function getBalance(params: GetBalanceParams): Promise<string> {
  if (params.address == null) {
    const balance = await wagmiGetBalance(wagmiConfig, {
      chainId: params.chainId,
      address: params.account,
    });
    return rawAmountToAmount(balance.value, params.decimals);
  }
  const balance = await readContract(wagmiConfig, {
    chainId: params.chainId,
    address: params.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [params.account],
  });
  return rawAmountToAmount(balance, params.decimals);
}

export type TransferParams = {
  chainId: ChainId;
  address: Address | null;
  account: Address;
  decimals: number;
  to: Address;
  amount: string;
  useAntiMev?: boolean;
};

export async function transfer(params: TransferParams): Promise<Hash> {
  await switchChain({ chainId: params.chainId, useAntiMev: params.useAntiMev });

  let nonce: number | undefined;

  if (params.useAntiMev === true) {
    nonce = await getTransactionCount(wagmiConfig, {
      chainId: params.chainId,
      address: params.account,
    });
  }

  try {
    let hash: Hash;
    if (params.address == null) {
      hash = await sendTransaction(wagmiConfig, {
        chainId: params.chainId,
        to: params.to,
        value: amountToRawAmount(params.amount, params.decimals),
        nonce,
      });
    } else {
      hash = await writeContract(wagmiConfig, {
        chainId: params.chainId,
        address: params.address,
        account: params.account,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [params.to, amountToRawAmount(params.amount, params.decimals)],
        nonce,
      });
    }
    if (params.useAntiMev !== true) {
      return hash;
    }
  } catch (error) {
    if (
      params.useAntiMev !== true ||
      !(error instanceof ViemBaseError) ||
      error.walk(error => error instanceof InternalRpcError) == null
    ) {
      throw error;
    }
  }

  if (nonce == null) {
    throw new InternalError('Nonce is not available.');
  }

  const signature = await signMessage(wagmiConfig, {
    message: nonce.toString(),
  });

  const publicClient = createPublicClient({
    chain: chains[params.chainId],
    transport: http(chains[params.chainId].rpcUrls.antiMev.http[0]),
  });

  const data = await publicClient.request<{ ReturnType: Hex }>({
    method: 'eth_getEncryptedTransaction',
    params: [toHex(nonce), signature],
  });

  await switchChain({ chainId: params.chainId, useAntiMev: params.useAntiMev });

  const hash = await sendTransaction(wagmiConfig, {
    chainId: params.chainId,
    account: params.account,
    to: getChainContractAddress({ chain: chains[params.chainId], contract: 'antiMev' }),
    data,
  });

  return hash;
}
