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
  concat,
  createPublicClient,
  getChainContractAddress,
  Hash,
  Hex,
  http,
  InternalRpcError,
  pad,
  toBytes,
  toHex,
  BaseError as ViemBaseError,
} from 'viem';
import { ChainId, chains } from '@/configs/chains';
import { erc20Abi } from '../abis/erc20';
import { governanceAbi } from '../abis/governance';
import { keyManagementAbi } from '../abis/key-management';
import { InternalError } from '../errors/common';
import { amountToRawAmount, rawAmountToAmount } from '../utils/misc';
import { getConsensusThreshold, getScaler, PublicKey } from '../utils/tpke';
import { switchChain, wagmiConfig } from '../utils/wagmi';

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

  const transaction = await publicClient.request<{ ReturnType: Hex }>({
    method: 'eth_getEncryptedTransaction',
    params: [toHex(nonce), signature],
  });

  // eslint-disable-next-line no-console
  console.log('transaction', transaction);

  const consensusSize = await readContract(wagmiConfig, {
    chainId: params.chainId,
    address: getChainContractAddress({ chain: chains[params.chainId], contract: 'governance' }),
    abi: governanceAbi,
    functionName: 'consensusSize',
  });

  // eslint-disable-next-line no-console
  console.log('consensusSize', consensusSize);

  const roundNumber = await readContract(wagmiConfig, {
    chainId: params.chainId,
    address: getChainContractAddress({ chain: chains[params.chainId], contract: 'keyManagement' }),
    abi: keyManagementAbi,
    functionName: 'roundNumber',
  });

  // eslint-disable-next-line no-console
  console.log('roundNumber', roundNumber);

  const aggregatedCommitment = await readContract(wagmiConfig, {
    chainId: params.chainId,
    address: getChainContractAddress({ chain: chains[params.chainId], contract: 'keyManagement' }),
    abi: keyManagementAbi,
    functionName: 'aggregatedCommitments',
    args: [roundNumber],
  });

  // eslint-disable-next-line no-console
  console.log('aggregatedCommitment', aggregatedCommitment);

  const publicKey = PublicKey.fromAggregatedCommitment(
    toBytes(aggregatedCommitment),
    getScaler(consensusSize, getConsensusThreshold(consensusSize)),
  );

  const { encryptedKey, encryptedMsg } = publicKey.encrypt(toBytes(transaction));

  const envelopeData = concat([
    new Uint8Array([0xff, 0xff, 0xff, 0xff]),
    pad(toBytes(roundNumber), { size: 4 }).reverse(),
    encryptedKey,
    encryptedMsg,
  ]);

  // eslint-disable-next-line no-console
  console.log('envelopeData', toHex(envelopeData));

  await switchChain({ chainId: params.chainId, useAntiMev: params.useAntiMev });

  const hash = await sendTransaction(wagmiConfig, {
    chainId: params.chainId,
    account: params.account,
    to: getChainContractAddress({ chain: chains[params.chainId], contract: 'governanceReward' }),
    data: toHex(envelopeData),
  });

  return hash;
}
