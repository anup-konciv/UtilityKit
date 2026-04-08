# 02 · Finance & Calculators

Finance tooling spans persistent ledgers (House Bills, Electricity, Savings) and stateless calculators (EMI, Loan Comparison, Fuel Cost, Unit Price, Tip, Basic Calculator). Currency Converter is the only one with a live-network dependency.

| Tool | File | Persistence | External API |
|---|---|---|---|
| House Bills | `tools/house-bill-tracker.tsx` | AsyncStorage | – |
| Electricity Bill | `tools/electricity-bill.tsx` | AsyncStorage | – |
| EMI Calculator | `tools/emi-calculator.tsx` | none | – |
| Currency Converter | `tools/currency-converter.tsx` | none | exchangerate-api.com |
| Savings Goal | `tools/savings-goal.tsx` | AsyncStorage | – |
| Loan Comparison | `tools/loan-comparison.tsx` | none | – |
| Fuel Cost | `tools/fuel-cost.tsx` | none | – |
| Unit Price | `tools/unit-price.tsx` | none | – |
| Tip Calculator | `tools/tip-calculator.tsx` | none | – |
| Basic Calculator | `tools/basic-calculator.tsx` | none (history is in-memory) | – |

---

## House Bill Tracker

**Purpose:** Monthly household-bill ledger split by category, with paid/unpaid state and a recurring carry-over.

**Key features**
- 11 categories (Rent, Electricity, Water, Gas, Internet, Phone, Insurance, Maintenance, Subscription, Tax, Other) with icons + colours.
- Add / edit / delete bills with amount, due date, optional note.
- Mark paid / unpaid (auto-stamps `paidDate`).
- Recurring flag → bills auto-copy from previous month into the current month.
- Month navigation, status toggle (pending vs paid), category bar chart.
- Summary: Total Due, Total Paid, Total Pending, Bills paid count, payment-progress bar.

**Tech notes**
- Storage: `KEYS.houseBills`. All math in-app.

**Improvements**
1. **No reminders / notifications** for due dates — central limitation across the finance suite.
2. **No category budgets** — can total but can't enforce ("Utilities cap = ₹5 000").
3. **No multi-year history view** — only current month is browsable.
4. **No PDF / CSV export** for accounting.
5. **No bill splitting** for shared households (per-person share).
6. **Recurring carry-over is silent** — no preview / undo if the user doesn't want it this month.

---

## Electricity Bill

**Purpose:** Track monthly meter readings, units consumed and cost over time.

**Key features**
- Per-month entry: start reading, end reading, rate per unit, fixed charge.
- Auto-calculates units, total cost, fills next month's `startReading` from previous `endReading`.
- 6-month dual bar chart (units vs cost) and MoM change indicator.
- Mark paid / unpaid, edit / long-press delete.
- Stats: avg units, avg cost, total spent, total unpaid.

**Tech notes**
- Storage: `KEYS.electricityBills`.
- Cost = `(end − start) × rate + fixed`. Single flat rate only.

**Improvements**
1. **No tariff slabs.** Most utilities use slab-based pricing (first 100 units @ rate A, next 200 @ rate B, …) — current model under-/over-states cost.
2. **No projection for the in-progress month** based on the historical average.
3. **No anomaly alerts** ("3× last month's usage").
4. **No utility-provider API integrations** (BSES, Tata Power, etc.) — purely manual.
5. **No comparison to seasonal baseline.**
6. **No appliance breakdown** — would need a power-rating estimator.

---

## EMI Calculator

**Purpose:** Compute loan EMI, total interest and full amortisation schedule.

**Key features**
- Loan presets (Home, Car, Personal, Education) and quick-amount chips (1L → 1Cr).
- Tenure toggle months ↔ years with auto-conversion.
- Hero card: monthly EMI, tenure, total interest, total payment.
- Donut split principal vs interest, payment-breakdown bar.
- Three amortisation views: Summary (yearly stacked bar), Yearly table, Monthly table (up to 360 rows).
- Share calculation as text.

