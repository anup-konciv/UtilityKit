# 99 · Cross-Cutting Recommendations

Patterns observed across the entire ~75-tool catalogue. These are the changes that would improve *most* of the app at once, ranked roughly by impact.

---

## 1. Notifications layer (highest impact)

**Problem:** *No tool in the app fires a single notification.* Reminders, Habit Tracker, Subscription Manager, Document Expiry, Vehicle Service, House Bills, Assignment Tracker, Birthday Tracker, Pomodoro, Sleep Tracker and Water Tracker all rely on the user opening the app at exactly the right moment.

**Action**
- Add `expo-notifications` and a small `lib/notifications.ts` wrapper.
- Onboarding screen requesting permission once, saved in settings.
- Per-tool helpers: `scheduleReminder(id, dateISO, title, body, repeat?)`, `cancel(id)`.
- Refactor every tool that today computes "due in N days" to also schedule a real notification.

This single project will turn ~12 of the existing tools from "diaries" into "assistants".

---

## 2. Refactor the home-service tracker cluster

**Problem:** Cook, Maid, Driver and Office Boy are the same ~600-LOC file four times. Milk, Water Can, Flower and Newspaper share large portions of the same calendar/list/payment scaffolding.

**Action**
- Build `components/EmployeeTracker.tsx` parameterised by `(role, defaultName, storageKey, accent)`.
- Build `components/DeliveryTracker.tsx` for the per-day quantity / binary delivery cluster.
- Each tool file becomes a 5-line wrapper. ~2 400 lines collapse to ~600.
- Bug fixes (e.g. month-edge salary math, payment rounding) only need to land once.

