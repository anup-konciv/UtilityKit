# 04 · Life, Media & Calendar

Personal-life trackers (documents, vehicles, birthdays, travel, baby), live-network tools (weather, news, translate, wallpapers), and date utilities.

| Tool | File | Persistence | External API |
|---|---|---|---|
| Document Expiry | `tools/document-expiry.tsx` | AsyncStorage | – |
| Vehicle Service | `tools/vehicle-service.tsx` | AsyncStorage | – |
| Birthday Tracker | `tools/birthday-tracker.tsx` | AsyncStorage | – |
| Travel Tracker | `tools/travel-tracker.tsx` | AsyncStorage | – |
| Baby Care | `tools/baby-care.tsx` | AsyncStorage | – |
| Weather | `tools/weather.tsx` | AsyncStorage (location only) | open-meteo.com |
| News Reader | `tools/news-reader.tsx` | none | rss2json + newsapi.org |
| Translate | `tools/translate.tsx` | none | LibreTranslate + MyMemory fallback |
| Wallpapers | `tools/wallpaper-browse.tsx` | none (likes lost on close) | picsum.photos |
| Holiday Calendar | `tools/holiday-calendar.tsx` | AsyncStorage | – |
| Date Calculator | `tools/date-calculator.tsx` | none | – |
| Age Calculator | `tools/age-calculator.tsx` | none | – |

---

## Document Expiry

**Purpose:** Track documents that expire (passport, license, insurance, …) with status colour coding.

**Key features**
- 9 categories (ID, Travel, Insurance, Vehicle, Medical, Education, Financial, Property, Other).
- Per-doc fields: name, category, issue date, expiry date, document number, issued by, notes.
- Status filter: Expired / Expiring Soon (≤30 d) / Valid / All. Colour-coded badges.
- Validity progress bar showing how much of the doc's lifecycle is consumed.
- Quick-add presets (Passport, Driving License, PAN, Insurance, …).
- Summary cards for expired / expiring / valid counts.

**Tech notes**
- Storage: `KEYS.documentExpiry`. Pure in-app date math.

**Improvements**
1. **No notifications when expiry approaches** — central limitation.
2. **No image / PDF attachment** — overlaps with Doc Vault. The two could share a single document model.
3. **No auto-suggestion** of typical validity periods (passport = 10 yr).
4. **No bulk import** from CSV / JSON.
5. **No share / export** to email or PDF.
6. **No "renewed" workflow** — can only delete and re-add when you renew a doc.

---

## Vehicle Service

**Purpose:** Vehicle maintenance log with cost tracking and service-due reminders.

**Key features**
- Multiple vehicles with type (car, bike, scooter, truck, other), registration, current odometer.
- Service frequency with units (days/weeks/months/years).
- Per-service log: date, type (preset or custom), cost, odometer, garage, notes.
- 10+ service-type presets (Oil Change, Tire Rotation, Brakes, Battery, AC, PUC, …).
- Status: Overdue / Due (≤7 d) / Good / Upcoming + progress bar.
- Total-cost banner across all vehicles.

**Tech notes**
- Storage: `KEYS.vehicleService`. Service due dates computed from `lastServiceDate + frequency`.

**Improvements**
1. **No km-based service intervals** — most vehicle service is "every 10 000 km" not "every 6 months".
2. **No notifications** for upcoming service.
3. **No receipt attachment** for bills.
4. **No service-history per part** (e.g. "front brake pads replaced 2024-04, expected life 30 000 km").
5. **No fuel log integration** — could share data with Fuel Cost.
6. **No vehicle telematics integration** for users with connected cars.

---

## Birthday Tracker

**Purpose:** Birthday list with countdowns and current/next-birthday ages.

**Key features**
- Add / edit / delete with name, day, month, optional year, optional note.
- Search by name/note. Filters: All / Next 30 days / This Month.
- Sorted by days-until-next-birthday with section headers Today / Coming Up / Later.
- Featured "next upcoming" hero card.
- Colour palettes seeded from name for visual stability.
- Leap-day handling (Feb 29 → Feb 28 in non-leap years).
- Stats: Total / Today / This Month.

**Tech notes**
- Storage: `KEYS.birthdays`. Uses helpers from `lib/date-utils` (`getAgeBreakdown`, `getNextBirthday`, `parseCalendarDate`, `formatLongDate`).

**Improvements**
1. **No notifications / morning digest** — should ping ahead of each birthday.
2. **No contacts import** — manual entry only.
3. **No relationship field** (mother / friend / colleague) for grouping or filtering.
4. **No gift-list / wishlist** integration.
5. **No greeting templates** to copy/share.
6. **No zodiac display** (cheap and frequently requested).
7. **Could share a "person" model with Reminders**.

