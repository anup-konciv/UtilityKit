# 03 · Health, Wellness & Time

Health/wellness loggers and time-management tools. Most have persistent histories and would benefit massively from a shared notification layer (currently absent across the entire app).

| Tool | File | Persistence |
|---|---|---|
| Water Tracker | `tools/water-tracker.tsx` | AsyncStorage |
| Calorie Counter | `tools/calorie-counter.tsx` | AsyncStorage |
| Sleep Tracker | `tools/sleep-tracker.tsx` | AsyncStorage |
| Gym Calendar | `tools/gym-calendar.tsx` | AsyncStorage |
| Mood Journal | `tools/mood-journal.tsx` | AsyncStorage |
| Breathing | `tools/breathing.tsx` | none |
| BMI Calculator | `tools/bmi-calculator.tsx` | AsyncStorage (history) |
| Pomodoro | `tools/pomodoro.tsx` | AsyncStorage (settings + today count) |
| Routine Tracker | `tools/routine-tracker.tsx` | AsyncStorage |
| Stopwatch & Timer | `tools/stopwatch-timer.tsx` | none |
| World Clock | `tools/world-clock.tsx` | AsyncStorage |
| Event Countdown | `tools/event-countdown.tsx` | AsyncStorage |

---

## Water Tracker

**Purpose:** Daily hydration logger with circular goal ring and weekly history.

**Key features**
- Circular progress ring (custom CSS-border quarters, not SVG) — turns blue → green on goal hit.
- 6 quick-add presets (Glass, Cup, Bottle, Large, Sip, 1L) + custom ml input.
- Daily-goal modal with 6 presets (1500 → 4000 ml) + custom value.
- Streak (consecutive days hitting goal).
- 7-day bar chart with goal threshold line, hourly timeline of today's logs, today's chronological log with per-entry delete.
- Stats: avg/day, goal-hit count, total, best day.

**Tech notes**
- Storage: `KEYS.waterLogs` + `KEYS.waterGoal`.
- Streak walks back from yesterday and breaks at the first day below goal.

**Improvements**
1. **No reminders** — water trackers without scheduled push are mostly useless after week one.
2. **No haptic on goal hit** — `expo-haptics` is in the dependency list.
3. **No CSV / JSON export** for backup.
4. **No "trend up/down vs last week"** insight.
5. **Custom ring is brittle** — should migrate to `react-native-svg` for crisp rendering at all sizes.
6. **No hourly target tracking** ("you usually slow down after 4 pm").

---

## Calorie Counter

**Purpose:** Daily calorie + macro logger split by meal type.

**Key features**
- 4 meal types (Breakfast / Lunch / Dinner / Snacks) with auto-selection by hour.
- 23 quick-food presets (general + Indian) carrying kcal + macros (P/C/F).
- Custom food entry with optional macros.
- Circular progress ring vs daily goal, macro totals.
- Migration logic for older entries that lacked a meal-type field.

**Tech notes**
- Storage: `KEYS.calorieLog` + `KEYS.calorieGoal`.
- Ring uses a 180°-threshold half-arc rotation trick.

**Improvements**
1. **No history charts** — no week / month trend view (huge gap vs Water Tracker).
2. **No macro targets** — only totals, no protein / carb / fat goals.
3. **No barcode lookup** — manual entry only.
4. **No custom presets** — users can't save "my morning oats".
5. **No meal photos.**
6. **Hardcoded ring colour** doesn't adapt to dark mode.
7. **Indian food list is a great differentiator** — should be expandable / community-shareable.

---

## Sleep Tracker

**Purpose:** Manual sleep logger with quality rating and 7-day analytics.

**Key features**
- Per-night entry: date, bed time, wake time, quality 0–4 (😩 → 🌟).
- 10 bed-time + 11 wake-time presets, manual HH:MM input.
- Duration handles midnight crossover.
- 7-day stats: avg duration, avg quality, longest sleep, sleep debt vs 8 h, streak of 7+ h nights, avg bed/wake times.
- Sleep-pattern timeline visualisation, latest 7 entries with edit/delete.

**Tech notes**
- Storage: `KEYS.sleepLog`. Stats only consider the *last 7 entries*.

**Improvements**
1. **No trend chart** beyond a 7-day average — no sparkline of duration over time.
2. **No bedtime reminder** (notification "head to bed by 22:30").
3. **8 h target is hardcoded** — should be user-configurable.
4. **Manual time entry** is friction-heavy — needs a real picker.
5. **No sleep-cycle estimation** (90 min cycles → smart wake suggestion).
6. **No Apple Health / Google Fit import.**
7. **Quality emoji colours don't adapt to dark mode.**

---

## Gym Calendar

**Purpose:** Mark gym days on a calendar and log muscle groups + exercises.

