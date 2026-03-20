import { StatusBar } from 'expo-status-bar';
import { useAppTheme } from './ThemeProvider';

export default function ThemedStatusBar() {
  const { resolvedMode } = useAppTheme();
  return <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />;
}
