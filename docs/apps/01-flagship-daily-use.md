# 01 · Flagship & Daily-Use Tools

The headline tools that anchor the app's grid. These are the ones a user touches every day, and they get the richest feature sets.

| Tool | File | Persistence |
|---|---|---|
| Doc Vault | `tools/doc-vault.tsx` (+ `doc-vault-folder.tsx`, `lib/doc-vault/`) | AsyncStorage + filesystem + optional Drive |
| Expense Tracker | `tools/expense-tracker.tsx` | AsyncStorage |
| Todo Manager | `tools/todo-manager.tsx` | AsyncStorage |
| Notes | `tools/notes.tsx` | AsyncStorage |
| Grocery List | `tools/grocery-list.tsx` | AsyncStorage |
| Habit Tracker | `tools/habit-tracker.tsx` | AsyncStorage |
| Subscription Manager | `tools/subscription-manager.tsx` | AsyncStorage |
| Reminders | `tools/reminder.tsx` | AsyncStorage |
| Markdown Notepad | `tools/markdown-notepad.tsx` | AsyncStorage |

---

## Doc Vault

**Purpose:** Secure document & image vault organised into folders, with optional PIN protection and Google Drive sync.

**Key features**
- 8 default folders (ID & Documents, Insurance, Vehicle, Medical, Financial, Education, Certificates, Other) plus user-created folders.
- File upload via `expo-image-picker` (images) and `expo-document-picker` (PDFs / any file).
- Per-folder 4-digit PIN, hashed with `expo-crypto` before storage.
- File metadata: name, mime, size, created/updated, optional tags.
- Inline image preview, share via `expo-sharing`, search by filename.
- Google Drive integration: OAuth via `expo-auth-session`, sign-in, upload, manual sync toggle.
- Size formatting (B → KB → MB → GB) and total-size totals per folder.

**Tech notes**
- Storage: `KEYS.docVaultFiles`, `KEYS.docVaultFolders`, `KEYS.docVaultSettings` + actual files copied into the app's filesystem sandbox via `expo-file-system`.
- PIN: hash + compare (hashes only, not the PIN itself).
- Drive auth flow lives in a dedicated `lib/doc-vault/` module.
- `FolderScreen` is a separate route (`doc-vault-folder.tsx`) — Doc Vault is the only tool that splits across two route files.

**Improvements**
1. **No encryption at rest** — files are copied as-is into the app sandbox. Add an AES layer (key derived from the PIN) so the OS file browser can't read them.
2. **No image / PDF compression** before storing → vault grows fast on long videos and scanned PDFs.
3. **Drive sync is fully manual** — no background sync, no version history, no conflict resolution.
4. **Search is filename-only** — no full-text PDF search, no tag/date filters, no "expiring soon" view (overlaps with Doc Expiry tool — could be merged).
5. **No batch export / share** — can't share an entire folder or export a vault zip backup.
6. **No retry / queue on Drive failures** — a flaky network silently drops uploads.
7. **Biometric unlock missing** — only numeric PIN. `expo-local-authentication` would give Face ID / fingerprint.

---

## Expense Tracker

**Purpose:** Multi-currency personal expense ledger with categories, monthly budget, and analytics.

**Key features**
- 10 categories (Food, Transport, Shopping, Fun, Health, Bills, Education, Personal, Travel, Other) and 10 currencies (INR, USD, EUR, GBP, JPY, AUD, CAD, KRW, THB, BRL).
- Three tabs: **Overview**, **History**, **Analytics**.
- Monthly budget vs actual with month navigation (prev/next).
- Daily bar chart for the current month, donut + bar category breakdown, MoM variance %.
- Quick "repeat today's expense" duplicator.
- Indian-rupee aware formatter (`fmtINR` → `₹10L`, `₹2.5Cr`).
- CSV export (clipboard).

**Tech notes**
- Storage: `KEYS.expenses`, `KEYS.expenseBudget`, `KEYS.expenseCurrency`.
- All charts are hand-rolled with `View` + width math (no chart library).
- Custom in-file abbreviation logic for Indian numbering — should move to a shared util.

