import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Preset } from '../types';
import type { MutationResult } from './FinanceContext';
import { PresetSchema, formatZodIssues } from '../utils/zodSchemas';

/*
 * Phase 118 (ADR 0094): the quick templates, the third slice out of
 * FinanceContext, composed the way the diary (ADR 0092) and the smart rules
 * (ADR 0093) are. No view reads them, only the entry form and Quick Add inside
 * their dialogs, so a template write re-renders none of the six views.
 *
 * They are local only, like `sessions`: no table holds them and the cloud load
 * never touches them. Three things stay in `FinanceProvider`:
 *   - the batched `localStorage` writer, which registers `pf_presets`;
 *   - the sign-out reset (they never sync, so they are gone for good) and the
 *     backup restore, which keeps only templates whose wallet and category it holds;
 *   - `applyPreset`, a ledger write through `addTransaction`, which reads the
 *     templates through the ref this file's hook returns.
 */

export type TemplateInput = {
  name: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  categoryId?: string;
  walletId?: string;
};

export interface TemplateStateContextType {
  presets: Preset[];
}

export interface TemplateActionsContextType {
  addPreset: (data: TemplateInput) => Promise<MutationResult>;
  updatePreset: (
    id: string,
    updates: Partial<{ name: string; amount: number; description: string; categoryId: string; walletId: string }>
  ) => Promise<MutationResult>;
  deletePreset: (id: string) => Promise<MutationResult>;
}

const TemplateStateContext = createContext<TemplateStateContextType | undefined>(undefined);
const TemplateActionsContext = createContext<TemplateActionsContextType | undefined>(undefined);

/** The slice's state, with the ref mirror its writes and `applyPreset` read (ADR 0022). */
export function useTemplateStore(load: () => Preset[]) {
  const [presets, setPresets] = useState<Preset[]>(load);
  const presetsRef = useRef<Preset[]>(presets);
  useEffect(() => {
    presetsRef.current = presets;
  }, [presets]);
  return { presets, setPresets, presetsRef };
}

/**
 * The slice's three writes, moved unchanged. Hard delete, like keyword rules,
 * since a template is configuration, not a financial record `isDeleted` needs
 * to protect.
 */
export function useTemplateMutations({
  currentUserId,
  setPresets,
  presetsRef,
}: {
  currentUserId: string;
  setPresets: React.Dispatch<React.SetStateAction<Preset[]>>;
  presetsRef: React.MutableRefObject<Preset[]>;
}): TemplateActionsContextType {
  const addPreset = useCallback(async (data: TemplateInput): Promise<MutationResult> => {
    const validation = PresetSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: formatZodIssues(validation.error) };
    }
    const cleaned = validation.data;
    const isDuplicate = presetsRef.current.some(
      (p) => p.name.trim().toLowerCase() === cleaned.name.toLowerCase()
    );
    if (isDuplicate) {
      return { success: false, error: `A template named "${cleaned.name}" already exists` };
    }

    const newPreset: Preset = {
      id: `preset-${Date.now()}`,
      userId: currentUserId,
      name: cleaned.name,
      type: cleaned.type,
      amount: cleaned.amount,
      description: cleaned.description,
      categoryId: cleaned.categoryId,
      walletId: cleaned.walletId,
      createdAt: new Date().toISOString(),
    };
    setPresets((prev) => [newPreset, ...prev]);
    return { success: true };
  }, [currentUserId, setPresets, presetsRef]);

  const updatePreset = useCallback(async (
    id: string,
    updates: Partial<{ name: string; amount: number; description: string; categoryId: string; walletId: string }>
  ): Promise<MutationResult> => {
    const existing = presetsRef.current.find((p) => p.id === id);
    if (!existing) {
      return { success: false, error: 'Template not found' };
    }

    let cleanedUpdates = updates;
    if (updates.name !== undefined) {
      const cleanedName = updates.name.trim();
      if (!cleanedName) {
        return { success: false, error: 'Template name is required' };
      }
      const isDuplicate = presetsRef.current.some(
        (p) => p.id !== id && p.name.trim().toLowerCase() === cleanedName.toLowerCase()
      );
      if (isDuplicate) {
        return { success: false, error: `A template named "${cleanedName}" already exists` };
      }
      cleanedUpdates = { ...updates, name: cleanedName };
    }
    if (updates.amount !== undefined && !(updates.amount > 0)) {
      return { success: false, error: 'Amount must be greater than 0' };
    }
    if (updates.description !== undefined && !updates.description.trim()) {
      return { success: false, error: 'Description is required' };
    }

    setPresets((prev) => prev.map((p) => (p.id === id ? { ...p, ...cleanedUpdates } : p)));
    return { success: true };
  }, [setPresets, presetsRef]);

  const deletePreset = useCallback(async (id: string): Promise<MutationResult> => {
    const exists = presetsRef.current.some((p) => p.id === id);
    if (!exists) {
      return { success: false, error: 'Template not found' };
    }
    setPresets((prev) => prev.filter((p) => p.id !== id));
    return { success: true };
  }, [setPresets, presetsRef]);

  return useMemo(() => ({ addPreset, updatePreset, deletePreset }), [addPreset, updatePreset, deletePreset]);
}

/** Rendered by `FinanceProvider` inside its own two providers. */
export function TemplateProvider({
  presets,
  actions,
  children,
}: {
  presets: Preset[];
  actions: TemplateActionsContextType;
  children: React.ReactNode;
}) {
  const state = useMemo(() => ({ presets }), [presets]);
  return (
    <TemplateActionsContext.Provider value={actions}>
      <TemplateStateContext.Provider value={state}>{children}</TemplateStateContext.Provider>
    </TemplateActionsContext.Provider>
  );
}

/** The quick templates. Re-renders the caller on a template write, not on a ledger write. */
export function useTemplateState(): TemplateStateContextType {
  const context = useContext(TemplateStateContext);
  if (!context) throw new Error('useTemplateState must be used within a FinanceProvider');
  return context;
}

/** The templates' writes. Stable for a session. Applying one is `useFinanceActions().applyPreset`, a ledger write. */
export function useTemplateActions(): TemplateActionsContextType {
  const context = useContext(TemplateActionsContext);
  if (!context) throw new Error('useTemplateActions must be used within a FinanceProvider');
  return context;
}