---

## Travel Tracker

**Purpose:** Trip planner with budget and per-trip expense log.

**Key features**
- Trips with destination, start/end dates, budget, status (planning / ongoing / completed), notes.
- Per-trip expense log (label + amount, auto-dated).
- Filters by status, sort by budget usage.
- Last 3 expenses preview per card; tap badge to cycle status.
- Budget bar (green <75 % → amber <90 % → red ≥90 %).
- Hero with totals: trips, ongoing, completed, total budget, total spent, % used.

**Tech notes**
- Storage: `KEYS.travelTracker`. Spent recomputed on every change via `reduce`.

**Improvements**
1. **Single currency** — should respect a global setting (or per-trip currency for international travel).
2. **No expense categories** — flat list only.
3. **No receipt photos.**
4. **No itinerary / day-by-day plan**, packing list, or to-do.
5. **No collaborative trips** — can't split with travel companions.
6. **No flight / hotel API integration.**
7. **No "memory" / journal / photo gallery** per trip.

---

## Baby Care

**Purpose:** Newborn care logger (feed, diaper, sleep, milestones).

**Key features**
- Profile: name, DOB, gender. Auto-shows age (days/months/years).
- 4 tabs: **Feed** (breast / bottle / solid), **Diaper** (wet / dirty / both), **Sleep** (start, end, auto-duration), **Milestones** (presets like "First smile").
- Quick-action buttons: Quick Feed, Quick Diaper (auto-time).
- "Time since last feed" indicator.
- Hero shows today's counts (feeds / diapers / naps / milestones).
- Long-press to delete entries.

**Tech notes**
- Storage: `KEYS.babyProfile`, `KEYS.babyCare`. Last 20 entries shown per tab.

**Improvements**
1. **No notifications / "next feed in" timer.**
2. **No growth tracking** (height / weight curves with WHO percentiles).
3. **No vaccination schedule.**
4. **No multi-baby support** for twins or multiple kids.
5. **No photo timeline / milestone gallery.**
6. **No pediatrician contact / appointment block.**
7. **No CSV export** for handing data to a doctor.

---

## Weather

**Purpose:** Current weather and 7-day forecast for any city.

**Key features**
- City search via Open-Meteo geocoding API, city saved to AsyncStorage.
- Current weather: temperature, apparent temp, humidity, wind, UV index, precipitation.
- Hourly forecast (next 24 h) and 7-day forecast (max/min/condition/precip).
- Dynamic gradient background based on weather code + time of day (day vs night).
- Loading + error states with retry.

**Tech notes**
- APIs: `geocoding-api.open-meteo.com/v1/search`, `api.open-meteo.com/v1/forecast`.
- Storage: `'uk_weather_location'` (outlier — not in central `KEYS`).
- **No weather caching** — every reopen is a fresh API call.

**Improvements**
1. **No offline cache** — should keep last fetch and show stale-ness indicator.
2. **No auto location** — uses manual city search; should default to GPS via `expo-location`.
3. **No multiple cities** — only one saved city.
4. **No severe-weather alerts** (Open-Meteo provides warnings).
5. **No air quality (AQI)** — also free from Open-Meteo.
6. **Centralise outlier storage key.**
7. **No widget / lock-screen support** (would need Expo Modules / native).

---

## News Reader

**Purpose:** Browse top headlines by country and category.

**Key features**
- 7 categories (General, Business, Tech, Science, Health, Sports, Entertainment).
- 7 country selectors (US, UK, India, AU, CA, DE, FR).
- Featured + list cards with thumbnail, title, description, source, time-ago.
- Detail modal with hero image, full content, share, open-in-browser.
- HTML stripping for dirty RSS descriptions.

**Tech notes**
- Primary API: `api.rss2json.com` wrapping Google News RSS.
- Fallback API: `newsapi.org/v2/top-headlines` with the public **demo key** (rate-limited and likely to fail in production).
- **No persistence** — every cold start re-fetches.
- No pagination.

**Improvements**
1. **Demo NewsAPI key is unsafe for production** — should be moved to env / a server-side proxy or removed.
2. **No save-for-later / bookmark.**
3. **No offline cache** for previously seen articles.
4. **No source / keyword filtering.**
5. **No infinite scroll / load more.**
6. **No reading progress tracking.**
7. **No share-to-app integrations beyond native share.**

---

## Translate

**Purpose:** Translate text between 41 languages with provider fallback.

**Key features**
- 41 languages including all major Indian languages (Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu).
- Source/target picker, swap button, 500-char input limit with live count.
- Result with copy button + provider badge ("Translated by …").
- Loading spinner, error display.

