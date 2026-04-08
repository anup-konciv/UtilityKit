# 00 · Foundation Changelog

This is the first wave of improvements off the back of the per-tool docs. It focuses on **shared infrastructure that lifts many tools at once** rather than polishing individual screens. Visual style was kept intact (refine-not-rebuild).

> **One install needed:** the new notifications layer assumes `expo-notifications` will be installed when you're ready to ship the feature:
>
> ```sh
> npx expo install expo-notifications
> ```
>
> Until that runs, every notification call **safely no-ops** — nothing crashes, nothing schedules. Once installed, every wired tool starts firing real local notifications without further code changes.

---

## What changed

### New shared infrastructure

| File | What it is |
|---|---|
| `lib/haptics.ts` | Semantic wrapper around `expo-haptics` (`tap`, `selection`, `success`, `warning`, `error`, `medium`, `heavy`). Honours a global `KEYS.hapticsEnabled` flag, no-ops on web, never throws. |
| `lib/notifications.ts` | Local-notification layer over `expo-notifications`: `schedule`, `cancel`, `cancelNamespace`, `fireNow`, `requestNotificationPermission`, `notificationsReady`, `configureNotifications`. Per-tool namespaces (`reminder`, `habit`, `subscription`, `doc-expiry`, `birthday`, `pomodoro`, `custom`). Persists an audit index in AsyncStorage so a future Settings screen can list everything that's scheduled. **Lazy-requires the package** so missing `expo-notifications` is a runtime no-op, not a compile error. |
| `lib/use-tool-history.ts` | Generic AsyncStorage-backed history hook for stateless calculators. Each tool gets its own slot inside `KEYS.toolHistory`. Returns `{ entries, push, remove, clear, loading }`. |
| `lib/pin.ts` | `hashPin` / `verifyPin` SHA-256 helpers (with constant-time compare). Replaces ad-hoc `===` PIN comparisons. |
| `components/EmptyState.tsx` | Shared icon + title + hint + CTA empty state. Theme-aware, accent-aware, optionally compact. |
| `components/EmployeeTracker.tsx` | The shared "salary attendance" scaffold. Replaces ~600 LOC of duplication × 4 tools. |

### Storage map cleanup (`lib/storage.ts`)

Three new keys, four outliers absorbed:

- **Added:** `KEYS.bmiHistory`, `KEYS.notificationsEnabled`, `KEYS.toolHistory`.
- **Migrated to use central `KEYS`:** `weather.tsx`, `world-clock.tsx`, `pomodoro.tsx`, `bmi-calculator.tsx` no longer hardcode local string constants. This is required so a future "Backup & Restore" tool can enumerate every persisted slice in one pass.

### Refactor: collapse the home-service tracker cluster

Cook / Maid / Driver / Office Boy were the same ~600-line file four times.

```text
BEFORE                                  AFTER
─────────────────────────────────────   ────────────────────────────────────────
cook-tracker.tsx          580 LOC       cook-tracker.tsx         13 LOC (wrapper)
maid-tracker.tsx          563 LOC       maid-tracker.tsx         13 LOC (wrapper)
driver-tracker.tsx        628 LOC       driver-tracker.tsx       13 LOC (wrapper)
office-boy-tracker.tsx    628 LOC       office-boy-tracker.tsx   13 LOC (wrapper)
                         ─────                                  ─────
                         2 399 LOC                                52 LOC
                                        + components/EmployeeTracker.tsx  960 LOC
                                                                ─────────
                                                                1 012 LOC
```

That's a **~58 % LOC reduction**, but the bigger win is that bug fixes (e.g. month-edge daily-rate math, payment rounding, rendering polish, future "deductions" / "bonuses" / "PDF salary slip" features) only need to land **once**.

Each wrapper now reads:

```tsx
import EmployeeTracker from '@/components/EmployeeTracker';
import { KEYS } from '@/lib/storage';

export default function CookTrackerScreen() {
  return (
    <EmployeeTracker
      storageKey={KEYS.cookTracker}
      defaultName="Cook"
      accent="#D97706"
      placeholderSalary="e.g. 8000"
    />
  );
}
```

The shared component also picked up two upgrades during the migration:
- **Haptics** on every interaction (`toggleAttendance`, `saveSettings`, `addPayment`, `prevMonth`/`nextMonth`, `viewMode` swap).
- **EmptyState** when monthly salary is zero, with a CTA that opens the Settings modal — replaces the previous silent "your earned amount is ₹0" no-help moment.

Adding a new "salary attendance" role (gardener, tutor, security guard, …) is now one storage key + one route file.

### Security: hashed Notes PINs

`tools/notes.tsx` previously stored per-note PINs as **plaintext strings** and compared them with `===`. They are now SHA-256 hashed via `lib/pin.ts`, matching what Doc Vault has always done.

Includes a **transparent migration**: any existing locked note with a plaintext `pin` field is hashed and re-saved on first launch (one-shot, then forgotten). The on-disk schema has shifted from `{ pin: string }` to `{ pinHash: string }`. The editor was updated so:
- **Brand-new lock**: requires 4 digits, hashed on save.
- **Existing locked note**: default action is "no change to PIN" — the hash carries over. Typing in the PIN field now sets a `pinDirty` flag and only then is the new PIN required + re-hashed.

### Notifications wired into Reminder

`tools/reminder.tsx` now schedules a real notification on save (with daily/weekly repeat), cancels on delete, and re-schedules / cancels when toggling done. Monthly is currently treated as one-shot since `expo-notifications` calendar triggers don't natively support a "first weekday of month" schedule — flagged as a future improvement.

