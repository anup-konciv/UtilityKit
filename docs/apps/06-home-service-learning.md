# 06 · Home Service & Learning

The largest cluster of structurally similar tools — almost all of the home-service trackers (cook, maid, driver, office boy, milk, water can, flower, newspaper) share the same shape but live as **separate ~600-LOC files**. The single biggest improvement here is a refactor.

| Tool | File | Persistence | Pattern |
|---|---|---|---|
| Maintenance Tracker | `tools/maintenance-tracker.tsx` | AsyncStorage | Expense ledger |
| Cook Tracker | `tools/cook-tracker.tsx` | AsyncStorage | **Salary attendance** |
| Maid Tracker | `tools/maid-tracker.tsx` | AsyncStorage | **Salary attendance** |
| Driver Tracker | `tools/driver-tracker.tsx` | AsyncStorage | **Salary attendance** |
| Office Boy Tracker | `tools/office-boy-tracker.tsx` | AsyncStorage | **Salary attendance** |
| Milk Tracker | `tools/milk-tracker.tsx` | AsyncStorage | Quantity delivery (dual-slot) |
| Water Can Tracker | `tools/water-can-tracker.tsx` | AsyncStorage | Quantity delivery (single qty) |
| Flower Tracker | `tools/flower-tracker.tsx` | AsyncStorage | Binary delivery |
| Newspaper Tracker | `tools/newspaper-tracker.tsx` | AsyncStorage | Binary delivery |
| Assignment Tracker | `tools/assignment-tracker.tsx` | AsyncStorage | Academic todo |
| GPA Calculator | `tools/gpa-calculator.tsx` | none | Stateless |

---

## The shared "salary attendance" pattern

**Cook, Maid, Driver and Office Boy are the same tool four times.** Each one is roughly 600 lines duplicated with only the role label and the AsyncStorage key changed.

Common shape:
- One employee: name + monthly salary.
- 3-state daily attendance: Present (P), Half Day (H), Absent (A).
- Calendar view (colour grid) + List view (per-day rows).
- Monthly summary: P / H / A counts and **Effective Days** (`P + 0.5 × H`).
- Salary math: `dailyRate = monthlySalary / daysInMonth`, `earned = dailyRate × effective`.
- Payment log: date, amount, optional note.
- Balance: `earned − paid` → due / extra.
- Month navigation, today marker.
- Settings modal for name + salary edits.

**Refactor recommendation (high priority):**

```ts
// app/(app)/tools/_employee-tracker.tsx (shared component)
type Role = 'cook' | 'maid' | 'driver' | 'office-boy';
function EmployeeTracker({ role, defaultName, storageKey, accent }: ...) { ... }

// Each tool file then becomes 10 lines:
export default function CookTrackerScreen() {
  return <EmployeeTracker role="cook" defaultName="Cook"
    storageKey={KEYS.cookTracker} accent="#D97706" />;
}
```

This collapses ~2 400 lines of duplicated code into ~600 + 4 × 10. Bug fixes, new features (deductions, bonuses, PDF slips, notifications) only need to land once.

The same playbook applies more loosely to the **delivery trackers** (milk, water can, flower, newspaper) — they share calendar/list views, vendor settings, monthly summaries and payment logs but vary in what gets logged each day. A two-tier abstraction (`EmployeeTracker` for salary, `DeliveryTracker` for deliveries) would cover the entire cluster.

---

## Maintenance Tracker

**Purpose:** Home/appliance maintenance expense log with categories and photo attachments.

**Key features**
- Categories: Plumbing, Electrical, General, Appliances, Other.
- Per-entry: date, category, amount, description, optional photo.
- Monthly summaries and averages.
- List + calendar view, search, edit.
- LinearGradient hero card.

**Tech notes**
- Storage: `KEYS.maintenanceTracker`. Photos stored via image picker → app sandbox.

**Improvements**
1. **No reminders** for periodic maintenance (HVAC every 3 months, water tank cleaning, …).
2. **No PDF / CSV export** for tax / insurance documentation.
3. **No before / after photo pairing** per service.
4. **No vendor / contractor directory.**
5. **No spending trend chart.**
6. **No budget alerts.**
7. **Should share photo storage with Doc Vault** instead of two parallel implementations.

---

## Cook / Maid / Driver / Office Boy Trackers

**Purpose:** Track domestic / office staff attendance and pay.

**Key features** *(identical across all four)*
- Single employee with name + monthly salary.
- Calendar grid (P/H/A colour-coded) and list view with day labels.
- Monthly summary: counts, effective days, earned, paid, balance.
- Payment log with date / amount / optional note, quick-amount buttons.
- Today marker, month navigation, settings modal.

**Tech notes**
- Storage: `KEYS.cookTracker`, `KEYS.maidTracker`, `KEYS.driverTracker`, `KEYS.officeBoyTracker`.
- Calendar built via `buildCalWeeks()` helper, dates as `YYYY-MM-DD`.
- Daily rate = monthly / days in calendar month → handles 28/29/30/31 day months.

**Improvements (apply to all four)**
1. **Refactor into a single `EmployeeTracker` component** — the #1 architectural fix in the codebase.
2. **No PDF salary slip** export (date, attendance summary, earned, paid, balance).
3. **No deductions / bonuses / advances** beyond paid/earned.
4. **No notification** when monthly balance is overdue or salary day arrives.
5. **No multi-employee support** — handles one cook, one maid. A family with multiple staff needs separate tools.
6. **No leave / weekly-off configuration** — Sundays count as absent today.
7. **No biometric / PIN clock-in / clock-out.**
8. **Driver-specific:** no vehicle, fuel, or trip log integration.
9. **Office-Boy-specific:** no task assignment log.

