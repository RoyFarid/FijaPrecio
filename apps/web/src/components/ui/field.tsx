import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Estilo base sin altura — quien lo use fija la suya (`inputClasses` = altura estándar). */
export const inputBase = cn(
  'w-full rounded-lg border border-border bg-surface px-3.5 text-[13.5px] text-fg',
  'placeholder:text-fg-subtle',
  'focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand-soft',
  'disabled:cursor-not-allowed disabled:opacity-70',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20',
);

export const inputClasses = cn(inputBase, 'h-11');

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-[13px] font-semibold text-fg">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(inputClasses, className)}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
