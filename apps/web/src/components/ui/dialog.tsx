'use client';

import { useEffect, type ReactNode } from 'react';

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="fixed inset-0 bg-fg/30 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal
        className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl shadow-fg/10"
      >
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-[15px] font-semibold">{title}</h2>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
