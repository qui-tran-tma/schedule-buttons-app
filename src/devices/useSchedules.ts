// Load / save / delete schedules for the connected board.
import { useCallback, useEffect, useState } from 'react';
import { Schedule } from '@/proto/power_board';
import { useDevice } from './DeviceContext';
import { firstFreeSlot, usedSlots } from './schedules';

export function useSchedules() {
  const { info, status, state, notifyCount, request } = useDevice();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const maxSchedules = info?.maxSchedules ?? 0;
  const mask = status?.scheduleMask ?? 0;
  const active = state === 'connected' && maxSchedules > 0;
  const key = `${mask}/${notifyCount}`;

  /** GetSchedule for every used slot. No state writes here. */
  const fetchAll = useCallback(async (): Promise<Schedule[]> => {
    const out: Schedule[] = [];
    for (const id of usedSlots(mask, maxSchedules)) {
      try {
        const r = await request({ $case: 'getSchedule', getSchedule: { id } });
        if (r.payload?.$case === 'schedule') out.push(r.payload.schedule);
      } catch {
        // error already surfaced via context; skip this slot
      }
    }
    return out;
  }, [mask, maxSchedules, request]);

  // Reload when the used-slot mask changes or a seq=0 notify arrives (one-shot fired -> disabled).
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void fetchAll().then((list) => {
      if (cancelled) return;
      setSchedules(list);
      setLoadedKey(key);
    });
    return () => {
      cancelled = true;
    };
  }, [active, fetchAll, key]);

  const reload = useCallback(async () => {
    setSchedules(await fetchAll());
  }, [fetchAll]);

  const save = useCallback(
    async (s: Schedule) => {
      await request({ $case: 'setSchedule', setSchedule: { schedule: s } });
      await reload();
    },
    [request, reload],
  );

  const remove = useCallback(
    async (id: number) => {
      await request({ $case: 'deleteSchedule', deleteSchedule: { id } });
      await reload();
    },
    [request, reload],
  );

  return {
    schedules: active ? schedules : [],
    loading: active && loadedKey !== key,
    maxSchedules,
    freeSlot: firstFreeSlot(mask, maxSchedules),
    reload,
    save,
    remove,
  };
}
