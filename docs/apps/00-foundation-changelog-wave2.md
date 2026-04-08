# 00 · Foundation Changelog — Wave 2

This is the second wave of improvements off the back of the per-tool docs. Wave 1 ([`00-foundation-changelog.md`](./00-foundation-changelog.md)) put the shared infra in place — haptics, notifications, history hook, hashed PINs, EmployeeTracker refactor, KEYS centralisation. Wave 2 **applies that infra to the rest of the app** and adds two more shared pieces (cache layer + location module + DeliveryTracker refactor).

> Like wave 1, two install commands unlock features that are wired but currently no-op:
>
> ```sh
> npx expo install expo-notifications
> npx expo install expo-location
> ```
>
> Both modules in `lib/` lazy-require their underlying packages so missing deps are runtime no-ops, never compile errors. Once installed, every wired tool starts working without further changes.

---

## What changed

### New shared infrastructure

| File | What it is |
|---|---|
| `lib/cache.ts` | Tiny TTL key/value cache for live-network tools. `cache.get<T>(key, ttlMs)` returns `{ value, ageMs, fresh }`, `cache.set(key, value)` stores with timestamp. Used by Weather (30 min TTL) and Currency Converter (12 h TTL) so they survive offline reloads. |
| `lib/location.ts` | Lazy-require wrapper around `expo-location`. Exposes `getCurrentPosition`, `requestLocationPermission`, `reverseGeocode` returning a stable `CoarseFix` shape so callers don't depend on the package's type surface. |
| `components/DeliveryTracker.tsx` | The shared "delivery log + payment ledger" scaffold. One component handles three modes: `qty-dual` (Milk), `qty-single` (Water Can), and `binary` (Flower, Newspaper). |

### Refactor: collapse the delivery tracker cluster

Milk, Water Can, Flower and Newspaper trackers had ~2 000 LOC of duplicated calendar/list/payment-log scaffolding. They split cleanly into three shapes:

- **Milk** — two quantity slots per day (morning + evening), per-litre pricing.
- **Water Can** — single quantity per day, per-can pricing, payment log.
- **Flower** — binary delivered/missed, per-day pricing, payment log.
- **Newspaper** — binary delivered/missed, fixed monthly subscription, no payment log.

One unified `DeliveryTracker` component now handles all four via a `mode` prop and a small set of variant flags (`subscription`, `showPaymentLog`, `slot1`/`slot2`).

```text
BEFORE                                  AFTER
─────────────────────────────────────   ────────────────────────────────────────
milk-tracker.tsx          488 LOC       milk-tracker.tsx         24 LOC (wrapper)
water-can-tracker.tsx     592 LOC       water-can-tracker.tsx    19 LOC (wrapper)
flower-tracker.tsx        558 LOC       flower-tracker.tsx       18 LOC (wrapper)
newspaper-tracker.tsx     387 LOC       newspaper-tracker.tsx    20 LOC (wrapper)
                         ─────                                  ─────
                         2 025 LOC                                 81 LOC
                                        + components/DeliveryTracker.tsx 1 336 LOC
                                                                ─────────
                                                                1 417 LOC
```

That's **~30% LOC reduction** — but again, the bigger win is bug-fix-times-four becoming bug-fix-once. Adding a new delivery service (gas cylinders, vegetable boxes, …) is now one wrapper file plus a config object.

The shared component also gained:
- Haptics on every interaction (toggle, mark, save settings, payment).
- An EmptyState when the price isn't configured yet, with a CTA into Settings.

### Notifications wired into 7 reminder-style tools

Wave 1 already wired Reminder + Pomodoro. Wave 2 wired the rest of the calendar-aware tools to schedule real local notifications:

| Tool | Notification |
|---|---|
| **Habit Tracker** | Daily 9 AM reminder per habit. Cancelled on delete. |
| **Subscription Manager** | One-shot at 9 AM the day before next billing. Cancelled on delete or status change to `cancelled`. |
| **Document Expiry** | One-shot at 9 AM, 30 days before the expiry date. Re-scheduled on edit. |
| **Birthday Tracker** | One-shot at 9 AM on the next occurrence of the birthday (rolls forward when current year is past). |
| **Assignment Tracker** | One-shot at 9 AM, 24 h before the due date. Cancelled when status flips to `completed`. |
| **House Bill Tracker** | One-shot at 9 AM, 3 days before the due date. Cancelled when bill is marked paid. |
| **Vehicle Service** | One-shot at 9 AM, 7 days before the next service is due. Re-scheduled when a new service is logged. |