**Improvements**
1. **No recurring expenses** — overlaps with Subscription Manager. Either share a "recurring engine" or import from it.
2. **No date-range filters** — only the current calendar month is browsable. Add custom range / "last 7 days" / quarter.
3. **No budget alerts** — silent threshold crossing. Need 80 % / 100 % notifications (requires a notification layer — see cross-cutting doc).
4. **No multi-account / wallet split** — all spend is in one bucket; people often want Cash vs Credit vs Bank.
5. **No receipt photos** — can't attach an image to an entry. The Doc Vault filesystem helper could be reused.
6. **CSV export only** — no PDF month-end statement, no email/share button.

---

## Todo Manager

**Purpose:** Priority + due-date task manager grouped into smart sections.

**Key features**
- 3 priority levels (Low / Medium / High) with colour-coded icons.
- Due-date shortcuts (Today, Tomorrow, +7 days, custom).
- Auto-grouped sections: **Overdue**, **Due Today**, **Next 7 Days**, **Later**, **No Date**, **Completed**.
- Filter chips: All / Active / Done. Full-text search.
- Edit / delete via per-row menu, completed items strike-through.

**Tech notes**
- Storage: `KEYS.todos`. Section/sort logic computed via `useMemo` decorations on each todo (`dueInDays`, `sectionKey`, `sortStamp`).
- No external task libraries — pure React state on `FlatList`.

**Improvements**
1. **No recurring tasks** — adding "every Mon/Wed/Fri" would prevent re-creation chores.
2. **No subtasks / checklists** — tasks are flat strings.
3. **No time-of-day** — only date-level due. Time + reminder integration would unlock notifications.
4. **No projects / tags** — cannot organise by context (Home, Work, Errands).
5. **Hard delete** — no trash/undo. Easy to lose work.
6. **No drag-reorder** — `react-native-draglist` is already in package.json and could be applied here.

---

## Notes

**Purpose:** Colourful note cards with optional per-note PIN lock.

**Key features**
- 20 note colours (10 light + 10 dark) and 6 categories.
- Per-note 4-digit PIN lock with on-screen keypad unlock modal.
- Star / favourite, grid (2-col) and list view, 4 sort modes (Newest, Oldest, A→Z, Recently edited).
- Word/character counter, native share, RGB-luminance based contrast picker for text.

**Tech notes**
- Storage: `KEYS.notes` — full content in plaintext.
- **PIN is stored as a plaintext string and compared with `===`.** Doc Vault uses `expo-crypto` hashing — Notes does not.

**Improvements**
1. **Critical: hash PINs** the same way Doc Vault does. Right now anyone with raw AsyncStorage access (e.g. an exported backup) sees both content and PIN.
2. **No rich text** — no bold/italic/lists/headings. A tiny markdown subset would go a long way.
3. **No attachments** — can't drop in an image.
4. **No reminders** — would pair perfectly with the Reminders tool.
5. **No export / backup** — only on-device. Add JSON/Markdown export.
6. **Search is naive `includes()`** — case-sensitive, no fuzzy.

---

## Grocery List

**Purpose:** Categorised shopping list with quick-add favourites.

**Key features**
- 10 categories (Fruits, Vegetables, Dairy, Meat, Bakery, Beverages, Snacks, Household, Personal Care, Other), 10 unit types (pcs, kg, g, L, mL, dozen, pack, bottle, box, bag).
- Quantity input, decimal-aware. Favourite (star) toggle.
- Two view modes — list view with filters and category view with sections.
- Search-as-you-type, "favourites only" filter, checked items grayed-out.

**Tech notes**
- Storage: `KEYS.groceryItems`. Pure single-array model with computed groupings.

**Improvements**
1. **No prices** — biggest miss. Add per-item price + estimated total + "running total" while shopping.
2. **No shopping history / templates** — every trip is a clean slate.
3. **No barcode scan** — `expo-camera` could give a quick add path.
4. **No sharing** — family groceries usually need real-time multi-device sync.
5. **Cannot reorder within a category** — even though `react-native-draglist` is bundled.
6. **No "remember last buy" suggestions** based on history.

---

## Habit Tracker

**Purpose:** Daily habit logger with streaks, weekly bars and a monthly heatmap.

**Key features**
- 6 categories (Health, Fitness, Learning, Mindfulness, Productivity, Other) and 8 colours.
- Streak (consecutive days inc. today if logged) and best-streak.
- Week view (rolling 7) and month view (calendar grid heatmap).
- Per-habit donut/ring progress + "completed today" celebration.