See [`06-home-service-learning.md`](./06-home-service-learning.md#the-shared-salary-attendance-pattern) for details.

---

## 3. Cloud backup / sync

**Problem:** Every tool persists to AsyncStorage on a single device. A reinstall = total data loss for Notes, Doc Vault, every tracker, every habit log.

**Action**
- Build a single `lib/backup.ts` that knows how to:
  - Walk every key in `KEYS`.
  - Serialize to one JSON blob.
  - Restore from blob.
- Wire it to:
  - **Manual:** Settings → Export / Import (file).
  - **Optional Drive sync** (Doc Vault already has the OAuth flow — generalise it).
  - **iCloud Documents** for iOS users.
- Versioned schema with migrations.

---

## 4. Centralise outlier storage keys

`constants/tools-meta.ts` lists every tool, but a handful of tools store data outside `lib/storage.ts → KEYS`:

| Tool | Key |
|---|---|
| BMI Calculator | `BMI_HISTORY_KEY`, `uk_default_units` |
| Pomodoro | `SETTINGS_KEY`, `TODAY_KEY` |
| World Clock | `STORAGE_KEY` |
| Weather | `'uk_weather_location'` |

**Action:** add these to the central `KEYS` map. Without this the planned global backup tool can't enumerate them.

---

## 5. Security hardening of "PIN-protected" features

- **Notes**: PINs are stored as plaintext strings and compared with `===`. **Hash them** the way Doc Vault already does (`expo-crypto`).
- **Password Generator → Saved Passwords**: stored in plain AsyncStorage. If this is meant to act as a vault, it must be encrypted at rest *and* gated by biometric / PIN — otherwise it is *less* secure than typing passwords into Notes.
- **Doc Vault**: PIN is hashed but the actual files in the sandbox are unencrypted. Add an AES layer with the key derived from the PIN.
- **Add `expo-local-authentication`** (Face ID / Touch ID / fingerprint) as an alternative unlock everywhere a PIN is used.

---

## 6. Stateless calculators should remember history

Every calculator/converter in [`02-finance.md`](./02-finance.md), [`05-math-convert-dev-fun.md`](./05-math-convert-dev-fun.md) is **stateless**. Going back to the tool gives an empty form.

A 30-line shared `useToolHistory(key, max)` hook would let every calculator persist its last N inputs / outputs and offer "tap to restore". Suggested targets:

- Basic Calculator, Scientific Calculator, Percentage Calculator, Matrix Calculator
- EMI, Loan Comparison, Fuel Cost, Unit Price, Tip, Currency Converter
- Date Calculator, Age Calculator, GPA Calculator, BMI Calculator
- JSON Formatter, Base Converter, Color Tools, QR Generator

---

## 7. Standardise haptics

Half the app uses raw `Vibration.vibrate(ms)`, the other half uses nothing. `expo-haptics` is already in `package.json` (`"expo-haptics": "~15.0.8"`) but is unused.

**Action**
- Build `lib/haptics.ts` with semantic helpers: `tap()`, `success()`, `warning()`, `error()`.
- Replace `Vibration` calls in: Basic Calculator, Scientific Calculator, Pomodoro, Tally Counter, Dice & Coin.
- Add subtle haptics to checkbox toggles in Todo Manager / Habit Tracker / Routine Tracker / Grocery List.

---

## 8. Charts library

Every chart in the app is hand-rolled with `View` widths and `LinearGradient`s. This works but:

- They don't scale (axis labels missing, no tooltips, no interaction).
- Each one re-implements the same colour-mapping logic.
- New tools that need a chart (Calorie Counter, Sleep Tracker, Mood Journal — three of which still don't have one) are blocked on rolling another.

**Action:** evaluate `victory-native` or `react-native-svg`-based options. A small shared `<MiniBarChart>`, `<MiniLineChart>`, `<MiniDonut>` component set would unlock charts in ~10 tools.

---

## 9. Expense + Subscription + House Bill convergence

The app has three separate "money out" trackers with overlapping data models:

- **Expense Tracker** — one-off spends.
- **Subscription Manager** — recurring bills.
- **House Bill Tracker** — monthly utilities (also recurring).

They should share:
- A single transaction model.
- A single category list (or namespaced category sets).
- A single notification engine for due dates.
- A single currency setting.

A "Money" hub with sub-tools is more powerful than three parallel screens.

Same logic applies to **Document Expiry ↔ Doc Vault** (the Vault could surface expiry dates) and **Birthday Tracker ↔ Event Countdown ↔ Holiday Calendar** (all three are "future dated events").

---

## 10. Accessibility audit

A spot check across the tool files shows no `accessibilityLabel`, `accessibilityHint`, or `accessibilityRole` props on the custom buttons / cards / progress rings.

**Action**
- Add semantic labels to every `TouchableOpacity` that is icon-only.
- Add `accessibilityRole="button"` / `"checkbox"` / `"adjustable"` where appropriate.
- Audit colour-contrast against WCAG AA in dark mode (LinearGradient cards in particular).
- Provide `accessibilityValue` for the progress rings (Water, Calorie, Pomodoro, Habit).
- Test with iOS VoiceOver and Android TalkBack.

---

## 11. Onboarding & empty states

Most tools' first-launch UX is a bare empty list with an "Add" button. A handful have nice empty illustrations / templates (Routine Tracker, Markdown Notepad). The rest don't.

**Action**
- Standardise an `<EmptyState icon, title, hint, actionLabel, onAction />` component.
- Provide preset templates for: Habit Tracker, Routine Tracker, Subscription Manager (already has presets), Reminders, Todo Manager, Notes, Markdown Notepad.

---

## 12. Live API tools need offline behaviour

Three tools fetch from the network and silently break on no-signal:

- **Currency Converter** — re-fetches every base change with no cache.
- **Weather** — re-fetches on every open with no cache.
- **News Reader** — re-fetches every open, no save-for-later, also uses the hard-coded NewsAPI **demo key** which is rate-limited and unsuitable for shipping.
- **Translate** — entirely network-bound, no history.

**Action**
- Add a tiny `lib/cache.ts` (key + JSON + TTL) and use it from all four.
- Remove the NewsAPI demo key; either move to a server proxy or rely solely on the rss2json fallback (which is what already happens in the happy path).
- Surface "offline / using cached data" indicators consistently.

---

## 13. Leverage already-bundled libraries that are unused or under-used

`package.json` lists several libraries that aren't pulling their weight:

| Library | Bundled? | Used by | Could/should be used by |
|---|---|---|---|
| `expo-haptics` | ✅ | nothing | Every button/toggle (see #7) |
| `react-native-draglist` | ✅ | nothing | Todo Manager, Grocery List, World Clock favourites, Routine Tracker steps |
| `react-native-sortables` | ✅ | nothing | Same as above |
| `expo-secure-store` | ✅ | (mostly nothing visible in the tools) | All PIN / saved-password storage |
| `expo-image-picker` | ✅ | Doc Vault | Receipts (Expense, Maintenance, Vehicle Service), Baby Care milestones, Notes attachments |
| `expo-sharing` | ✅ | Doc Vault | All "share result" features |

---

## 14. Quality-of-life polish (small but pervasive)

- **Settings → global currency** that all finance tools respect.
- **Settings → 12/24 hour time** that all time-of-day fields respect.
- **Settings → first day of week** (Sun vs Mon) for every calendar / heatmap.
- **Pull-to-refresh** on every list tool — currently only a few have it.
- **Long-press menus** for "duplicate", "share", "delete" — currently inconsistent.
- **Tapping the search bar should focus the input** (a couple of tools require an extra tap).
- **Dark-mode audit** of any hardcoded hex backgrounds (BMI history chart, calorie ring, mood heatmap, hero gradients on Routine / Travel / Assignment).

---

## Suggested order of execution

1. **Notifications layer** — unlocks the most existing tools.
2. **Refactor home-service trackers** — cuts ~2 000 LOC and stops bug-fix-times-four.
3. **PIN / vault hardening** — security debt.
4. **Backup & restore** — data-loss insurance.
5. **Shared chart components** — unblocks better analytics in 10+ tools.
6. **Money-hub convergence** (Expense + Subscriptions + House Bills).
7. Everything else opportunistically.
