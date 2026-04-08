/**
 * Generic AsyncStorage-backed "recent calculations" hook.
 *
 * Stateless calculators (Basic, Scientific, EMI, Tip, Currency, Date Calc,
 * Color, JSON, …) all want the same thing: keep the last N inputs/outputs
 * around so that reopening the tool restores something useful and the user
 * can tap to restore a previous calculation. Each tool used to have to roll
 * its own AsyncStorage logic; this hook centralises it.
 *
 * Storage layout:
 *   `KEYS.toolHistory` → { [toolId]: HistoryEntry[] }
 *
 *   HistoryEntry = {
 *     id:    string;     // unique
 *     at:    number;     // unix ms
 *     label: string;     // human readable summary
 *     value: T;          // arbitrary tool-specific payload
 *   }
 *
 * Usage in a tool file:
 *
 *   type EmiInputs = { amount: number; rate: number; years: number };
 *   const history = useToolHistory<EmiInputs>('emi-calc', { max: 20 });
 *
 *   // when calculation runs:
 *   history.push({ amount, rate, years },
 *     `₹${amount.toLocaleString()} • ${rate}% • ${years}y`);
 *
 *   // restore on tap:
 *   history.entries.map(e => <Btn onPress={() => setInputs(e.value)} />);
 *
 *   // clear:
 *   history.clear();
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadJSON, saveJSON, KEYS } from './storage';

export type HistoryEntry<T> = {
  id: string;
  at: number;
  label: string;
  value: T;
};

type Bag = Record<string, HistoryEntry<unknown>[]>;

const DEFAULT_MAX = 15;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function loadBag(): Promise<Bag> {
  return loadJSON<Bag>(KEYS.toolHistory, {});
}

async function saveBag(bag: Bag): Promise<void> {
  await saveJSON(KEYS.toolHistory, bag);
}

export type UseToolHistoryOptions = {
  /** Maximum entries to keep (oldest evicted). Default 15. */
  max?: number;
};

export type UseToolHistoryResult<T> = {
  entries: HistoryEntry<T>[];
  /** Push a new entry. Returns the entry that was added. */
  push: (value: T, label: string) => HistoryEntry<T>;
  /** Remove a single entry by id. */
  remove: (id: string) => void;
  /** Wipe all history for this tool. */
  clear: () => void;
  /** True until the first AsyncStorage hydration completes. */
  loading: boolean;
};

export function useToolHistory<T>(
  toolId: string,
  options: UseToolHistoryOptions = {}
): UseToolHistoryResult<T> {
  const max = options.max ?? DEFAULT_MAX;
  const [entries, setEntries] = useState<HistoryEntry<T>[]>([]);
  const [loading, setLoading] = useState(true);
  // Hold a ref to current entries so callbacks are stable across renders.
  const entriesRef = useRef<HistoryEntry<T>[]>([]);
  entriesRef.current = entries;

  // Hydrate on mount.
  useEffect(() => {
    let mounted = true;
    loadBag().then((bag) => {
      if (!mounted) return;
      const list = (bag[toolId] ?? []) as HistoryEntry<T>[];
      setEntries(list);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [toolId]);

  const persist = useCallback(
    async (next: HistoryEntry<T>[]) => {
      const bag = await loadBag();
      bag[toolId] = next as HistoryEntry<unknown>[];
      await saveBag(bag);
    },
    [toolId]
  );

  const push = useCallback(
    (value: T, label: string): HistoryEntry<T> => {
      const entry: HistoryEntry<T> = { id: uid(), at: Date.now(), label, value };
      const next = [entry, ...entriesRef.current].slice(0, max);
      setEntries(next);
      void persist(next);
      return entry;
    },
    [max, persist]
  );

  const remove = useCallback(
    (id: string) => {
      const next = entriesRef.current.filter((e) => e.id !== id);
      setEntries(next);
      void persist(next);
    },
    [persist]
  );

  const clear = useCallback(() => {
    setEntries([]);
    void persist([]);
  }, [persist]);

  return { entries, push, remove, clear, loading };
}
