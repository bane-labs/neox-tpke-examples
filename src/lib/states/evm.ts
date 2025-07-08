import {
  getAccount,
  GetAccountReturnType,
  getChainId,
  watchAccount,
  watchChainId,
} from '@wagmi/core';
import { atom } from 'jotai';
import { supportedChainIds } from '@/configs/chains';
import { wagmiConfig } from '../utils/wagmi';

const getAccountResultAtom = atom<GetAccountReturnType | null>(null);

getAccountResultAtom.onMount = setAtom => {
  // Only update on client-side to prevent hydration mismatches
  if (typeof window !== 'undefined') {
    const update = () => setAtom(getAccount(wagmiConfig));
    update();
    return watchAccount(wagmiConfig, { onChange: update });
  }
  return () => {};
};

export const connectorChainIdAtom = atom(get => get(getAccountResultAtom)?.chainId);

export const connectorAccountAtom = atom(get => get(getAccountResultAtom)?.address);

export const chainIdAtom = atom(supportedChainIds[0]);

chainIdAtom.onMount = setAtom => {
  // Only update on client-side to prevent hydration mismatches
  if (typeof window !== 'undefined') {
    const update = () => setAtom(getChainId(wagmiConfig));
    update();
    return watchChainId(wagmiConfig, { onChange: update });
  }
  return () => {};
};

export const accountAtom = connectorAccountAtom;
