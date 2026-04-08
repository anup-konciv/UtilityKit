# 05 · Math, Convert, Dev & Fun

Calculators, converters, dev utilities, sensor-driven tools and randomisers. Almost every tool in this category is **stateless** — that's the dominant improvement opportunity.

| Tool | File | Persistence |
|---|---|---|
| Scientific Calculator | `tools/scientific-calculator.tsx` | none |
| Percentage Calculator | `tools/percentage-calculator.tsx` | none |
| Matrix Calculator | `tools/matrix-calculator.tsx` | none |
| Unit Converter | `tools/unit-converter.tsx` | AsyncStorage (default unit pref only) |
| Text Tools | `tools/text-tools.tsx` | none |
| QR Generator | `tools/qr-generator.tsx` | none |
| Password Generator | `tools/password-generator.tsx` | AsyncStorage (history + saved) |
| Compass | `tools/compass.tsx` | none |
| Ruler | `tools/ruler.tsx` | none |
| Tally Counter | `tools/tally-counter.tsx` | AsyncStorage |
| JSON Formatter | `tools/json-formatter.tsx` | none |
| Base Converter | `tools/base-converter.tsx` | none |
| Color Tools | `tools/color-tools.tsx` | none |
| Dice & Coin | `tools/dice-coin.tsx` | none |
| Random Picker | `tools/random-picker.tsx` | none |
| Flashcards | `tools/flashcards.tsx` | AsyncStorage |

---

## Scientific Calculator

**Purpose:** Full scientific calculator with deg/rad and a 2nd-function shift.

**Key features**
- Trig (sin, cos, tan, asin, acos, atan), log/ln/exp, x², x³, xʸ, √, ∛, factorial, abs.
- Degrees ↔ Radians toggle, 2nd-function shift key.
- Live expression preview, calculation history (max 8) with click-to-restore.
- Vibration feedback per key.
- Adaptive number formatting (scientific notation for huge / tiny values).

**Tech notes**
- Uses `new Function()` with scoped helpers — same security caveat as Basic Calculator.
- History is in-memory only.

**Improvements**
1. **Persist history** to AsyncStorage.
2. **No memory keys** (M+, M−, MR, MC).
3. **No bracket-balance indicator.**
4. **No copy result to clipboard.**
5. **No precision setting** (2/4/8 decimals).
6. **No graphing mode.**
7. **Replace `new Function` with a real expression parser** to remove the eval-style security risk.

---

## Percentage Calculator

**Purpose:** Multi-mode percentage solver.

**Key features**
- 4 modes: % of value, "is what %", % change, Discount.
- Live calculation as you type.
- Quick example presets (3 per mode).
- Per-mode hero gradient and metric cards.
- Zero-division guard.

**Tech notes**
- Stateless. Pure `useMemo` arithmetic.

**Improvements**
1. **Persist history.**
2. **No batch mode** (apply 20 % off to a list).
3. **No compound-percentage growth** mode.
4. **No directional vs symmetric % difference** distinction.
5. **No share result** button.
6. **Dark mode contrast on gradients** can be tight — audit text legibility.

---

## Matrix Calculator

**Purpose:** 2×2 / 3×3 matrix arithmetic.

**Key features**
- Toggle 2×2 ↔ 3×3.
- Operations: A+B, A−B, A×B, det, transpose, inverse.
- Singular-matrix detection with friendly error.
- Numeric input validation per cell.
- Output formatting: clean integers, trimmed trailing zeros.

**Tech notes**
- Pure functions: `addMat`, `mulMat`, `det2`, `det3`, `inverse2`, `inverse3`, `transpose`. No persistence.

**Improvements**
1. **No save / load matrices** for reusable presets (rotation, identity, etc.).
2. **No history.**
3. **No eigenvalues / eigenvectors / rank** — would round out the educational use case.
4. **No 4×4 / N×N** scaling.
5. **No step-by-step solution** display (Gaussian elimination, cofactor expansion).
6. **No fraction display** — outputs are decimal even when results are exact rationals.