A `useEffect` in `app/_layout.tsx` calls `configureNotifications()` once on app boot. This is a no-op until `expo-notifications` is installed.

### Notifications wired into Pomodoro

`tools/pomodoro.tsx` now calls `fireNow(...)` when a session completes — the user gets a system notification ("Focus session complete" / "Break finished") even if the app is backgrounded. Combined with the existing `expo-haptics` success vibration. Replaces the raw `Vibration.vibrate([0, 400, 200, 400])` pattern.

### Haptics rolled out across all `Vibration.vibrate` callers

Replaced raw `Vibration` API calls with semantic `haptics.*` helpers in five tools:

| Tool | Before | After |
|---|---|---|
| `basic-calculator.tsx` | `Vibration.vibrate(10)` | `haptics.tap()` (per key) + `haptics.success()` on `=` + `haptics.error()` on Error + `haptics.warning()` on history clear |
| `scientific-calculator.tsx` | `Vibration.vibrate(10)` | `haptics.tap()` per key + `haptics.success()` on commit + `haptics.warning()` on history clear |
| `pomodoro.tsx` | `Vibration.vibrate([0, 400, 200, 400])` | `haptics.success()` + `fireNow(...)` notification |
| `tally-counter.tsx` | `Vibration.vibrate(10)` | `haptics.tap()` |
| `dice-coin.tsx` | `Vibration.vibrate(40)` ×2 | `haptics.medium()` ×2 |

The `haptics` wrapper centralises this so future tools can drop in haptics without re-thinking the semantic vocabulary.

### Persisted history in calculators

Two calculators now use `useToolHistory` so their history survives app close:

- **Basic Calculator** — replaced its in-memory `useState<string[]>([])` with `useToolHistory<{ expr; result }>('basic-calc', { max: 12 })`. Tap an old result to restore it as the next operand. Clear button gets a warning haptic.
- **Scientific Calculator** — same swap, `'sci-calc'` slot, `max: 12`. Restoring an old expression continues to work via the existing `restoreHistory` path.

Other stateless calculators (Percentage, Matrix, Tip, Date Calc, Age Calc, EMI, Loan Comparison, Fuel, Unit Price, Currency, JSON, Base, Color, QR) are now ready to opt in with two lines each — left as a follow-up so this PR stays focused.

---

## How a tool wires up the new infra

### Haptics

```tsx
import { haptics } from '@/lib/haptics';

// On a button press
<TouchableOpacity onPress={() => { haptics.tap(); doThing(); }} />

// On a successful save
haptics.success();
```

### Persisted history

```tsx
import { useToolHistory } from '@/lib/use-tool-history';

type Inputs = { amount: number; rate: number; years: number };
const history = useToolHistory<Inputs>('emi-calc', { max: 20 });

// when calculation runs
history.push({ amount, rate, years },
  `₹${amount.toLocaleString()} • ${rate}% • ${years}y`);

// restore on tap
{history.entries.map(e => (
  <TouchableOpacity key={e.id} onPress={() => setInputs(e.value)}>
    <Text>{e.label}</Text>
  </TouchableOpacity>
))}
```

### Notifications

```tsx
import { schedule, cancel } from '@/lib/notifications';

await schedule({
  id: subscription.id,
  namespace: 'subscription',
  title: `${subscription.name} renews tomorrow`,
  body: `₹${subscription.amount} will be charged on ${subscription.nextBilling}`,
  date: oneDayBefore(subscription.nextBilling),
  // 'none' | 'daily' | 'weekly' — monthly is currently one-shot
  repeat: 'none',
});

// on delete
await cancel('subscription', subscription.id);
```

### Empty state

```tsx
import EmptyState from '@/components/EmptyState';

<EmptyState
  icon="trending-up-outline"
  title="No habits yet"
  hint="Track up to 12 habits at once. Add your first one to start building a streak."
  accent="#8B5CF6"
  actionLabel="Create habit"
  onAction={() => setShowEditor(true)}
/>
```

### Hashed PINs

```tsx
import { hashPin, verifyPin } from '@/lib/pin';

// store on save
const pinHash = await hashPin(plaintextPin);

// check on unlock
if (await verifyPin(entered, storedHash)) { /* unlock */ }
```

---

## What's *not* in this wave

These were tracked in the per-tool docs but deferred so this PR stays reviewable:

- Wiring `useToolHistory` into the remaining 12+ stateless calculators (mechanical work, ~3 lines each).
- Wiring notifications into Habit Tracker, Subscription Manager, Document Expiry, Vehicle Service, House Bills, Birthday Tracker, Assignment Tracker (each is the same `schedule` call pattern as Reminder).
- A `DeliveryTracker` shared component for Milk / Water Can / Flower / Newspaper. The shape varies more than the salary cluster (dual slots vs single qty vs binary delivered/missed) so it deserves its own pass with explicit prop variants.
- A "Money" hub that converges Expense Tracker + Subscription Manager + House Bill Tracker on one transaction model.
- Backup / restore tooling (the foundations are now in place — every key is in `KEYS`, every tool round-trips JSON).
- An accessibility audit (`accessibilityLabel` / `accessibilityRole` on icon-only buttons + a contrast pass on dark-mode gradient cards).
- Replacing the single-file 75-tool grid with a search-aware command palette.

---

## Verification

```sh
npx tsc --noEmit          # ✅ exit 0
npx eslint <new files>    # ✅ 0 errors, 0 new warnings
```

The 3 pre-existing lint errors in `notes.tsx` and `weather.tsx` (`react/no-unescaped-entities`) and the handful of pre-existing unused-vars warnings were left untouched — they're outside the scope of this wave.