**Key features**
- Full-month calendar with highlighted gym days.
- 12 muscle groups, 5–7 exercise presets per group + custom exercises + workout note.
- Streak (consecutive gym days), weekly goal (default 4 days), best streak, week progress chip.
- Migration from older `string[]` format to the new `GymData` shape.

**Tech notes**
- Storage: `KEYS.gymLogs` + `KEYS.gymWeeklyGoal`.

**Improvements**
1. **No sets / reps / weight logging** — biggest gap. Today the tool can't track strength progression.
2. **No exercise history** ("last chest day = …").
3. **No workout templates** or split presets (PPL / Upper-Lower / Bro Split).
4. **No progress photos.**
5. **No muscle-group balance insight** ("chest 4×, back 1× — fix imbalance").
6. **No rest-day indicator** distinct from "untracked".
7. **No CSV export** for the data nerds.

---

## Mood Journal

**Purpose:** Daily mood log with tags and a 5-week heatmap.

**Key features**
- 5 mood levels (😢 Awful → 😄 Great), optional 500-char note, 8 preset tags (work, family, health, social, weather, exercise, sleep, food).
- Three tabs: **Log** (entry), **Calendar** (5-week heatmap anchored to today), **Stats** (mood distribution bar).
- Migration for older entries that lacked tags.

**Tech notes**
- Storage: `KEYS.moodJournal`.
- Heatmap is a static 5×7 grid; only the current month is full-opacity, surrounding weeks are dimmed.

**Improvements**
1. **No mood trend over time** — only a snapshot distribution.
2. **No tag correlations** ("good moods on days you exercised: 78 %") — would be very high signal for low engineering cost.
3. **Calendar isn't navigable** — only the rolling 5-week window. Users want to scroll back months.
4. **No daily reminder** to log.
5. **No PDF / journal export** for therapy etc.
6. **No private / pinned entries.**
7. **No streak / "you logged X days in a row"** which gamification helps.

---

## Breathing

**Purpose:** Guided breathing animations with preset techniques.

**Key features**
- 4 techniques: 4-7-8, Box, Deep Calm, Energize.
- Animated circle expand/contract with opacity fade per step (`Animated.timing` 1000 ms).
- Per-step countdown, colour per phase (inhale blue, hold amber, exhale green).
- Cycle counter, start/stop, technique switcher.

**Tech notes**
- **No persistence** — sessions are lost on close.

**Improvements**
1. **No haptic** at step transitions — `expo-haptics` is bundled and would massively help users keep their eyes closed.
2. **No audio guidance** (chimes / breath sounds).
3. **No streak / daily-practice tracking.**
4. **No reminders** ("Time for your evening breathing").
5. **No custom techniques** — only the hardcoded 4.
6. **No background timer** — backgrounding the app pauses the animation loop.
7. **No session summary** at the end (cycles, total minutes).

---

## BMI Calculator

**Purpose:** BMI with metric/imperial input, history and a category scale.

**Key features**
- Dual unit system (kg/cm vs lbs/ft+in), live calc.
- Category badge + tips (Underweight / Normal / Overweight / Obese).
- Animated indicator on a coloured BMI scale bar.
- History persisted with per-entry date + category, mini line chart of last 10 entries.
- "Already saved today" guard.

**Tech notes**
- Storage: `BMI_HISTORY_KEY` (note: not in the central `KEYS` map — outlier) + `uk_default_units` for the metric/imperial preference.
- Optional fields (waist, age, gender) are accepted but **never used** in any calculation.

**Improvements**
1. **Use the optional fields** — compute waist-to-height ratio (better than BMI for body composition), age/gender-adjusted BMI.
2. **Centralise the storage key** in `lib/storage.ts` to match every other tool.
3. **No weight tracking over time** — only BMI snapshots, not actual weight progression.
4. **No goal weight** target.
5. **Apple Health / Google Fit import** would be huge.
6. **Tips are static** — generic.
7. **No CSV export.**

---

## Pomodoro

**Purpose:** Configurable focus / break timer with today's session count.

**Key features**
- 3 session types: Work (25 min), Short Break (5 min), Long Break (15 min) — all configurable 1–120 min.
- "Long break every N sessions" setting (1–10).
- Circular progress ring + countdown, start / pause / resume / reset.
- Auto-transition on session complete with vibration pattern.
- Today's completed-session count, auto-resets at midnight.

**Tech notes**
- Storage: `SETTINGS_KEY` + `TODAY_KEY` (also outliers — not in central KEYS).
- Timer uses `endTime = Date.now() + secs*1000` so backgrounding is *partially* tolerated, but the tick still stops.