All seven also picked up semantic haptics (`success` on save, `warning` on delete, `tap` on status toggle) and use the same `cancel(namespace, id)` pattern from `lib/notifications.ts`.

### Cache layer wired into live-network tools

| Tool | TTL | Behaviour |
|---|---|---|
| **Weather** | 30 min | Hydrates from cache instantly on open. If fresh, skips the network call entirely. If stale, paints cached data first while re-fetching in the background. On network failure with cached data, the cached values keep showing. |
| **Currency Converter** | 12 h | Same pattern. If we have a cached rate set, the grid is never blank — even on a base-currency change with no signal. |

The same pattern applies straightforwardly to News Reader and Translate; both flagged as wave-3 follow-ups.

### Weather: GPS auto-locate

`tools/weather.tsx` search modal now has a "Use my location" pill at the top that calls `getCurrentPosition()` + `reverseGeocode()` from `lib/location.ts`. Same lazy-require pattern as notifications: until you run `npx expo install expo-location`, the button shows an inline message explaining that it needs the package; after install, it just works.

### Backup / restore (`lib/backup.ts`) + Settings UI

The Settings screen used to roll its own AsyncStorage walk for export/import, with only a clipboard transport. That logic has moved to `lib/backup.ts`:

```ts
import { exportToFile, importFromFile, exportToClipboard, importFromClipboard, resetAll } from '@/lib/backup';
```

The module exposes:
- `buildBackup()` / `restoreBackup(blob)` — build and parse versioned blobs.
- `summarise()` — populated key count + byte size for the UI.
- `exportToFile()` — writes a `utilitykit-backup-YYYY-MM-DDTHH-mm-ss.json` to the cache dir and opens the native share sheet (`expo-sharing`).
- `importFromFile()` — opens the document picker (`expo-document-picker`) and restores.
- `exportToClipboard()` / `importFromClipboard()` — text-based fallback.
- `resetAll()` — wipe-everything.

The Settings screen now has 4 buttons (Backup to File, Restore from File, Copy to Clipboard, Paste from Clipboard) plus the existing Reset, all using the shared module. The backup format is versioned (`{ version: 1, exportedAt, appName, data }`) and the restore path is **conservative — keys not in the central `KEYS` map are silently dropped** so a malformed backup can't pollute storage.

### `useToolHistory` rolled out across stateless calculators

Wave 1 wired Basic Calculator and Scientific Calculator. Wave 2 wired the rest:

| Tool | Slot ID | What's saved |
|---|---|---|
| **Tip Calculator** | `tip-calc` | bill, tip %, people, service preset |
| **EMI Calculator** | `emi-calc` | principal, rate, tenure, unit + EMI label |
| **Currency Converter** | `currency-favs` | pinned (from, to) currency pairs |
| **Percentage Calculator** | `percent-calc` | mode + a + b inputs |
| **Date Calculator** | `date-calc` | mode + (start/end) or (start/days/op) |
| **Loan Comparison** | `loan-compare` | full Loan[] array |
| **Fuel Cost** | `fuel-cost` | full trip params |
| **JSON Formatter** | `json-formatter` | input snippet, with key/depth label |
| **QR Generator** | `qr-gen` | text + preset, auto-saved on Generate |
| **Color Tools** | `color-palette` | up to 24 saved colours, long-press to remove |
| **Base Converter** | `base-conv` | active base + input |
| **Matrix Calculator** | `matrix-calc` | size + matA + matB + op |

Each tool gets a "Save" button on the result card and a "Recent" / "Saved" / "Pinned" panel that lets the user tap to restore prior inputs. All saves trigger `haptics.success()`, all clears trigger `haptics.warning()`, and the persistence uses the existing `KEYS.toolHistory` namespace.

### EmptyState rollout

Wave 1 added the shared `EmptyState` component and wired Habit Tracker, Routine Tracker and Reminder. Wave 2 extended it to:

- **Savings Goal** — replaces the bare "No savings goals yet" with an actionable CTA into the create-goal modal.
- **Travel Tracker** — replaces the icon+label empty with a "Plan a trip" CTA.
- **Flashcards** — both the deck list and the in-deck card list now use `EmptyState` (each with the deck's accent colour for contrast).
- **Event Countdown** — replaces the bare empty with a "Add countdown" CTA.

Tools that already had their own rich empty states with tips (Notes, Todo Manager, Subscription Manager, Document Expiry, Markdown Notepad, Maintenance Tracker, Birthday Tracker, Grocery List) were left untouched — their existing UX is good enough.

### Haptics across checkbox / toggle interactions

Wave 1 only touched buttons with raw `Vibration` calls. Wave 2 wired semantic haptics into list-row interactions in the highest-traffic tools:

| Tool | What changed |
|---|---|
| **Todo Manager** | `toggleTodo()` → `success` on done, `tap` on undo. `removeTodo` and `clearCompleted` → `warning`. |
| **Grocery List** | `toggleChecked()` → `success` on check, `tap` on uncheck. `toggleFavorite()` → `selection`. `removeItem` and `clearChecked` → `warning`. |
| **Savings Goal** | Deposit that completes a goal → `success`. Regular deposits / withdrawals → `tap`. Invalid amount → `error`. Delete goal → `warning`. |
| **Birthday Tracker / Doc Expiry / Subscription Manager / House Bills / Vehicle Service / Habit Tracker / Assignment Tracker** | Already wired in the notifications section above (every save → `success`, every delete → `warning`, every status toggle → `tap`). |

Same semantic vocabulary as wave 1: `tap` for selection, `selection` for picker changes, `success` for completion, `warning` for destructive actions, `error` for invalid input.

### `KEYS` centralisation: BMI Calculator

Wave 1 migrated the four obvious outliers (Weather, World Clock, Pomodoro, BMI). The BMI Calculator's history slot is now `KEYS.bmiHistory` everywhere — no inline string constants left. This is the prerequisite for backup/restore to enumerate every persisted slice.

---

## How a tool wires up the new wave-2 infra

### Cache layer

```ts
import { cache } from '@/lib/cache';

const cached = await cache.get<MyData>('news:headlines', 30 * 60 * 1000);
if (cached?.fresh) return cached.value;
try {
  const fresh = await fetchHeadlines();
  await cache.set('news:headlines', fresh);
  return fresh;
} catch {
  if (cached) return cached.value; // offline fallback
  throw new Error('Network failed');
}
```

### GPS

```ts
import { getCurrentPosition, reverseGeocode } from '@/lib/location';

const fix = await getCurrentPosition();           // null = no permission / no package
if (fix) {
  const named = await reverseGeocode(fix);        // null = lookup failed
  // use fix.latitude / fix.longitude / named?.name
}
```

### Backup

```ts
import { exportToFile, importFromFile } from '@/lib/backup';

await exportToFile();                             // opens native share sheet
const restoredCount = await importFromFile();     // opens document picker, returns count or null on cancel
```

### Notifications (subscription example)

```ts
import { schedule, cancel } from '@/lib/notifications';

await schedule({
  id: subscription.id,
  namespace: 'subscription',
  title: `${subscription.name} renews tomorrow`,
  body: `₹${subscription.amount} on ${subscription.nextBillingDate}`,
  date: oneDayBefore(subscription.nextBillingDate),
  repeat: 'none',
});

// on delete or cancel
await cancel('subscription', subscription.id);
```

---

## What's left for wave 3

Tracked in [`99-cross-cutting-recommendations.md`](./99-cross-cutting-recommendations.md):

- **Notifications for Travel Tracker, Maintenance Tracker, Sleep Tracker, Water Tracker** — useful but lower priority.
- **News Reader / Translate offline cache** — same pattern as Weather/Currency, just two more `cache.get` calls.
- **Doc Vault encryption at rest** — files in the sandbox are still unencrypted; needs an AES layer keyed off the PIN.
- **Money hub convergence** — Expense Tracker + Subscription Manager + House Bills on one transaction model.
- **Charts library** — every chart is hand-rolled with `View` widths; replacing them with `react-native-svg` primitives unblocks better analytics across ~10 tools.
- **Accessibility audit** — `accessibilityLabel` / `accessibilityRole` on icon-only buttons + dark-mode contrast pass.
- **Spaced-repetition for Flashcards** — biggest miss for the study tool.

---

## Verification

```sh
npx tsc --noEmit          # ✅ exit 0
npx eslint <new files>    # ✅ 0 errors, 0 new warnings
```

The pre-existing lint warnings in `event-countdown.tsx`, `flashcards.tsx`, `grocery-list.tsx`, `json-formatter.tsx`, `matrix-calculator.tsx`, `savings-goal.tsx`, and `weather.tsx` (mostly unused-vars in code unrelated to this wave) are unchanged.