---

## Unit Converter

**Purpose:** 11-category unit converter.

**Key features**
- Categories: Length, Weight, Temperature, Speed, Volume, Area, Time, Energy, Data, Pressure, Fuel.
- Live conversion, swap from↔to, 8-significant-figure precision.
- Temperature shows weather-context emoji (❄️ ☀️ 🔥).
- Default unit system pref (metric vs imperial) loaded from AsyncStorage.

**Tech notes**
- Storage: `KEYS.defaultUnits`. Conversions through a base unit per category (`toBase`/`fromBase`).

**Improvements**
1. **No favourites / recent conversions.**
2. **No batch / paste-many-values** mode.
3. **No custom user units.**
4. **No fuzzy search** across all units.
5. **No copy-result** button.
6. **No keyboard shortcuts** for power users on web.
7. **Currency category missing** — Currency Converter is split into a separate tool.

---

## Text Tools

**Purpose:** Multi-purpose text manipulator.

**Key features**
- 7 case transforms (UPPER, lower, Title, camelCase, snake_case, kebab-case, Reverse).
- 5 line tools (Sort A→Z, Sort Z→A, Dedupe, Number, Trim).
- 4 encoding tools (Base64 enc/dec, URL enc/dec — Base64 is hand-rolled because RN has no `atob`/`btoa`).
- Stats: characters, words, sentences, paragraphs, reading time.
- Find & Replace with occurrence count.
- Lorem Ipsum generator.

**Tech notes**
- `expo-clipboard` for copy. No persistence.

**Improvements**
1. **No regex find/replace** — only literal.
2. **No diff between two texts.**
3. **No undo/redo.**
4. **No save snippets / templates** (HTML scaffold, common emails).
5. **No remove-accents / Unicode normalisation.**
6. **No JSON / XML pretty-printing** (overlaps with JSON Formatter — could merge).
7. **No share button** — only copy.

---

## QR Generator

**Purpose:** Generate a QR code from text/URL/email/phone/Wi-Fi.

**Key features**
- 5 presets: URL, Text, Email (`mailto:`), Phone (`tel:`), Wi-Fi (`WIFI:T:WPA;…`).
- 4 size options (150 / 200 / 250 / 300 px).
- Live char counter (1000 max), copy URL of generated image.

**Tech notes**
- Image fetched from `api.qrserver.com/v1/create-qr-code/` — **no native generation**, every QR is a remote PNG.

**Improvements**
1. **No QR scanner** — `expo-camera` would unlock this. Most users want both directions.
2. **No download / save-to-photos.**
3. **No history** of generated QRs.
4. **No custom logo** in the centre.
5. **No error-correction level** option.
6. **No offline generation** — `react-native-qrcode-svg` would remove the network dependency entirely.
7. **Wi-Fi preset doesn't validate** the password / SSID format.

---

## Password Generator

**Purpose:** Generate strong passwords/passphrases with strength meter and a saved-passwords vault.

**Key features**
- Two modes: **Password** (8–64 chars, upper/lower/digit/symbol toggles, exclude ambiguous) and **Passphrase** (3–8 words, custom separator, capitalise).
- Custom symbol picker with preset groups (common, brackets, math, punctuation).
- Entropy-based strength meter (Weak → Very Strong).
- History (last 20) auto-saved; Saved Passwords with custom labels and reveal/hide.
- Copy with 2 s confirmation.

**Tech notes**
- Storage: `KEYS.passwordHistory`, `KEYS.savedPasswords`.
- Randomness from `expo-crypto.getRandomBytes` (cryptographically secure).
- Word list of 60 words hardcoded for passphrases.

