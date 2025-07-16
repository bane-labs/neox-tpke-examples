import { useCallback, useState } from 'react';

export type TransferStep = {
  id: string;
  emoji: string;
  title: string;
  description?: string;
  data?: Record<string, unknown>;
  timestamp: Date;
  status: 'pending' | 'success' | 'error';
};

export function useTransferSteps() {
  const [steps, setSteps] = useState<TransferStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addStep = useCallback((step: Omit<TransferStep, 'id' | 'timestamp' | 'status'>) => {
    const newStep: TransferStep = {
      ...step,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      status: 'pending',
    };
    setSteps(prev => [...prev, newStep]);
    return newStep.id;
  }, []);

  const updateStep = useCallback((id: string, updates: Partial<TransferStep>) => {
    setSteps(prev => prev.map(step => (step.id === id ? { ...step, ...updates } : step)));
  }, []);

  const clearSteps = useCallback(() => {
    setSteps([]);
    setIsRunning(false);
  }, []);

  const startTracking = useCallback(() => {
    setSteps([]);
    setIsRunning(true);
  }, []);

  const stopTracking = useCallback(() => {
    setIsRunning(false);
  }, []);

  return {
    steps,
    isRunning,
    addStep,
    updateStep,
    clearSteps,
    startTracking,
    stopTracking,
  };
}