**Improvements**
1. **No background timer / notification at completion** — by far the biggest miss for a focus tool.
2. **No sound** — only vibration.
3. **No history** beyond "today's count" — no streak, no per-day breakdown.
4. **No task / todo integration** — pomodoros aren't tied to anything you're working on.
5. **No skip-session button** (only pause/reset).
6. **Centralise outlier storage keys** into `KEYS`.
7. **Custom labels** ("Deep Work" instead of "Work") would help.

---

## Routine Tracker

**Purpose:** Build multi-step daily routines and check them off step by step.

**Key features**
- Routines with name, icon (8), colour (8), variable step list.
- Per-step toggle ✓ / ◯, per-routine progress bar, "complete all" shortcut.
- Daily 7-day strip with selected-date highlighting.
- Per-routine streak + best streak across all routines.
- Hero card: today's completed routines, best streak, weekly completions, total steps.
- Edit / delete with confirm.

**Tech notes**
- Storage: `KEYS.routines` + `KEYS.routineLogs` (`{ date: { routineId: [bool, …] } }`).

**Improvements**
1. **No scheduling** — every routine is "daily". Need weekly patterns (gym Mon/Wed/Fri).
2. **No reminders** — without notifications, the streak depends on the user remembering.
3. **No time tracking** — doesn't capture *when* a routine was done, only *whether*.
4. **No notes per completion** — can't journal a skipped step.
5. **No templates** to bootstrap from (Morning, Evening, Workout).
6. **No insights** — most-skipped step, hardest routine, etc.
7. **Hero gradient is fixed light** — not dark-mode tuned.

---

## Stopwatch & Timer

**Purpose:** Dual-mode stopwatch (with laps) and countdown timer.

**Key features**
- Mode toggle Stopwatch ↔ Countdown.
- Stopwatch: start/pause/resume, lap (with reversed-order history), reset, MM:SS.cc display.
- Countdown: H/M/S spinners, start/pause/resume, reset, "Time's up!" finished state.
- Colour-coded display (running orange, stopped, finished red).

**Tech notes**
- **No persistence** — laps lost on close, countdown not restorable.
- 30 ms tick interval.

**Improvements**
1. **No persistence** — switching tools mid-run loses everything.
2. **No notification when countdown ends** if app is backgrounded.
3. **No background-friendly timing** (uses `setInterval` instead of an `endTime` model).
4. **No lap statistics** (avg / best / worst) or CSV export.
5. **No interval mode** ("beep every 30 s") — common for HIIT.
6. **No multiple timers running in parallel.**
7. **Uses raw `Vibration` API** — should be `expo-haptics`.

---

## World Clock

**Purpose:** Multi-city clock with digital and watch-face modes.

**Key features**
- 35 cities/capitals across UTC −8 → +12.
- Digital mode: city, country, TZ abbreviation, 12-hr time, date, offset from local.
- Watch-face mode: animated hands, day/night gradient, capital badge.
- Add-city modal with search by city/country, capital quick-chips, current time preview per timezone.
- Day/night detection with theme-adapted gradients per card.

**Tech notes**
- Storage: `STORAGE_KEY` (outlier — not in central `KEYS`). Saved cities only.
- Uses `Intl.DateTimeFormat.formatToParts` for accurate timezone conversion, with hardcoded UTC offset fallbacks.
- Tick interval 1000 ms; no `requestAnimationFrame` for second-hand smoothness.

**Improvements**
1. **No favourite/pin** — can't reorder.
2. **No business-hours visualisation** ("9–5 in NYC") — most useful feature for remote teams.
3. **No meeting helper** ("when is 10 am Tokyo for me?").
4. **No DST indicator** — important for fall/spring transitions.
5. **No custom city names** — can't alias "HQ" or "Mom".
6. **Centralise outlier storage key.**
7. **`react-native-draglist` is in deps** but unused here.

---

## Event Countdown

**Purpose:** Countdown to important future dates.

**Key features**
- Events with title, target date (YYYY-MM-DD), colour (8 presets).
- Countdown displaying Days / Hours / Minutes / Seconds, ticked every 1 s.
- Sorted future-first; passed events drop to the bottom with a "passed" badge.
- Delete with confirm.

**Tech notes**
- Storage: `KEYS.countdownEvents`.
- Progress bar uses a fixed 365-day denominator → looks weird for very long countdowns.

**Improvements**
1. **No time-of-day** — events are date-only; can't count down to a specific HH:MM.
2. **No reminders / milestone notifications** ("100 days left").
3. **No yearly recurrence** — birthdays, anniversaries don't auto-repeat (they overlap with Birthday Tracker, which *does*).
4. **No description / location** — title only.
5. **No iCal / Google Calendar import.**
6. **Progress denominator** should be configurable (or use "until originally created" instead of fixed 365).
7. **No category grouping / filter.**