**Tech notes**
- Helper: `lib/translate-service.translateText()` — primary LibreTranslate, fallback MyMemory.
- **No persistence** — no history, no offline phrasebook.

**Improvements**
1. **No translation history.**
2. **No text-to-speech** for the translated output (`expo-speech` is small and free).
3. **No detect-language** option.
4. **No image / OCR translate.**
5. **No phrasebook / favourites.**
6. **No offline pack** — entirely network-bound.
7. **No rate-limit handling / quota awareness** for the public providers.

---

## Wallpapers

**Purpose:** Browse and like a feed of free wallpaper photos.

**Key features**
- 6 categories (Curated, Nature, Architecture, People, Abstract, Travel) — driven by Picsum seed/page params.
- Snap-scrolling card stack with Flipboard-style snapping.
- Like / share / open-in-browser per card, full-screen preview modal.
- Card numbering badges, "X photos loaded / Y liked" footer.
- Pagination via `onEndReached`.

**Tech notes**
- API: `picsum.photos/v2/list` (Picsum doesn't actually have semantic categories — the categories here are mostly cosmetic).
- **Likes are an in-memory `Set` — lost on refresh / app close.**
- No download / save-to-photos function.

**Improvements**
1. **Persist likes** — first thing users would expect.
2. **No actual download / save-to-camera-roll** — needs `expo-media-library`.
3. **No "set as wallpaper"** (would need a native module).
4. **Categories are fake** — should switch to a real photo API like Unsplash / Pexels with proper tags. Both have free tiers.
5. **No keyword search.**
6. **No resolution filter.**

---

## Holiday Calendar

**Purpose:** View national + religious holidays with custom user events.

**Key features**
- Month grid with prev/next navigation.
- 9 hardcoded Indian holidays (Makar Sankranti, Republic Day, Holi, Ambedkar Jayanti, Labour Day, Independence Day, Gandhi Jayanti, Children's Day, Christmas).
- Custom holidays with name, day, month, optional year (year-less = recurring).
- Type badges: National (blue), Religious (purple), Custom (amber).
- Tap a date to see holidays for that day; up to 3 dot indicators per date.

**Tech notes**
- Storage: `KEYS.customHolidays`. Built-in holidays are hardcoded — *no* country-aware data.

**Improvements**
1. **Hardcoded India-only built-ins** — needs a country setting + a holiday-API integration (e.g. date.nager.at) so the app works globally.
2. **No reminders** for upcoming holidays.
3. **No recurring patterns** beyond "year-less".
4. **No holiday descriptions** — would be a nice "tap to learn more" feature.
5. **No iCal / Google Calendar export.**
6. **No search across months.**
7. **Should overlap-merge with Event Countdown** instead of being a parallel feature.

---

## Date Calculator

**Purpose:** Days-between calculator and add-/subtract-from-date utility.

**Key features**
- Two modes: **Days Between** and **Add / Subtract**.
- Days Between: total days, breakdown into Y/M/D, weeks, hours, minutes.
- Add/Subtract: quick chips (7, 14, 30, 60, 90, 365 days).
- "Today" shortcut.

**Tech notes**
- Stateless. Helpers in `lib/date-utils`.
- Days math via `Math.round((b − a) / 86 400 000)`.

**Improvements**
1. **No business-day support** (skip weekends and holidays — could share Holiday Calendar's data).
2. **No time-of-day** input.
3. **No timezone awareness.**
4. **No history.**
5. **No "what day was it" info** (showing weekday).
6. **No share / copy result** button.

---

## Age Calculator

**Purpose:** Detailed age breakdown from a date of birth.

**Key features**
- Numeric day/month/year inputs with sanitisation.
- Compare against today (or a custom "as of" date).
- Hero card with years old + months/days beyond last birthday + countdown to next birthday.
- Stats grid: Years / Months / Days plus Total Months / Weeks / Days / Hours.
- Born-on weekday, next birthday date, age turning next.
- Validation against future birth years and invalid days.

**Tech notes**
- Stateless. Heavy lifting in `lib/date-utils.getAgeBreakdown()`.

**Improvements**
1. **No persistence** — every visit is a fresh entry. Should remember the last DOB (or pull from Birthday Tracker).
2. **No life milestones** ("you'll turn 18 on …", "retirement at 60", "first 10 000 days").
3. **No zodiac sign / Chinese zodiac** display.
4. **No life-expectancy comparison.**
5. **No share-as-image** for fun screenshots.
6. **No age "in different units"** toggle (heartbeats, breaths, planet orbits).