**Tech notes**
- Storage: `KEYS.habits` (defs) + `KEYS.habitLogs` (`{ habitId: { 'YYYY-MM-DD': true } }`).
- Streak computed by walking backwards day-by-day from today.

**Improvements**
1. **No reminders** — needs morning / evening pings. The most-requested missing feature for a habit app.
2. **No notes per check-in** — can't log "missed because sick".
3. **No quantity habits** — habits are binary done/not-done; no "drink 2L of water" or "read 20 pages".
4. **No habit templates / suggestions** — onboarding is empty-state cold start.
5. **No CSV / iCal export** for backup or for sharing with a coach.
6. **No insights** — purely descriptive numbers. A "you're 3× more likely to succeed on weekends" line would be cheap and high-value.

---

## Subscription Manager

**Purpose:** Track recurring subscriptions, billing cycles and renewal dates.

**Key features**
- 10 categories (Streaming, Music, Cloud, Fitness, News, Software, Gaming, Food, Shopping, Other) + 10 preset services (Netflix, Spotify, etc.).
- 4 billing cycles (Monthly, Quarterly, Half-Yearly, Yearly) → automatic monthly + yearly cost rollups.
- Status: Active / Cancelled, with badges for Due Soon (≤7 days) and Overdue.
- Filters: All / Active / Due Soon / Cancelled. Per-category chip filter.
- Notes, edit/inline-form, reactivate cancelled, delete with confirm.

**Tech notes**
- Storage: `KEYS.subscriptions`. Next-billing math handles month overflow but does not respect month-length edge cases (e.g. Jan 31 → Feb 28).

**Improvements**
1. **No actual notifications** — all "Due Soon" / "Overdue" indicators are visual only.
2. **No payment history** — only the *expected* next bill is tracked, not whether you actually paid.
3. **No bank/UPI auto-import** — manual entry only.
4. **No "estimated yearly waste" insight** — easy add.
5. **Currency lock to ₹** — should respect a global currency setting (or read from Expense Tracker).
6. **No cancellation reminders** (e.g. "Cancel before trial ends in 2 days").

---

## Reminders

**Purpose:** Time-based reminders with priority and basic repeat schedules.

**Key features**
- Custom scroll-wheel date/time picker (day/month/year/hour/minute) — no native picker dependency.
- Repeat: Once / Daily / Weekly / Monthly. Priority: Low / Medium / High.
- Filter tabs: All / Today / Upcoming / Overdue / Done.
- Smart relative labels ("in 2d 3h", "14m ago"), overdue highlight, optional note.

**Tech notes**
- Storage: `KEYS.reminders`. ISO-ish `YYYY-MM-DDTHH:MM` strings.
- Custom `PickerCol` momentum scroll wheel — could be promoted to a shared component.

**Improvements**
1. **No actual push notifications.** This is the biggest gap in the app. The tool *displays* time-until labels but never fires anything when the user is outside the app. Needs `expo-notifications` + a permissions onboarding pass.
2. **No location-based reminders.**
3. **Limited repeat patterns** — can't do "every other Monday" or "first weekday of month".
4. **No snooze** — overdue items can only be marked done.
5. **No attachments** — text-only. A photo or voice note would help.
6. **No quick add from share sheet** — should accept text from outside the app.

---

## Markdown Notepad

**Purpose:** Multi-file Markdown editor with live preview, templates and auto-save.

**Key features**
- Multiple `.md` files, sortable list with previews, word count + last-updated timestamps.
- 5 templates (Welcome, Meeting Notes, Project Notes, Daily Journal, Recipe).
- Edit / Preview tab with custom regex-based markdown parser supporting H1-H3, paragraphs, ordered/unordered lists, blockquotes, fenced code, hr, links, **bold**, *italic*, `code`.
- 600 ms debounced auto-save.

**Tech notes**
- Storage: `KEYS.mdFiles`.
- Markdown parser is hand-rolled — limited but tight (no library dependency).

**Improvements**
1. **GFM extensions missing** — no tables, strikethrough, task lists, footnotes.
2. **No syntax highlighting** in fenced code blocks.
3. **No export to PDF / HTML / DOCX** — pretty preview is trapped in-app.
4. **No cloud sync** — files vanish if the user reinstalls.
5. **No image embeds** — `![alt](path)` not honoured.
6. **No find-and-replace** in editor.
7. **No diff / version history** — accidental rewrites are unrecoverable.
