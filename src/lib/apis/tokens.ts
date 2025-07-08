import {
  getTransactionCount,
  readContract,
  sendTransaction,
  signMessage,
  getBalance as wagmiGetBalance,
  writeContract,
} from '@wagmi/core';
import { getConsensusThreshold, getScaler, PublicKey } from 'neox-tpke';
import {
  Address,
  concat,
  createPublicClient,
  getChainContractAddress,
  Hash,
  Hex,
  http,
  InternalRpcError,
  keccak256,
  pad,
  parseTransaction,
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
  // eslint-disable-next-line no-console
  console.log('💸 Starting transfer:', {
    chainId: params.chainId,
    address: params.address,
    to: params.to,
    amount: params.amount,
    useAntiMev: params.useAntiMev,
  });

  // Only switch chain once at the beginning
  await switchChain({ chainId: params.chainId, useAntiMev: params.useAntiMev });

  let nonce: number | undefined;

  if (params.useAntiMev === true) {
    // eslint-disable-next-line no-console
    console.log('🛡️  AntiMEV requested - getting nonce...');
    nonce = await getTransactionCount(wagmiConfig, {
      chainId: params.chainId,
      address: params.account,
    });
    // eslint-disable-next-line no-console
    console.log('📊 Got nonce for AntiMEV:', nonce);
  }

  try {
    // eslint-disable-next-line no-console
    console.log('📝 Attempting initial transaction...');

    let hash: Hash;
    if (params.address == null) {
      // eslint-disable-next-line no-console
      console.log('💰 Sending native token transfer...');
      hash = await sendTransaction(wagmiConfig, {
        chainId: params.chainId,
        to: params.to,
        value: amountToRawAmount(params.amount, params.decimals),
        nonce,
      });
    } else {
      // eslint-disable-next-line no-console
      console.log('🪙 Sending ERC20 token transfer...');
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
      // eslint-disable-next-line no-console
      console.log('✅ Regular transfer completed successfully. Hash:', hash);
      return hash;
    }

    // eslint-disable-next-line no-console
    console.log(
      '🚫 Initial transaction failed (expected for AntiMEV), proceeding with AntiMEV flow...',
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('⚠️  Initial transaction failed, checking if we should proceed with AntiMEV...');

    if (
      params.useAntiMev !== true ||
      !(error instanceof ViemBaseError) ||
      error.walk(error => error instanceof InternalRpcError) == null
    ) {
      console.error('❌ Non-AntiMEV error or AntiMEV not requested:', error);
      throw error;
    }

    // eslint-disable-next-line no-console
    console.log('✅ Error is compatible with AntiMEV flow, continuing...');
  }

  if (nonce == null) {
    console.error('❌ Nonce is not available for AntiMEV flow');
    throw new InternalError('Nonce is not available.');
  }

  // eslint-disable-next-line no-console
  console.log('🛡️  Starting AntiMEV flow with nonce:', nonce);

  try {
    // eslint-disable-next-line no-console
    console.log('✍️  Signing nonce message...');
    const signature = await signMessage(wagmiConfig, {
      message: nonce.toString(),
    });
    // eslint-disable-next-line no-console
    console.log('✅ Signature obtained:', signature);

    // eslint-disable-next-line no-console
    console.log('🌐 Creating AntiMEV public client...');
    const publicClient = createPublicClient({
      chain: chains[params.chainId],
      transport: http(chains[params.chainId].rpcUrls.antiMev.http[0]),
    });
    // eslint-disable-next-line no-console
    console.log('✅ AntiMEV client created, requesting cached transaction...');

    const transaction = await publicClient.request<{ ReturnType: Hex }>({
      method: 'eth_getCachedTransaction',
      params: [toHex(nonce), signature],
    });

    // eslint-disable-next-line no-console
    console.log('📦 Got cached transaction:', transaction);

    // eslint-disable-next-line no-console
    console.log('🏛️  Reading consensus size from governance contract...');
    const consensusSize = await readContract(wagmiConfig, {
      chainId: params.chainId,
      address: getChainContractAddress({
        chain: chains[params.chainId],
        contract: 'governance',
      }),
      abi: governanceAbi,
      functionName: 'consensusSize',
    });

    // eslint-disable-next-line no-console
    console.log('📊 consensusSize:', consensusSize);

    // eslint-disable-next-line no-console
    console.log('🔢 Reading round number from key management contract...');
    const roundNumber = await readContract(wagmiConfig, {
      chainId: params.chainId,
      address: getChainContractAddress({
        chain: chains[params.chainId],
        contract: 'keyManagement',
      }),
      abi: keyManagementAbi,
      functionName: 'roundNumber',
    });

    // eslint-disable-next-line no-console
    console.log('🔄 roundNumber:', roundNumber);

    // eslint-disable-next-line no-console
    console.log('🔐 Reading aggregated commitments...');
    const aggregatedCommitment = await readContract(wagmiConfig, {
      chainId: params.chainId,
      address: getChainContractAddress({
        chain: chains[params.chainId],
        contract: 'keyManagement',
      }),
      abi: keyManagementAbi,
      functionName: 'aggregatedCommitments',
      args: [roundNumber],
    });

    // eslint-disable-next-line no-console
    console.log('🔑 aggregatedCommitment:', aggregatedCommitment);

    // eslint-disable-next-line no-console
    console.log('🧮 Creating public key from aggregated commitment...');
    const publicKey = PublicKey.fromAggregatedCommitment(
      toBytes(aggregatedCommitment),
      getScaler(consensusSize, getConsensusThreshold(consensusSize)),
    );

    // eslint-disable-next-line no-console
    console.log('🔒 Encrypting transaction...');
    const { encryptedKey, encryptedMsg } = publicKey.encrypt(toBytes(transaction));

    const transactionObject = parseTransaction(transaction);

    // eslint-disable-next-line no-console
    console.log('⛽ transactionGas:', transactionObject.gas);

    // eslint-disable-next-line no-console
    console.log('📦 Creating envelope data...');
    const envelopeData = concat([
      new Uint8Array([0xff, 0xff, 0xff, 0xff]),
      pad(toBytes(roundNumber), { size: 4 }),
      pad(toBytes(transactionObject.gas!), { size: 4 }),
      toBytes(keccak256(transaction)),
      encryptedKey,
      encryptedMsg,
    ]);

    // eslint-disable-next-line no-console
    console.log('📬 envelopeData:', toHex(envelopeData));

    // eslint-disable-next-line no-console
    console.log('📤 Sending final AntiMEV transaction to governance reward contract...');
    // No need to switch chain again - we're already on the correct chain
    const hash = await sendTransaction(wagmiConfig, {
      chainId: params.chainId,
      account: params.account,
      to: getChainContractAddress({ chain: chains[params.chainId], contract: 'governanceReward' }),
      data: toHex(envelopeData),
    });

    // eslint-disable-next-line no-console
    console.log('🎉 AntiMEV transfer completed successfully! Hash:', hash);
    return hash;
  } catch (antiMevError) {
    console.error('❌ AntiMEV flow failed:', antiMevError);

    // If AntiMEV flow fails, provide a helpful error message
    if (antiMevError instanceof Error) {
      if (antiMevError.message.includes('eth_getCachedTransaction')) {
        console.error('🚫 AntiMEV service unavailable');
        throw new InternalError(
          'AntiMEV service is currently unavailable. Please try using the regular Send button instead.',
          { cause: antiMevError, needFix: false },
        );
      }
      if (antiMevError.message.includes('network')) {
        console.error('🌐 Network connection issue with AntiMEV');
        throw new InternalError(
          'Network connection issue with AntiMEV service. Please check your connection and try again.',
          { cause: antiMevError, needFix: false },
        );
      }
    }
    throw antiMevError;
  }
}
