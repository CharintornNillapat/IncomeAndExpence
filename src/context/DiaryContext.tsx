import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { DiaryEntry } from '../types';
import type { MutationResult } from './FinanceContext';
import { supabase } from '../lib/supabase';
import { DiarySchema, formatZodIssues } from '../utils/zodSchemas';

/*
 * Phase 116 (ADR 0092): the diary slice, the first one out of FinanceContext.
 *
 * It has contexts of its own, so a diary write re-renders only what reads the
 * diary, and a ledger write leaves a diary-only reader alone. It is composed
 * under `FinanceProvider`, not beside it, because three things stay there on
 * purpose:
 *   - the one batched `localStorage` writer, which registers `pf_diary`;
 *   - the one cloud load, which reads `diary_entries` with the other tables so
 *     "every read succeeded" still means all of them (ADR 0022), and its
 *     sign-out epoch checks;
 *   - the sign-out reset and the backup restore, which replace every slice.
 * Those call `setDiaryEntries`; nothing else outside this file does.
 */

export type DiaryEntryInput = Omit<DiaryEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isDeleted'>;

export interface DiaryStateContextType {
  diaryEntries: DiaryEntry[];
}

export interface DiaryActionsContextType {
  upsertDiaryEntry: (entry: DiaryEntryInput) => Promise<MutationResult>;
  deleteDiaryEntry: (id: string) => Promise<MutationResult>;
}

const DiaryStateContext = createContext<DiaryStateContextType | undefined>(undefined);
const DiaryActionsContext = createContext<DiaryActionsContextType | undefined>(undefined);

/** A `diary_entries` row as the app holds it. */
export function mapDiaryRow(row: {
  id: string;
  user_id: string;
  date: string;
  mood: number;
  workout: boolean | null;
  workout_note: string | null;
  food_quality: DiaryEntry['foodQuality'];
  notes: string | null;
  is_deleted: boolean | null;
  created_at: string;
  updated_at: string;
}): DiaryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    mood: row.mood,
    workout: row.workout || false,
    workoutNote: row.workout_note || undefined,
    foodQuality: row.food_quality,
    notes: row.notes || undefined,
    isDeleted: row.is_deleted || false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The slice's state, with the ref mirror its actions read (ADR 0022). */
export function useDiaryEntriesState(load: () => DiaryEntry[]) {
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>(load);
  const diaryEntriesRef = useRef<DiaryEntry[]>(diaryEntries);
  useEffect(() => {
    diaryEntriesRef.current = diaryEntries;
  }, [diaryEntries]);
  return { diaryEntries, setDiaryEntries, diaryEntriesRef };
}

/** The slice's two writes. A signed-in save reloads from the cloud, as before. */
export function useDiaryMutations({
  isAuthenticated,
  currentUserId,
  markLocalWrite,
  refreshFromCloud,
  setDiaryEntries,
  diaryEntriesRef,
}: {
  isAuthenticated: boolean;
  currentUserId: string;
  markLocalWrite: (id?: string | null) => void;
  refreshFromCloud: () => Promise<void>;
  setDiaryEntries: React.Dispatch<React.SetStateAction<DiaryEntry[]>>;
  diaryEntriesRef: React.MutableRefObject<DiaryEntry[]>;
}): DiaryActionsContextType {
  const upsertDiaryEntry = useCallback(async (entryData: DiaryEntryInput): Promise<MutationResult> => {
    const validation = DiarySchema.safeParse(entryData);
    if (!validation.success) {
      return { success: false, error: formatZodIssues(validation.error) };
    }

    if (isAuthenticated) {
      const existing = diaryEntriesRef.current.find((e) => e.date === entryData.date && !e.isDeleted);
      const { data: upserted, error } = existing
        ? await supabase
            .from('diary_entries')
            .update({
              mood: entryData.mood,
              workout: entryData.workout,
              workout_note: entryData.workoutNote || null,
              food_quality: entryData.foodQuality,
              notes: entryData.notes || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select()
            .single()
        : await supabase
            .from('diary_entries')
            .insert({
              user_id: currentUserId,
              date: entryData.date,
              mood: entryData.mood,
              workout: entryData.workout,
              workout_note: entryData.workoutNote || null,
              food_quality: entryData.foodQuality,
              notes: entryData.notes || null,
            })
            .select()
            .single();

      if (error) {
        return { success: false, error: error.message || 'Failed to save diary entry' };
      }

      markLocalWrite(existing?.id ?? upserted?.id);
      await refreshFromCloud();
    } else {
      setDiaryEntries((prev) => {
        const existingIdx = prev.findIndex((e) => e.date === entryData.date && !e.isDeleted);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            ...entryData,
            updatedAt: new Date().toISOString(),
          };
          return updated;
        } else {
          const newEntry: DiaryEntry = {
            ...entryData,
            id: `diary-${Date.now()}`,
            userId: currentUserId,
            isDeleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          return [newEntry, ...prev];
        }
      });
    }

    return { success: true };
  }, [isAuthenticated, currentUserId, refreshFromCloud, markLocalWrite, setDiaryEntries, diaryEntriesRef]);

  const deleteDiaryEntry = useCallback(async (id: string): Promise<MutationResult> => {
    const previousDiaryEntries = diaryEntriesRef.current;

    setDiaryEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isDeleted: true, updatedAt: new Date().toISOString() } : e))
    );

    if (!isAuthenticated) {
      return { success: true };
    }

    try {
      markLocalWrite(id);
      const { error } = await supabase
        .from('diary_entries')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      console.error('[Delete Diary Entry Failed]', err);
      setDiaryEntries(previousDiaryEntries);
      const postgrestErr = err as { message?: string; details?: string; hint?: string };
      return {
        success: false,
        error:
          postgrestErr?.message ||
          postgrestErr?.details ||
          postgrestErr?.hint ||
          (err instanceof Error ? err.message : 'Failed to delete diary entry'),
      };
    }
  }, [isAuthenticated, markLocalWrite, setDiaryEntries, diaryEntriesRef]);

  return useMemo(() => ({ upsertDiaryEntry, deleteDiaryEntry }), [upsertDiaryEntry, deleteDiaryEntry]);
}

/** Rendered by `FinanceProvider` inside its own two providers. */
export function DiaryProvider({
  diaryEntries,
  actions,
  children,
}: {
  diaryEntries: DiaryEntry[];
  actions: DiaryActionsContextType;
  children: React.ReactNode;
}) {
  const state = useMemo(() => ({ diaryEntries }), [diaryEntries]);
  return (
    <DiaryActionsContext.Provider value={actions}>
      <DiaryStateContext.Provider value={state}>{children}</DiaryStateContext.Provider>
    </DiaryActionsContext.Provider>
  );
}

/** The diary entries. Re-renders the caller on a diary write, not on a ledger write. */
export function useDiaryState(): DiaryStateContextType {
  const context = useContext(DiaryStateContext);
  if (!context) throw new Error('useDiaryState must be used within a FinanceProvider');
  return context;
}

/** The diary's writes. Stable for a session. */
export function useDiaryActions(): DiaryActionsContextType {
  const context = useContext(DiaryActionsContext);
  if (!context) throw new Error('useDiaryActions must be used within a FinanceProvider');
  return context;
}
