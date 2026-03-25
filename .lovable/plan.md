

# Plan: Code Quality Improvements

Addressing four issues: voice state complexity, offline resilience, settings sync, and test coverage.

---

## 1. Simplify Voice Recognition State (useVoiceReminder refactor)

**Problem**: 768-line hook with module-level Maps (`scheduledReminders`, `repeatIntervals`), scattered state (7 useState calls), and complex restart logic in `onend`/`onerror`.

**Changes to `src/hooks/useVoiceReminder.tsx`**:
- Extract a `useVoiceRecognition` sub-hook that owns only speech recognition lifecycle (`start`, `stop`, `isListening`, `transcript`, `confidence`, `error`). This hook handles `onstart`, `onresult`, `onerror`, `onend` with a simple state machine: `idle → listening → processing → idle`.
- Extract a `useReminderScheduler` sub-hook that owns timer scheduling and repeat intervals using refs. Accepts logs and a `triggerReminder` callback.
- The main `useVoiceReminder` composes these two hooks plus the existing `speak` function.
- Move `scheduledReminders` and `repeatIntervals` Maps inside hooks as refs instead of module-level globals (avoids shared mutable state across component instances).
- Reduce state variables: merge `transcript`, `confidence`, `lastCommand`, `error` into a single `recognitionState` object with a reducer.

**New files**:
- `src/hooks/voice/useVoiceRecognition.tsx`
- `src/hooks/voice/useReminderScheduler.tsx`
- `src/hooks/voice/types.ts` (shared interfaces)

---

## 2. Offline Medication Logging

**Problem**: `useMedications` calls Supabase directly. If offline, `markAsTaken` and `snooze` fail silently. The existing `useOfflineSync` hook exists but is not integrated.

**Changes to `src/hooks/useMedications.tsx`**:
- Import and use `useOfflineSync` inside `useMedications`.
- Wrap `markAsTaken` and `snooze` in a try/catch that, on network failure, queues the action via `addPendingAction` and optimistically updates local `todayLogs` state.
- When back online, `onSync` callback replays queued actions against Supabase.
- Show a toast indicating "Saved offline — will sync when connected".

**Changes to `src/hooks/useOfflineSync.tsx`**:
- Add an `isSyncing` state for UI feedback.
- Add retry logic with exponential backoff (max 3 retries per action).

**Changes to `src/pages/PatientDashboard.tsx`**:
- Display a small offline indicator banner when `isOnline` is false.

---

## 3. Sync Settings to Database

**Problem**: User settings (`ezmed-settings` in localStorage) are lost when switching devices.

**Database migration** — new `user_settings` table:
```sql
CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own settings"
  ON public.user_settings FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**New file `src/hooks/useSettings.tsx`**:
- On mount: fetch from `user_settings` table. If found, merge with localStorage (DB wins). If not found, use localStorage defaults.
- On setting change: update localStorage immediately (for instant UI) AND debounce-write to DB (500ms).
- Expose `settings`, `updateSetting`, `isLoaded`.

**Changes to `src/pages/SettingsPage.tsx`**:
- Replace direct localStorage reads/writes with `useSettings` hook.

**Changes to `src/hooks/useVoiceReminder.tsx`**:
- Replace `getVoiceSettings()` localStorage reads with the shared settings from context or a direct import of `useSettings`.

---

## 4. Add Test Coverage

**Setup files** (new):
- `vitest.config.ts` — Vitest config with jsdom environment
- `src/test/setup.ts` — jest-dom matchers and matchMedia mock

**Test files** (new):
- `src/hooks/voice/__tests__/useVoiceRecognition.test.tsx` — Tests for start/stop/transcript state transitions
- `src/hooks/__tests__/useOfflineSync.test.tsx` — Tests for queueing actions offline, syncing when online, snooze timer expiry
- `src/hooks/__tests__/useSettings.test.tsx` — Tests for load from DB, fallback to localStorage, debounced save
- `src/hooks/__tests__/useMedications.test.tsx` — Tests for markAsTaken online/offline paths, optimistic updates

Each test file will mock Supabase client and use `renderHook` from `@testing-library/react`.

---

## Technical Details

| Area | Files Changed | Files Created |
|------|--------------|---------------|
| Voice refactor | `useVoiceReminder.tsx`, `PatientDashboard.tsx` | 3 files in `src/hooks/voice/` |
| Offline sync | `useMedications.tsx`, `useOfflineSync.tsx`, `PatientDashboard.tsx` | — |
| Settings sync | `SettingsPage.tsx`, `useVoiceReminder.tsx` | `useSettings.tsx`, 1 migration |
| Tests | — | `vitest.config.ts`, `src/test/setup.ts`, 4 test files |

## Implementation Order

1. Database migration (user_settings table)
2. `useSettings` hook + SettingsPage integration
3. Voice recognition refactor (extract sub-hooks)
4. Offline sync integration into useMedications
5. Test setup and test files

