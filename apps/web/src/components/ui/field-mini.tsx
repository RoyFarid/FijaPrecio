import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { inputBase } from './field';

/** Campo compacto para filas de tabla/grid (label pequeño encima). */
export const FieldMini = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string }
>(function FieldMini({ label, error, className, ...props }, ref) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold text-fg-muted">{label}</label>
      <input
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={cn(inputBase, 'h-9 text-[13px]', error && 'border-danger', className)}
        {...props}
      />
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
});

export const SelectMini = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & {
    label: ReactNode;
    options: readonly { value: string; label: string }[];
  }
>(function SelectMini({ label, options, className, ...props }, ref) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold text-fg-muted">{label}</label>
      <select
        ref={ref}
        className={cn(inputBase, 'h-9 appearance-none text-[13px]', className)}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
});
