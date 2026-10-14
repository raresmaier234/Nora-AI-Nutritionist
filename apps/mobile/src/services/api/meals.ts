import { apiRequest } from './client';
import type { FoodLogEntry, FoodLogEntryCreate, FoodLogEntryUpdate } from './types';

const ENTRIES = '/meals/entries';

/** Every food logged on `date` (YYYY-MM-DD), in the order eaten. */
export function listEntries(date: string): Promise<FoodLogEntry[]> {
  return apiRequest<FoodLogEntry[]>(`${ENTRIES}?${new URLSearchParams({ date })}`, { method: 'GET' });
}

export function createEntry(body: FoodLogEntryCreate): Promise<FoodLogEntry> {
  return apiRequest<FoodLogEntry>(ENTRIES, { method: 'POST', body });
}

export function updateEntry(id: number, body: FoodLogEntryUpdate): Promise<FoodLogEntry> {
  return apiRequest<FoodLogEntry>(`${ENTRIES}/${id}`, { method: 'PATCH', body });
}

export function deleteEntry(id: number): Promise<void> {
  return apiRequest<void>(`${ENTRIES}/${id}`, { method: 'DELETE' });
}

/** Copy every entry of `fromDate` onto `toDate`; resolves with the new entries. */
export function copyDay(fromDate: string, toDate: string): Promise<FoodLogEntry[]> {
  return apiRequest<FoodLogEntry[]>(`${ENTRIES}/copy`, {
    method: 'POST',
    body: { from_date: fromDate, to_date: toDate },
  });
}