---

## Milk Tracker

**Purpose:** Daily milk-delivery quantity log with morning + evening slots.

**Key features**
- Vendor configuration: price per litre, default morning + evening quantities.
- Two slots per day (morning sun icon, evening moon icon).
- Calendar + list views, monthly summary: total litres, M/E breakdown, days delivered, avg/day, total cost.
- Quick quantity chips (0, 0.25, 0.5, 1, 1.5, 2 L).
- Toggle quick-mark feature.

**Tech notes**
- Storage: `KEYS.milkTracker`. `DayRecord = { date, morning, evening }`.

**Improvements**
1. **No payment log / vendor balance** — unlike the salary trackers there's no "paid vs owed" view.
2. **No quality flag** (fresh / curdled / late).
3. **No vendor switching history** for price comparison.
4. **No CSV export.**
5. **No reminders** for monthly bill day.
6. **No supply forecasting** based on average usage.
7. **Should share calendar code with the salary trackers.**

---

## Water Can Tracker

**Purpose:** Track delivery of bulk water cans.

**Key features**
- Vendor + price per can.
- Daily can count, calendar + list views.
- Monthly summary: total cans, total cost, weekly average.
- **Has** payment log + balance tracking (unlike Milk Tracker).
- Quick can-count buttons (0–5).

**Tech notes**
- Storage: `KEYS.waterCanTracker`.
- Quick payment amounts: `[20×price, 10×price, 500, 1000]`.

**Improvements**
1. **No empty-can return tracking** for refunds.
2. **No batch / quality tracking.**
3. **No stock-on-hand counter** ("you have 3 cans left").
4. **No reorder threshold alerts.**
5. **No bulk-discount tier** support.
6. **Should consolidate with Milk Tracker** under a shared `DeliveryTracker`.

---

## Flower Tracker

**Purpose:** Daily flower-delivery log (binary delivered / missed).

**Key features**
- Vendor + price per day.
- Binary state: Delivered ✓ / Missed ✗.
- Calendar + list view, monthly summary: delivered, missed, total cost.
- Payment log with balance tracking.

**Tech notes**
- Storage: `KEYS.flowerTracker`.

**Improvements**
1. **No flower type / bouquet** selection (rose vs marigold vs daily mix).
2. **No quality rating** (fresh vs wilted).
3. **No seasonal pricing** (festival markup).
4. **No proof-of-delivery photo.**
5. **No subscription pause** for vacations.
6. **Refactor with Newspaper Tracker** — they share the binary delivered/missed shape.

---

## Newspaper Tracker

**Purpose:** Daily newspaper delivery log (binary delivered / missed) with fixed monthly subscription.

**Key features**
- Paper name + monthly subscription cost.
- Binary delivered / missed state.
- Calendar + list views, delivery rate %.
- **No payment log** (subscription is fixed, paid externally).

**Tech notes**
- Storage: `KEYS.newspaperTracker`. Simpler than Flower Tracker.

**Improvements**
1. **No multi-paper support** (subscribe to two dailies).
2. **No subscription renewal date** with reminder.
3. **No complaint log** (late delivery, missing pages).
4. **No pro-rata refund calc** when missed days exceed a threshold.
5. **No pause / resume** with date ranges (vacations).
6. **Refactor with Flower Tracker.**

---

## Assignment Tracker

**Purpose:** Academic assignment manager with priority and status.

**Key features**
- Per assignment: title, subject, due date, priority, description.
- Subject presets: Math, Science, English, History, CS, Art, Other.
- Priority: High / Medium / Low (flame / flash / leaf icons).
- Status cycle: Pending → In Progress → Completed.
- Filters: All / Pending / In Progress / Completed.
- Hero dashboard: total / pending / overdue / completed.
- Cards with subject + priority badges and days-until / overdue indicators.
- Sort: completed grouped at bottom, others by due date.

**Tech notes**
- Storage: `KEYS.assignments`. LinearGradient hero (blue).

**Improvements**
1. **No reminders** at 7 days / 1 day / 2 hours before due.
2. **No file attachments** (PDF, image of the prompt).
3. **No subtask checklist** within an assignment.
4. **No estimated time** field for time-blocking.
5. **No grading / mark capture** post-submission — could integrate with GPA Calculator.
6. **No recurring assignments** (weekly problem sets).
7. **Heavy overlap with Todo Manager** — Assignments is "Todo Manager with academic skin". Could be a Todo Manager view/category instead of a parallel tool.

---

## GPA Calculator

**Purpose:** Compute GPA from a list of courses.

**Key features**
- Two scales: 4.0 (US) and 10.0 (Indian).
- Per course: name, credits, letter/point grade.
- Live GPA with progress bar, colour-coded (≥0.85 green → <0.5 red).
- Summary: total credits, total quality points.
- Grade reference card showing all letters → points.
- Course numbering (#1, #2, …).

**Tech notes**
- Stateless.

**Improvements**
1. **No persistence** — every visit starts empty. Should save semesters.
2. **No multi-semester GPA** (cumulative across semesters).
3. **No "what if" scenario** ("if I get a B in this, what's my final?").
4. **No custom scales** beyond the two presets.
5. **No transcript-style export** (PDF).
6. **No grade distribution chart** (pie of A/B/C).
7. **Should integrate with Assignment Tracker** so a finished assignment grade flows in.
