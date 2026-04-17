# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start              # Start Expo dev server
npm run android        # Run on Android
npm run ios            # Run on iOS
npm run web            # Run on web (Metro)
npm run lint           # ESLint
npx tsc --noEmit       # Type-check (no test suite exists)
```

EAS builds: `eas build --profile preview` (APK/simulator), `eas build --profile production` (app-bundle).

## Architecture

UtilityKit is a React Native / Expo multi-tool app with 99+ self-contained tool screens. Each tool is a single file under `app/(app)/tools/`. Expo Router provides file-based routing.

### Routing & Layout

- `app/_layout.tsx` — Root providers: ThemeProvider > AuthProvider > ThemedStatusBar
- `app/(auth)/` — Login/signup (protected by AuthProvider)
- `app/(app)/index.tsx` — Home screen with searchable, filterable tool grid
- `app/(app)/tools/` — All tool screens (one file each)

### Adding a New Tool (3 steps)

1. **Create screen**: `app/(app)/tools/{tool-name}.tsx` — default export wrapped in `<ScreenShell>`
2. **Register metadata**: Add entry to `constants/tools-meta.ts` TOOLS array:
   ```ts
   { id: 'tool-id', label: 'Label', description: '...', icon: 'ionicon-name', route: '/tools/tool-name', accent: '#HEX', badge: 'Category' }
   ```
3. **Storage key** (if persisting data): Add to `KEYS` object in `lib/storage.ts`

That's it — Expo Router auto-discovers the route from the file path.

### Key Patterns

**ScreenShell** (`components/ScreenShell.tsx`): Every tool wraps content in `<ScreenShell title="..." accentColor={ACCENT}>`. It provides the header with back button, keyboard avoidance, scroll handling, and decorative accent glow.

**Theme-aware styles**: All components follow this pattern:
```ts
const { colors } = useAppTheme();
const styles = useMemo(() => createStyles(colors), [colors]);
// ...
const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({ ... });
```

**Storage**: `loadJSON<T>(key, fallback)` and `saveJSON<T>(key, value)` in `lib/storage.ts` wrap AsyncStorage. All keys use `uk_` prefix and are defined in the `KEYS` constant. Persist pattern:
```ts
const persist = useCallback((d: DataType[]) => { setData(d); saveJSON(KEYS.keyName, d); }, []);
```

**Accent color**: Each tool defines `const ACCENT = '#HEX'` at the top and passes it to ScreenShell + uses it for highlights.

**IDs**: `function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }`

**Dates**: ISO strings `YYYY-MM-DD` as storage keys and record identifiers.

### Design Tokens (`constants/theme.ts`)

- **Fonts**: `Fonts.regular / .medium / .semibold / .bold` (SpaceGrotesk)
- **Spacing**: `Spacing.xs(4) / .sm(8) / .md(12) / .lg(16) / .xl(24) / .xxl(32) / .huge(48)`
- **Radii**: `Radii.sm(8) / .md(12) / .lg(16) / .xl(24) / .pill(999)`
- **Colors**: `colors.text / .textMuted / .bg / .card / .border / .surface / .glass / .inputBg / .accent`

### Import Aliases

Always use `@/` for absolute imports (mapped to project root in tsconfig):
```ts
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';
```

### Key Libraries

- **Expo SDK 54** / React Native 0.81.5 / React 19
- **expo-router** v6 with typed routes
- **@expo/vector-icons** (Ionicons) for all icons
- **@expo-google-fonts/space-grotesk** for typography
- **react-native-reanimated** + gesture-handler for animations/gestures

### Tool Categories (badges)

Finance, Health, Life, Productivity, Fun, Learning, Dev, Utility, Convert, Time, Date, Calendar, Home, Notes, Tasks, Security, Design, Language, Live
