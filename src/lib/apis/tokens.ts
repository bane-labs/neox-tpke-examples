import {
  estimateGas,
  getTransactionCount,
  readContract,
  sendTransaction,
  signMessage,
  getBalance as wagmiGetBalance,
} from '@wagmi/core';
import { getConsensusThreshold, getScaler, PublicKey } from 'neox-tpke';
import {
  Address,
  concat,
  createPublicClient,
  encodeFunctionData,
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

export type StepCallback = (step: {
  emoji: string;
  title: string;
  description?: string;
  data?: Record<string, unknown>;
}) => string;

export type UpdateStepCallback = (
  id: string,
  updates: { status: 'success' | 'error'; data?: Record<string, unknown> },
) => void;

export type TransferParams = {
  chainId: ChainId;
  address: Address | null;
  account: Address;
  decimals: number;
  to: Address;
  amount: string;
  useAntiMev?: boolean;
  onStep?: StepCallback;
  onUpdateStep?: UpdateStepCallback;
};

export async function transfer(params: TransferParams): Promise<Hash> {
  const { onStep, onUpdateStep } = params;

  const addStep = (step: Parameters<StepCallback>[0]) => {
    return onStep?.(step) ?? '';
  };

  const updateStep = (id: string, updates: Parameters<UpdateStepCallback>[1]) => {
    onUpdateStep?.(id, updates);
  };

  // Step 1: Switch chain
  const switchStepId = addStep({
    emoji: '🔄',
    title: 'Switching to target chain',
    description: `Switching to ${chains[params.chainId].name}`,
    data: { chainId: params.chainId, useAntiMev: params.useAntiMev },
  });

  await switchChain({ chainId: params.chainId, useAntiMev: params.useAntiMev });
  updateStep(switchStepId, { status: 'success' });

  let nonce: number | undefined;

  if (params.useAntiMev === true) {
    // Step 2: Get nonce for AntiMEV
    const nonceStepId = addStep({
      emoji: '🔢',
      title: 'Getting transaction nonce',
      description: 'Required for AntiMEV transactions',
      data: { account: params.account },
    });

    nonce = await getTransactionCount(wagmiConfig, {
      chainId: params.chainId,
      address: params.account,
    });

    updateStep(nonceStepId, { status: 'success', data: { nonce } });
  }

  // Step 3: Attempt initial transaction
  const txStepId = addStep({
    emoji: params.address != null ? '💰' : '💎',
    title:
      params.address != null ? 'Sending ERC20 token transfer' : 'Sending native token transfer',
    description: `Transferring ${params.amount} to ${params.to}`,
    data: {
      tokenAddress: params.address,
      amount: params.amount,
      to: params.to,
      nonce,
    },
  });

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
      // Encode the transfer function call data
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [params.to, amountToRawAmount(params.amount, params.decimals)],
      });

      // Estimate gas explicitly to avoid MetaMask estimation issues
      const gas = await estimateGas(wagmiConfig, {
        chainId: params.chainId,
        account: params.account,
        to: params.address,
        data,
      });

      // Send as a regular transaction with explicit gas
      hash = await sendTransaction(wagmiConfig, {
        chainId: params.chainId,
        account: params.account,
        to: params.address,
        data,
        gas,
        nonce,
      });
    }

    if (params.useAntiMev !== true) {
      updateStep(txStepId, { status: 'success', data: { transactionHash: hash } });

      const completionStepId = addStep({
        emoji: '✅',
        title: 'Transaction completed',
        description: 'Standard transaction sent successfully',
        data: { hash },
      });

      updateStep(completionStepId, { status: 'success' });

      return hash;
    }

    updateStep(txStepId, { status: 'success', data: { transactionHash: hash } });
  } catch (error) {
    if (
      params.useAntiMev !== true ||
      !(error instanceof ViemBaseError) ||
      error.walk(error => error instanceof InternalRpcError) == null
    ) {
      updateStep(txStepId, {
        status: 'error',
        data: { error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }

    updateStep(txStepId, {
      status: 'success',
      data: { note: 'Transaction cached for AntiMEV processing' },
    });
  }

  if (nonce == null) {
    throw new InternalError('Nonce is not available.');
  }

  // Step 4: Sign nonce message
  const signStepId = addStep({
    emoji: '✍️',
    title: 'Signing nonce message',
    description: 'Creating signature for transaction verification',
    data: { nonce },
  });

  const signature = await signMessage(wagmiConfig, {
    message: nonce.toString(),
  });

  updateStep(signStepId, { status: 'success', data: { signature } });

  // Step 5: Create AntiMEV client
  const clientStepId = addStep({
    emoji: '🌐',
    title: 'Creating AntiMEV client',
    description: 'Connecting to AntiMEV RPC endpoint',
    data: { rpcUrl: chains[params.chainId].rpcUrls.antiMev?.http[0] },
  });

  const publicClient = createPublicClient({
    chain: chains[params.chainId],
    transport: http(chains[params.chainId].rpcUrls.antiMev!.http[0]),
  });

  updateStep(clientStepId, { status: 'success' });

  // Step 6: Get cached transaction
  const cachedTxStepId = addStep({
    emoji: '📋',
    title: 'Retrieving cached transaction',
    description: 'Getting transaction data from AntiMEV cache',
    data: { nonce, signature },
  });

  const transaction = await publicClient.request<{ ReturnType: Hex }>({
    method: 'eth_getCachedTransaction',
    params: [toHex(nonce), signature],
  });

  updateStep(cachedTxStepId, { status: 'success', data: { transaction } });

  // Step 7: Read consensus size
  const consensusStepId = addStep({
    emoji: '👥',
    title: 'Reading consensus size',
    description: 'Getting validator consensus information',
  });

  const consensusSize = await readContract(wagmiConfig, {
    chainId: params.chainId,
    address: getChainContractAddress({ chain: chains[params.chainId], contract: 'governance' }),
    abi: governanceAbi,
    functionName: 'consensusSize',
  });

  updateStep(consensusStepId, { status: 'success', data: { consensusSize } });

  // Step 8: Read round number
  const roundStepId = addStep({
    emoji: '🔄',
    title: 'Reading current round number',
    description: 'Getting current encryption round',
  });

  const roundNumber = await readContract(wagmiConfig, {
    chainId: params.chainId,
    address: getChainContractAddress({ chain: chains[params.chainId], contract: 'keyManagement' }),
    abi: keyManagementAbi,
    functionName: 'roundNumber',
  });

  updateStep(roundStepId, { status: 'success', data: { roundNumber } });

  // Step 9: Read aggregated commitment
  const commitmentStepId = addStep({
    emoji: '🔐',
    title: 'Reading aggregated commitment',
    description: 'Getting encryption key materials',
    data: { roundNumber },
  });

  const aggregatedCommitment = await readContract(wagmiConfig, {
    chainId: params.chainId,
    address: getChainContractAddress({ chain: chains[params.chainId], contract: 'keyManagement' }),
    abi: keyManagementAbi,
    functionName: 'aggregatedCommitments',
    args: [roundNumber],
  });

  updateStep(commitmentStepId, { status: 'success', data: { aggregatedCommitment } });

  // Step 10: Create public key
  const keyStepId = addStep({
    emoji: '🗝️',
    title: 'Creating TPKE public key',
    description: 'Generating threshold public key for encryption',
  });

  const publicKey = PublicKey.fromAggregatedCommitment(
    toBytes(aggregatedCommitment),
    getScaler(consensusSize, getConsensusThreshold(consensusSize)),
  );

  updateStep(keyStepId, {
    status: 'success',
    data: { threshold: getConsensusThreshold(consensusSize) },
  });

  // Step 11: Encrypt transaction
  const encryptStepId = addStep({
    emoji: '🔒',
    title: 'Encrypting transaction',
    description: 'Using TPKE to encrypt transaction data',
  });

  const { encryptedKey, encryptedMsg } = publicKey.encrypt(toBytes(transaction));

  updateStep(encryptStepId, {
    status: 'success',
    data: {
      encryptedKeyLength: encryptedKey.length,
      encryptedMsgLength: encryptedMsg.length,
      encryptedKey: toHex(encryptedKey),
      encryptedMsg: toHex(encryptedMsg),
    },
  });

  // Step 12: Parse transaction object
  const parseStepId = addStep({
    emoji: '🔍',
    title: 'Parsing transaction object',
    description: 'Extracting transaction parameters',
  });

  const transactionObject = parseTransaction(transaction);

  updateStep(parseStepId, {
    status: 'success',
    data: {
      gas: transactionObject.gas?.toString(),
      gasPrice: transactionObject.gasPrice?.toString(),
    },
  });

  // Step 13: Create envelope data
  const envelopeStepId = addStep({
    emoji: '📦',
    title: 'Creating transaction envelope',
    description: 'Packaging encrypted data for submission',
  });

  const envelopeData = concat([
    new Uint8Array([0xff, 0xff, 0xff, 0xff]),
    pad(toBytes(roundNumber), { size: 4 }),
    pad(toBytes(transactionObject.gas!), { size: 4 }),
    toBytes(keccak256(transaction)),
    encryptedKey,
    encryptedMsg,
  ]);

  updateStep(envelopeStepId, {
    status: 'success',
    data: { envelopeSize: envelopeData.length, envelopeData: toHex(envelopeData) },
  });

  // Step 14: Switch chain for final submission
  const finalSwitchStepId = addStep({
    emoji: '🔄',
    title: 'Switching chain for submission',
    description: 'Preparing for final transaction submission',
  });

  await switchChain({ chainId: params.chainId, useAntiMev: params.useAntiMev });

  updateStep(finalSwitchStepId, { status: 'success' });

  // Step 15: Submit final transaction
  const submitStepId = addStep({
    emoji: '🚀',
    title: 'Submitting AntiMEV transaction',
    description: 'Sending encrypted transaction to governance contract',
    data: {
      target: getChainContractAddress({
        chain: chains[params.chainId],
        contract: 'governanceReward',
      }),
      dataSize: envelopeData.length,
    },
  });

  const hash = await sendTransaction(wagmiConfig, {
    chainId: params.chainId,
    account: params.account,
    to: getChainContractAddress({ chain: chains[params.chainId], contract: 'governanceReward' }),
    data: toHex(envelopeData),
  });

  updateStep(submitStepId, { status: 'success', data: { transactionHash: hash } });

  // Final step
  const finalStepId = addStep({
    emoji: '🎉',
    title: 'AntiMEV transaction completed',
    description: 'Transaction successfully submitted to AntiMEV system',
    data: { hash },
  });

  updateStep(finalStepId, { status: 'success' });

  return hash;
}
