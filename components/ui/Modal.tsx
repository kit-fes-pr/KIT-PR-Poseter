'use client';

import { ReactNode } from 'react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  centered?: boolean;
  overlayClassName?: string;
  panelClassName?: string;
  contentClassName?: string;
};

export function Modal({
  open,
  onClose,
  children,
  centered = true,
  overlayClassName = '',
  panelClassName = '',
  contentClassName = '',
}: ModalProps) {
  if (!open) return null;

  const overlayBase = centered
    ? 'fixed inset-0 z-50 flex items-center justify-center p-4'
    : 'fixed inset-0 z-50 overflow-y-auto p-4';
  const panelBase = centered
    ? 'w-full overflow-hidden rounded-2xl bg-white shadow-2xl'
    : 'mx-auto my-8 w-full overflow-hidden rounded-2xl bg-white shadow-2xl';

  return (
    <div
      role="presentation"
      className={`${overlayBase} bg-black/10 backdrop-blur-sm ${overlayClassName}`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`${panelBase} ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={contentClassName}>
          {children}
        </div>
      </div>
    </div>
  );
}

