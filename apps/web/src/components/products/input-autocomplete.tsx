'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { inputClasses } from '../ui/field';
import { Spinner } from '../ui/spinner';
import { useCatalogSearch } from '../../hooks/use-catalog';

interface Props {
  value: string;
  onChange: (name: string) => void;
  onPick?: (match: { id: string; name: string; baseUnit: string }) => void;
  placeholder?: string;
  error?: string;
  'aria-label'?: string;
}

/** Combobox de insumos canónicos (trigram). Permite texto libre. */
export function InputAutocomplete({ value, onChange, onPick, placeholder, error, ...aria }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const results = useCatalogSearch(query);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const list = results.data ?? [];

  return (
    <div ref={rootRef} className="relative">
      <input
        {...aria}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          onChange(e.target.value);
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => value.length >= 2 && (setQuery(value), setOpen(true))}
        className={cn(inputClasses, error && 'border-danger')}
      />

      {open && query.trim().length >= 2 ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-lg">
          {results.isFetching && list.length === 0 ? (
            <div className="grid place-items-center py-3">
              <Spinner className="text-fg-subtle" />
            </div>
          ) : list.length === 0 ? null : (
            <ul className="max-h-56 overflow-y-auto py-1">
              {list.map((match) => (
                <li key={match.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(match.name);
                      onPick?.({ id: match.id, name: match.name, baseUnit: match.baseUnit });
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-muted"
                  >
                    <span className="text-fg">{match.name}</span>
                    <span className="shrink-0 text-xs text-fg-subtle">{match.baseUnit}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
