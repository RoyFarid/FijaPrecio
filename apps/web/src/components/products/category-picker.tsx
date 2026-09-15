'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useCreateProductCategory,
  useProductCategory,
  useProductCategoryChildren,
  useProductCategoryRubros,
} from '../../hooks/use-product-categories';
import type { ProductCategoryNode } from '../../lib/types';
import { inputBase } from '../ui/field';
import { Button } from '../ui/button';
import { cn } from '../../lib/cn';

interface CategoryPickerProps {
  categoryId: string;
  attributes: Record<string, string>;
  onCategoryChange: (categoryId: string, rubro: string | null) => void;
  onAttributesChange: (attributes: Record<string, string>) => void;
}

/** Navegación en cascada rubro → categoría → ... → tipo de producto, en vez de
 *  escribir el nombre a mano. Al llegar a un tipo sin hijos, muestra los
 *  campos de especificación que esa categoría pide (peso, tipo de harina...).
 */
export function CategoryPicker({
  categoryId,
  attributes,
  onCategoryChange,
  onAttributesChange,
}: CategoryPickerProps) {
  const t = useTranslations('products.form');
  const rubros = useProductCategoryRubros();
  const createCategory = useCreateProductCategory();

  const [rubro, setRubro] = useState<string | null>(null);
  const [path, setPath] = useState<ProductCategoryNode[]>([]);
  const [creating, setCreating] = useState<'rubro' | 'category' | null>(null);
  const [newName, setNewName] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Al editar un producto que ya tiene categoría: reconstruye rubro + path
  // desde su breadcrumb, una sola vez.
  const existing = useProductCategory(!initialized && categoryId ? categoryId : null);
  useEffect(() => {
    if (initialized) return;
    if (!categoryId) {
      setInitialized(true);
      return;
    }
    if (existing.data) {
      setRubro(existing.data.rubro);
      // Un producto solo guarda un `categoryId` de un tipo ya "final" (sin
      // más hijos) — así lo trata el picker al reconstruir la edición.
      const self: ProductCategoryNode = {
        id: existing.data.id,
        name: existing.data.name,
        slug: existing.data.slug,
        rubro: existing.data.rubro,
        parentId: existing.data.parentId,
        hasChildren: false,
      };
      setPath([
        ...existing.data.breadcrumb.map((b) => ({
          id: b.id,
          name: b.name,
          slug: '',
          rubro: existing.data!.rubro,
          parentId: null,
          hasChildren: true,
        })),
        self,
      ]);
      setInitialized(true);
    }
  }, [categoryId, existing.data, initialized]);

  const lastPicked = path[path.length - 1] ?? null;
  const atRoot = path.length === 0;
  const children = useProductCategoryChildren(
    atRoot ? null : (lastPicked?.id ?? null),
    atRoot ? (rubro ?? undefined) : undefined,
  );

  const leafId = lastPicked && !lastPicked.hasChildren ? lastPicked.id : null;
  const leaf = useProductCategory(leafId);

  const resetBelow = (depth: number) => {
    setPath((p) => p.slice(0, depth));
    onCategoryChange('', rubro);
    onAttributesChange({});
  };

  const pickRubro = (value: string) => {
    const nextRubro = value || null;
    setRubro(nextRubro);
    setPath([]);
    onCategoryChange('', nextRubro);
    onAttributesChange({});
  };

  const pickNode = (node: ProductCategoryNode, depth: number) => {
    const next = [...path.slice(0, depth), node];
    setPath(next);
    if (!node.hasChildren) {
      onCategoryChange(node.id, node.rubro);
    } else {
      onCategoryChange('', node.rubro);
      onAttributesChange({});
    }
  };

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    if (creating === 'rubro') {
      const { id } = await createCategory.mutateAsync({ name, rubro: name });
      setRubro(name);
      setPath([{ id, name, slug: '', rubro: name, parentId: null, hasChildren: false }]);
      onCategoryChange(id, name);
    } else if (creating === 'category') {
      const parentId = lastPicked?.id;
      const { id } = await createCategory.mutateAsync({ name, parentId });
      pickNode({ id, name, slug: '', rubro: rubro, parentId: parentId ?? null, hasChildren: false }, path.length);
    }
    setCreating(null);
    setNewName('');
  };

  const setAttribute = (key: string, value: string) => {
    onAttributesChange({ ...attributes, [key]: value });
  };

  return (
    <div className="space-y-3">
      {/* Rubro */}
      <div>
        <label className="mb-1 block text-[13px] font-semibold text-fg">{t('categoryRubro')}</label>
        {creating === 'rubro' ? (
          <NewNameRow
            value={newName}
            onChange={setNewName}
            onSubmit={submitCreate}
            onCancel={() => setCreating(null)}
            placeholder={t('categoryNewNamePlaceholder')}
            busy={createCategory.isPending}
          />
        ) : (
          <select
            className={cn(inputBase, 'h-11 appearance-none')}
            value={rubro ?? ''}
            onChange={(e) => {
              if (e.target.value === '__new__') setCreating('rubro');
              else pickRubro(e.target.value);
            }}
          >
            <option value="">{t('categoryRubroPlaceholder')}</option>
            {(rubros.data ?? []).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            <option value="__new__">{t('categoryNewRubro')}</option>
          </select>
        )}
      </div>

      {/* Breadcrumb ya elegido + selector del nivel actual */}
      {rubro ? (
        <div className="space-y-2 rounded-lg border border-border bg-surface-muted/30 p-3">
          {path.map((node, i) => (
            <button
              key={node.id}
              type="button"
              onClick={() => resetBelow(i)}
              className="mr-2 inline-flex items-center rounded-full border border-border bg-surface px-2.5 py-1 text-[12px] font-medium text-fg-muted hover:bg-surface-muted"
            >
              {node.name} ✕
            </button>
          ))}

          {!leafId ? (
            creating === 'category' ? (
              <NewNameRow
                value={newName}
                onChange={setNewName}
                onSubmit={submitCreate}
                onCancel={() => setCreating(null)}
                placeholder={t('categoryNewNamePlaceholder')}
                busy={createCategory.isPending}
              />
            ) : (
              <select
                className={cn(inputBase, 'h-11 appearance-none')}
                value=""
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setCreating('category');
                    return;
                  }
                  const node = children.data?.find((c) => c.id === e.target.value);
                  if (node) pickNode(node, path.length);
                }}
              >
                <option value="">{t('categoryPlaceholder')}</option>
                {(children.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="__new__">{t('categoryNewSubcategory')}</option>
              </select>
            )
          ) : null}
        </div>
      ) : null}

      {/* Atributos del tipo de producto elegido */}
      {leaf.data && leaf.data.attributeDefs.length > 0 ? (
        <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
          <p className="text-[13px] font-semibold text-fg sm:col-span-2">
            {t('categoryAttributesTitle')}
          </p>
          {leaf.data.attributeDefs.map((def) => (
            <div key={def.key}>
              <label className="mb-1 block text-[13px] font-medium text-fg">
                {def.label}
                {def.required ? ' *' : ''}
              </label>
              {def.valueType === 'ENUM' ? (
                <select
                  className={cn(inputBase, 'h-11 appearance-none')}
                  value={attributes[def.key] ?? ''}
                  onChange={(e) => setAttribute(def.key, e.target.value)}
                >
                  <option value="">—</option>
                  {(def.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : def.valueType === 'BOOLEAN' ? (
                <select
                  className={cn(inputBase, 'h-11 appearance-none')}
                  value={attributes[def.key] ?? ''}
                  onChange={(e) => setAttribute(def.key, e.target.value)}
                >
                  <option value="">—</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  className={cn(inputBase, 'h-11')}
                  inputMode={def.valueType === 'NUMBER' ? 'decimal' : 'text'}
                  value={attributes[def.key] ?? ''}
                  onChange={(e) => setAttribute(def.key, e.target.value)}
                />
              )}
              {def.helpText ? <p className="mt-1 text-xs text-fg-muted">{def.helpText}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NewNameRow({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  busy,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder: string;
  busy: boolean;
}) {
  return (
    <div className="flex gap-2">
      <input
        autoFocus
        className={cn(inputBase, 'h-11 flex-1')}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <Button type="button" size="sm" disabled={busy || !value.trim()} onClick={onSubmit}>
        {busy ? '…' : 'OK'}
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
        ✕
      </Button>
    </div>
  );
}