**Improvements**
1. **Saved passwords are stored in plain AsyncStorage** — needs encryption + biometric unlock if it's going to act as a "vault". Right now it's *less* secure than the user typing into a notes app.
2. **No HIBP / breach check** — paste a password, see if it's been leaked (k-anonymity API is free).
3. **No "test my password" strength checker.**
4. **Passphrase wordlist of 60 words is too small** for real entropy claims (should ship EFF's 7776-word list).
5. **No export / backup** of saved passwords.
6. **No autofill integration** (iOS / Android credential providers).

---

## Compass

**Purpose:** Magnetometer-based digital compass.

**Key features**
- Live magnetometer reading (100 ms interval) with `Animated.spring` rotation.
- 8 cardinal/intercardinal labels, tick marks at 90 / 45 / 15°.
- 3-card display: Heading (°), Direction (abbr), Cardinal (full name).
- Graceful error UI when magnetometer is unavailable.

**Tech notes**
- `expo-sensors.Magnetometer`.

**Improvements**
1. **No magnetic-declination correction** — true north vs magnetic north differ by up to 25° depending on location. Needs `expo-location` + a declination model.
2. **No calibration prompt** when readings are erratic.
3. **No GPS-based heading** as a fallback when moving.
4. **No bookmarks / waypoints.**
5. **No bearing line / "navigate to"** UI.
6. **No accuracy indicator.**

---

## Ruler

**Purpose:** On-screen ruler in cm and inches.

**Key features**
- Two rulers (cm gold, inches blue) sized to screen width.
- Major / half / minor tick marks with numeric labels.
- Device info card (px width, pixel ratio, approx DPI, conversion factors).
- Disclaimer about device-dependent accuracy.

**Tech notes**
- `Dimensions.get('window')` and `PixelRatio.get()`. Approximation: `DPI ≈ pixelRatio × 160` — wrong for many devices.

**Improvements**
1. **No calibration mode** — every device shows the wrong length until the user can recalibrate against a known object (credit card, coin).
2. **No protractor / angle measurement.**
3. **No landscape rotation handling** for longer measurements.
4. **No measurement history / capture-and-label.**
5. **No imperial fractions** (3 ½″ display).
6. **No grid overlay** for comparing object sizes.

---

## Tally Counter

**Purpose:** Multi-counter app with persistent state.

**Key features**
- Multiple counters with name, colour (8), step size (1, 2, 5, 10, 25, 50, 100), optional target.
- Increment / decrement / reset, vibration on increment.
- Target progress bar with "target reached" indicator.
- Counter summary (total across all counters).
- Migration logic for older counters missing `step` / `target`.

**Tech notes**
- Storage: `KEYS.tallyCounters`. Vibration via raw API.

**Improvements**
1. **No per-counter history** (graph over time of count progression).
2. **No CSV export.**
3. **No undo** of last increment.
4. **No counter categories** for organising into groups.
5. **No widget / lock-screen counter** — would be the killer feature for a tally tool.
6. **No keyboard shortcuts** (volume keys for ±) on Android.

---

## JSON Formatter

**Purpose:** Format / validate / minify / sort-keys for JSON.

**Key features**
- Validate with friendly error message.
- Format (2 or 4 space indent), Minify, Sort keys.
- Stats: type (Object / Array), key count, depth, byte size.
- Paste from clipboard, sample loader, copy output.

**Tech notes**
- Pure `JSON.parse` / `JSON.stringify`. Hand-rolled tree walker for stats. No persistence.

**Improvements**
1. **No syntax highlighting** in the output.
2. **No collapsible tree view** for big JSONs.
3. **No JSONPath / jq query** support.
4. **No JSON-Schema validation.**
5. **No JSON → TypeScript interface** generator.
6. **No diff** between two JSONs.
7. **Will choke on multi-MB inputs** because everything goes through React state in one shot.

---

## Base Converter

**Purpose:** Convert numbers between Bin / Oct / Dec / Hex with bit insights.

**Key features**
- Live conversion across all 4 bases simultaneously.
- Bit analysis: bit length, count of 1s and 0s, even/odd, power-of-2 check.
- ASCII char preview for printable values (32–126).
- 4-bit grouped binary display.

**Tech notes**
- `parseInt(input, radix)` / `toString(radix)`. No persistence. Integers only.

**Improvements**
1. **No floating-point IEEE 754** view — common ask.
2. **No two's-complement / signed view** for negative numbers.
3. **No bitwise ops** (AND, OR, XOR, NOT, shift).
4. **No history.**
5. **No copy-as-prefixed string** (`0x`, `0b`, `0o`).
6. **Doesn't share logic with JSON Formatter / Color Tools** — many dev tools could be tabs in one screen.

---

## Color Tools

**Purpose:** Color converter with harmonies and accessibility checks.

**Key features**
- HEX / RGB / HSL all live-synced.
- RGB sliders, 10 preset swatches.
- Harmony generator: complementary, analogous, triadic, split-complementary.
- 10-step shades & tints palette.
- WCAG contrast vs white and black with AA/AAA rating.
- 2 CSS-gradient previews.

**Tech notes**
- Helpers in `lib/color-utils`. WCAG luminance + contrast formula. No persistence.

**Improvements**
1. **No saved palette** — biggest gap. A designer's tool needs to remember colours.
2. **No color-blindness simulator.**
3. **No "name this colour"** lookup (CSS named colours, brand colours).
4. **No multi-stop gradient editor.**
5. **No image colour picker** (pick from a photo).
6. **No history** of recent colours.

---

## Dice & Coin

**Purpose:** Dice roller (d4–d20) and coin flipper.

**Key features**
- Dice mode: D4 / D6 / D8 / D10 / D12 / D20, 1–6 dice, last 10 rolls history (in-memory), total.
- Coin mode: animated flip (8 toggles over 800 ms), heads/tails counts, percentages, reset.
- Vibration on roll/flip.

**Tech notes**
- `Math.random()` (not crypto-secure — fine for play, not for anything that matters). No persistence.

**Improvements**
1. **No persistence** — history and stats lost on close.
2. **No dice notation** (`3d6+5`).
3. **No advanced stats** (avg, mode, variance) over historical rolls.
4. **No sound effects** — would be cheap and high-immersion.
5. **No saved dice combos** (e.g. "D&D Attack").
6. **No more dice types** (d100, percentile dice).

---

## Random Picker

**Purpose:** Pick random items from a list or random numbers from a range.

**Key features**
- **List mode:** paste lines, pick 1–3 without replacement, 4 presets (Yes/No, Dinner, Weekdays, Colors).
- **Number mode:** min/max range, single random integer.
- Animated reveal of result, last 16 picks history (in-memory).

**Tech notes**
- `Math.random()`. No persistence.

**Improvements**
1. **No persistence** of saved lists.
2. **No weighted picks** (e.g. dinner #1 has 30 % weight).
3. **No exclude-already-picked** mode.
4. **No share result.**
5. **No batch generation** (give me 10 picks at once).
6. **No CSV import** for big lists.

---

## Flashcards

**Purpose:** Study tool with multiple decks and a flip animation.

**Key features**
- Multiple decks with name + 8 colour choices.
- Front / back text, flip animation via 3D `rotateY` interpolation.
- Prev / next / shuffle, delete card during study.
- Progress indicator "card N of M".
- Edit / delete deck.

**Tech notes**
- Storage: `KEYS.flashcards`.
- Shuffle uses `sort(() => Math.random() − 0.5)` (biased — should be Fisher-Yates).

**Improvements**
1. **No spaced repetition** — biggest miss for a study tool. Even a basic SM-2 implementation would multiply value.
2. **No study stats** (cards seen, accuracy, mastery %).
3. **No "I got it / I didn't" buttons** — flipping is binary navigation only.
4. **No images / audio** on cards.
5. **No CSV / Quizlet / Anki import-export.**
6. **No shareable decks** (QR / link).
7. **Replace biased shuffle** with Fisher-Yates.
