import { Slot } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { ThemeProvider } from '@/components/ThemeProvider';
import ThemedStatusBar from '@/components/ThemedStatusBar';
import { AuthProvider } from '@/context/auth';
import { configureNotifications } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // One-time wire-up of the local-notifications layer. No-ops gracefully
  // when expo-notifications is not yet installed (see lib/notifications.ts).
  useEffect(() => {
    void configureNotifications();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <Slot />
      </AuthProvider>
      <ThemedStatusBar />
    </ThemeProvider>
  );
}
