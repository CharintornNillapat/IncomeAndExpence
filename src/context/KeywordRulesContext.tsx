import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { KeywordRule } from '../types';
import type { MutationResult } from './FinanceContext';
import { supabase } from '../lib/supabase';
import { KeywordMappingSchema, formatZodIssues } from '../utils/zodSchemas';
import { generateEntityId } from '../utils/ids';

/*
 * Phase 117 (ADR 0093): the smart rules, the second slice out of
 * FinanceContext, composed the way the diary is (ADR 0092). Only the
 * Categories page among the six views reads them, so a rule write re-renders
 * it and the entry form and CSV import while open, and no other view.
 *
 * Four things stay in `FinanceProvider` and set the rules through the setter
 * or read them through the ref this file's hook returns:
 *   - the batched `localStorage` writer, which registers `pf_keywords`;
 *   - the one cloud load, which reads `keyword_rules` with the other tables;
 *   - the sign-out reset and the backup restore;
 *   - `deleteCategory`, which refuses a category a rule still uses.
 */

export interface KeywordRulesStateContextType {
  keywordRules: KeywordRule[];
}

export interface KeywordRulesActionsContextType {
  addKeywordRule: (keyword: string, categoryId: string) => Promise<MutationResult>;
  deleteKeywordRule: (id: string) => Promise<MutationResult>;
}

const KeywordRulesStateContext = createContext<KeywordRulesStateContextType | undefined>(undefined);
const KeywordRulesActionsContext = createContext<KeywordRulesActionsContextType | undefined>(undefined);

/** A guest's rules on first load, and what sign-out puts back. */
export const DEFAULT_KEYWORD_RULES: KeywordRule[] = [
  { id: 'kw-1', userId: 'usr-guest-01', keyword: 'coffee', categoryId: 'cat-food', createdAt: new Date().toISOString() },
  { id: 'kw-2', userId: 'usr-guest-01', keyword: 'groceries', categoryId: 'cat-groceries', createdAt: new Date().toISOString() },
  { id: 'kw-3', userId: 'usr-guest-01', keyword: 'fuel', categoryId: 'cat-transport', createdAt: new Date().toISOString() },
  { id: 'kw-4', userId: 'usr-guest-01', keyword: 'salary', categoryId: 'cat-salary', createdAt: new Date().toISOString() },
];

/** A `keyword_rules` row as the app holds it. */
export function mapKeywordRuleRow(row: {
  id: string;
  user_id: string;
  keyword: string;
  category_id: string;
  created_at: string;
}): KeywordRule {
  return {
    id: row.id,
    userId: row.user_id,
    keyword: row.keyword,
    categoryId: row.category_id,
    createdAt: row.created_at,
  };
}

/** The slice's state, with the ref mirror its actions and `deleteCategory` read (ADR 0022). */
export function useKeywordRuleStore(load: () => KeywordRule[]) {
  const [keywordRules, setKeywordRules] = useState<KeywordRule[]>(load);
  const keywordRulesRef = useRef<KeywordRule[]>(keywordRules);
  useEffect(() => {
    keywordRulesRef.current = keywordRules;
  }, [keywordRules]);
  return { keywordRules, setKeywordRules, keywordRulesRef };
}

/** The slice's two writes, moved unchanged. */
export function useKeywordRuleMutations({
  isAuthenticated,
  currentUserId,
  setKeywordRules,
  keywordRulesRef,
}: {
  isAuthenticated: boolean;
  currentUserId: string;
  setKeywordRules: React.Dispatch<React.SetStateAction<KeywordRule[]>>;
  keywordRulesRef: React.MutableRefObject<KeywordRule[]>;
}): KeywordRulesActionsContextType {
  const addKeywordRule = useCallback(async (keyword: string, categoryId: string): Promise<MutationResult> => {
    const validation = KeywordMappingSchema.safeParse({ keyword, categoryId });
    if (!validation.success) {
      return { success: false, error: formatZodIssues(validation.error) };
    }
    // The schema trims and lower-cases the keyword, so use its parsed output.
    const cleaned = validation.data.keyword;

    if (isAuthenticated) {
      const { data, error } = await supabase
        .from('keyword_rules')
        .insert({
          user_id: currentUserId,
          keyword: cleaned,
          category_id: categoryId,
        })
        .select()
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to save keyword rule' };
      }

      setKeywordRules((prev) => [mapKeywordRuleRow(data), ...prev]);
    } else {
      const newRule: KeywordRule = {
        id: generateEntityId('kr'),
        userId: currentUserId,
        keyword: cleaned,
        categoryId,
        createdAt: new Date().toISOString(),
      };
      setKeywordRules((prev) => [newRule, ...prev]);
    }

    return { success: true };
  }, [isAuthenticated, currentUserId, setKeywordRules]);

  // Hard delete, not soft: `KeywordRule` has no `isDeleted` field and no
  // migration adds one - it is categorization config, not a financial record,
  // so CLAUDE.md's soft-delete rule does not apply here.
  const deleteKeywordRule = useCallback(async (id: string): Promise<MutationResult> => {
    const previousIndex = keywordRulesRef.current.findIndex((r) => r.id === id);
    const previousRule = previousIndex >= 0 ? keywordRulesRef.current[previousIndex] : undefined;

    setKeywordRules((prev) => prev.filter((r) => r.id !== id));

    if (!isAuthenticated) {
      return { success: true };
    }

    try {
      const { error } = await supabase.from('keyword_rules').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      console.error('[Delete Keyword Rule Failed]', err);
      // Local removal drops the row from the array rather than flipping a
      // flag, so rollback re-inserts it at its original index instead of
      // restoring a snapshot of the whole array.
      if (previousRule) {
        setKeywordRules((prev) => {
          const next = [...prev];
          next.splice(previousIndex, 0, previousRule);
          return next;
        });
      }
      const postgrestErr = err as { message?: string; details?: string; hint?: string };
      return {
        success: false,
        error:
          postgrestErr?.message ||
          postgrestErr?.details ||
          postgrestErr?.hint ||
          (err instanceof Error ? err.message : 'Failed to delete keyword rule'),
      };
    }
  }, [isAuthenticated, setKeywordRules, keywordRulesRef]);

  return useMemo(() => ({ addKeywordRule, deleteKeywordRule }), [addKeywordRule, deleteKeywordRule]);
}

/** Rendered by `FinanceProvider` inside its own two providers. */
export function KeywordRulesProvider({
  keywordRules,
  actions,
  children,
}: {
  keywordRules: KeywordRule[];
  actions: KeywordRulesActionsContextType;
  children: React.ReactNode;
}) {
  const state = useMemo(() => ({ keywordRules }), [keywordRules]);
  return (
    <KeywordRulesActionsContext.Provider value={actions}>
      <KeywordRulesStateContext.Provider value={state}>{children}</KeywordRulesStateContext.Provider>
    </KeywordRulesActionsContext.Provider>
  );
}

/** The smart rules. Re-renders the caller on a rule write, not on a ledger write. */
export function useKeywordRulesState(): KeywordRulesStateContextType {
  const context = useContext(KeywordRulesStateContext);
  if (!context) throw new Error('useKeywordRulesState must be used within a FinanceProvider');
  return context;
}

/** The rules' writes. Stable for a session. */
export function useKeywordRulesActions(): KeywordRulesActionsContextType {
  const context = useContext(KeywordRulesActionsContext);
  if (!context) throw new Error('useKeywordRulesActions must be used within a FinanceProvider');
  return context;
}
