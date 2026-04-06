import { useRouter, useSegments } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const AuthContext = createContext<{
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  skipLogin: () => Promise<void>;
  session: string | null;
  isGuest: boolean;
  isLoading: boolean;
}>({
  signIn: async () => {},
  signOut: async () => {},
  skipLogin: async () => {},
  session: null,
  isGuest: false,
  isLoading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

function useProtectedRoute(user: string | null, isGuest: boolean, isLoading: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === ('(auth)' as any);

    if (!user && !isGuest && !inAuthGroup) {
      // @ts-ignore: types update dynamically
      router.replace('/(auth)/login');
    } else if ((user || isGuest) && inAuthGroup) {
      router.replace('/');
    }
  }, [user, isGuest, isLoading, segments, router]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if the user has an active token or guest mode
    Promise.all([
      storage.getItem('user-token'),
      storage.getItem('guest-mode')
    ]).then(([token, guestFlag]) => {
      if (token) {
        setSession(token);
      }
      if (guestFlag === 'true') {
        setIsGuest(true);
      }
      setIsLoading(false);
    });
  }, []);

  useProtectedRoute(session, isGuest, isLoading);

  return (
    <AuthContext.Provider
      value={{
        signIn: async () => {
          setSession('dummy-token');
          await storage.setItem('user-token', 'dummy-token');
        },
        signOut: async () => {
          setSession(null);
          setIsGuest(false);
          await storage.deleteItem('user-token');
          await storage.deleteItem('guest-mode');
        },
        skipLogin: async () => {
          setIsGuest(true);
          await storage.setItem('guest-mode', 'true');
        },
        session,
        isGuest,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