**Tech notes**
- Stateless. Indian locale formatter (`en-IN`) with L/Cr abbreviations.
- EMI formula `P × r × (1+r)^n / ((1+r)^n − 1)` with `r = annual / 12 / 100`.

**Improvements**
1. **No prepayment / part-payment simulator** — major real-world feature.
2. **No floating / step-up rate** modelling.
3. **No tax-benefit calculator** (Sec 80C/24B for home loans, etc.).
4. **No multi-currency support.**
5. **No save / share schedule as PDF** — only plaintext share.
6. **Doesn't reuse Loan Comparison** — they should share an `EMIEngine` util.

---

## Currency Converter

**Purpose:** Live FX conversion across 40+ currencies.

**Key features**
- 40+ ISO codes, 10 popular defaults (USD, EUR, GBP, INR, JPY, AUD, CAD, CHF, CNY, AED).
- Symbol map ($, €, £, ₹, ¥, ₩, …).
- Live amount + rate display, swap button, last-updated timestamp.
- Quick-rate grid showing 1 unit of base in 6 popular currencies.
- Loading + error state with retry.

**Tech notes**
- Stateless. API: `https://api.exchangerate-api.com/v4/latest/{base}`.
- All cross-rates derived locally from a single base fetch.
- **No caching** — every base change is a fresh network call.

**Improvements**
1. **Offline cache + stale indicator** — bare minimum so the converter isn't useless on the subway.
2. **No 30-day historical chart** — easy add via the same API's history endpoint or a free fallback.
3. **No favourites / pinned pairs.**
4. **No crypto support** (BTC/ETH/USDC).
5. **No fee/markup field** for realistic remittance estimates.
6. **No persistence of the last-used pair** — every cold start defaults back to USD/EUR.

---

## Savings Goal

**Purpose:** Multi-goal savings tracker with deposits, withdrawals and progress.

**Key features**
- Multiple goals with name, target amount, colour, icon (12 icons), optional deadline.
- Deposit / withdraw with preset amounts (100, 500, 1K, 5K, 10K).
- Progress %, days remaining, daily-savings-needed calculation.
- Transaction history per goal (last 20 shown).
- Summary dashboard: total saved, total target, overall progress, active vs completed counts.
- Animated ring on the summary card, "completed" badge at 100 %.

**Tech notes**
- Storage: `KEYS.savingsGoals`. Transactions stored inline on each goal record.

**Improvements**
1. **No automatic recurring deposits** ("₹2 000 every Friday").
2. **No interest / return simulation** — savings accounts in India earn 3.5–7 % p.a.; goals should optionally compound.
3. **No goal templates** ("Emergency fund = 6 months expenses").
4. **No milestone celebrations** at 25 / 50 / 75 %.
5. **No accountability sharing** — would benefit from a "share progress" image export.
6. **No link to Expense Tracker** — savings could auto-deduct as a "category".

---

## Loan Comparison

**Purpose:** Side-by-side comparison of up to 3 loan offers.

**Key features**
- Up to 3 loans with label, amount, rate, years, custom colour.
- Per-loan card: monthly EMI, total interest, total payment.
- Comparison table with trophy icon next to the lowest EMI / interest / total.
- Visual stacked bar showing principal vs interest for each loan.

**Tech notes**
- Stateless. EMI formula identical to EMI Calculator (duplicated logic).

**Improvements**
1. **Refactor: extract a shared `EMIEngine`** so EMI Calculator + Loan Comparison + Investment Calculator stop duplicating the same math.
2. **No processing fees / prepayment penalties / insurance** in the comparison — these change which offer is actually cheaper.
3. **No "best for you" recommendation** logic (lowest EMI vs lowest total cost may differ).
4. **No PDF export / share-as-image** for sending to a financial advisor.
5. **No long-term EMI burden chart** (year 1 vs year 10).
6. **Hardcoded to 3 loans** — could allow add/remove dynamically.

