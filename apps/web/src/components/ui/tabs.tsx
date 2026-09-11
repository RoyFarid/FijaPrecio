'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface TabDef {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({ tabs, initial }: { tabs: TabDef[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div role="tablist" className="flex gap-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === current?.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              '-mb-px border-b-2 pb-2.5 pt-1 text-[14px] font-semibold transition-colors',
              tab.id === current?.id
                ? 'border-brand text-fg'
                : 'border-transparent text-fg-subtle hover:text-fg',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pt-6">
        {current?.content}
      </div>
    </div>
  );
}
