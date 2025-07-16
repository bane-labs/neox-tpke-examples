'use client';

import { ComponentProps, FC } from 'react';
import { cn } from '@/lib/utils/shadcn';

export const MetaMaskBanner: FC<ComponentProps<'div'>> = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        'w-full border-b border-amber-200 bg-amber-50 dark:border-amber-800/30 dark:bg-amber-900/20',
        className,
      )}
      {...props}
    >
      <div className="container flex items-center justify-center py-2">
        <div className="flex items-center space-x-2 text-sm text-amber-800 dark:text-amber-200">
          <svg
            className="h-4 w-4 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            <strong>Note:</strong> These examples require MetaMask version 12.20.1 or higher to
            function properly.
          </span>
        </div>
      </div>
    </div>
  );
};