---

## Fuel Cost

**Purpose:** Trip fuel cost estimator with reserve buffer and per-passenger split.

**Key features**
- Metric ↔ Imperial unit toggle (km/L vs MPG, L vs gal).
- Round-trip toggle, reserve buffer %, passengers 1–6+.
- Mileage presets per unit system (City Car / Highway / SUV).
- Outputs: fuel needed, total cost, cost per km/mi, cost per traveller.
- Buffer-insight card explaining why reserve fuel matters.

**Tech notes**
- Stateless. Pure arithmetic, no API.

**Improvements**
1. **No vehicle database** — could ship a small list of common cars / bikes with typical efficiency.
2. **No tolls / parking** input.
3. **No CO₂ estimate** (kg/km × distance) — high-value for an eco-conscious user.
4. **No live fuel-price fetch** (e.g. India petrol-bunk APIs).
5. **No history** of past trips — every calc is throwaway.
6. **No route integration** (Google Maps deeplink to grab actual distance).

---

## Unit Price (Price Compare)

**Purpose:** Compare unit prices of similar products across pack sizes to find the best deal.

**Key features**
- Add 2+ products with name, price, qty and unit (g, kg, oz, lb, ml, L, fl oz, pcs).
- Auto-converts to a base unit per group (weight → g, volume → ml, count → pcs).
- Sorts within each group by unit price; trophy on the best deal per group.
- Smart formatter switches to "per 1000 units" when fractions get tiny.

**Tech notes**
- Stateless. Hand-rolled `ProductAnalysis` objects, grouped by base unit.

**Improvements**
1. **No bulk-discount support** ("buy 3, get 5 % off").
2. **No price history** — would need persistence.
3. **No barcode scan** to pre-fill.
4. **No quality / rating field** — price isn't everything.
5. **No "save this comparison for later"** — refreshing nukes the cards.
6. **No share-as-image** to send the verdict to whoever's holding the trolley.

---

## Tip Calculator

**Purpose:** Restaurant bill split with tip and per-person rounding.

**Key features**
- Service presets (Cafe 8 %, Delivery 10 %, Dinner 15 %, Celebration 18 %).
- Custom tip %, custom people count (1–6 chips + manual ±).
- Outputs: tip amount, total, per-person total, rounded per-person, round-up delta.
- Smart message that adapts wording for solo vs group.

**Tech notes**
- Stateless. `Intl.NumberFormat('en-IN')`.

**Improvements**
1. **No itemised splitting** — can't split specific dishes among specific people.
2. **No card-vs-cash / payment fees** mode.
3. **No cultural defaults** — 15 % is a US norm; 5–10 % is more typical in India.
4. **No remember-last-tip** preference.
5. **No history** — every dinner is forgotten.
6. **No share / screenshot** of the split.

---

## Basic Calculator

**Purpose:** Standard calculator with a live preview and short history.

**Key features**
- Standard 5×4 keypad: AC, DEL, ÷, ×, −, +, =, %, decimal.
- Live "Preview: …" line as the user types.
- Adaptive font size for long expressions.
- Last 6 calculations as in-memory history (cleared on tab close).
- Vibration feedback per key.

**Tech notes**
- Uses `new Function(...)` for evaluation with a regex sanitiser. **No persistence.**

**Improvements**
1. **History is lost on close** — should persist to AsyncStorage (≤20 items).
2. **No memory keys** (M+, M−, MR, MC).
3. **No copy result to clipboard** — `expo-clipboard` is already used elsewhere.
4. **No bracket / parentheses support** — limits real expressions.
5. **No haptics tuning** — uses raw `Vibration` API instead of `expo-haptics` (inconsistent with the rest of the app).
6. **Eval via `new Function`** — even with sanitisation, a hand-rolled shunting-yard parser would be safer and removes the need to ship a JS evaluator at all.
