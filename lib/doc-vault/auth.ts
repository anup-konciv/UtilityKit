import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';

WebBrowser.maybeCompleteAuthSession();

// Replace these with your actual Google Cloud OAuth client IDs
const GOOGLE_CLIENT_ID_WEB = 'YOUR_WEB_CLIENT_ID';

const SCOPES = [
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
];

export type DriveAuth = {
  accessToken: string;
  refreshToken: string;
  email: string;
  avatarUrl?: string;
  expiresAt: number;
};

/** Load saved auth from storage */
export async function loadAuth(): Promise<DriveAuth | null> {
  return loadJSON<DriveAuth | null>(KEYS.docVaultAuth, null);
}

/** Save auth to storage */
export async function saveAuth(auth: DriveAuth | null): Promise<void> {
  await saveJSON(KEYS.docVaultAuth, auth);
}

/** Clear auth (sign out) */
export async function signOut(): Promise<void> {
  await saveAuth(null);
}

/** Get the discovery document for Google OAuth */
export function getDiscovery(): AuthSession.DiscoveryDocument {
  return {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  };
}

/** Build the auth request config */
export function getAuthRequestConfig(): AuthSession.AuthRequestConfig {
  return {
    clientId: GOOGLE_CLIENT_ID_WEB,
    scopes: SCOPES,
    redirectUri: AuthSession.makeRedirectUri({ scheme: 'utilitykit' }),
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  };
}

/** Exchange authorization code for tokens */
export async function exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<DriveAuth> {
  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId: GOOGLE_CLIENT_ID_WEB,
      code,
      redirectUri: AuthSession.makeRedirectUri({ scheme: 'utilitykit' }),
      extraParams: codeVerifier ? { code_verifier: codeVerifier } : undefined,
    },
    getDiscovery(),
  );

  const userInfo = await fetchUserInfo(tokenResult.accessToken);

  const auth: DriveAuth = {
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken ?? '',
    email: userInfo.email,
    avatarUrl: userInfo.picture,
    expiresAt: Date.now() + (tokenResult.expiresIn ?? 3600) * 1000,
  };

  await saveAuth(auth);
  return auth;
}

/** Fetch Google user info (email + avatar) */
async function fetchUserInfo(accessToken: string): Promise<{ email: string; picture?: string }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { email: 'Unknown' };
  return res.json();
}

/** Refresh access token using refresh token */
export async function refreshAccessToken(auth: DriveAuth): Promise<DriveAuth> {
  if (!auth.refreshToken) throw new Error('No refresh token available');

  const body = [
    `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID_WEB)}`,
    `grant_type=refresh_token`,
    `refresh_token=${encodeURIComponent(auth.refreshToken)}`,
  ].join('&');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    await signOut();
    throw new Error('Token refresh failed — please sign in again');
  }

  const data = await res.json();
  const updated: DriveAuth = {
    ...auth,
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  await saveAuth(updated);
  return updated;
}

/** Get a valid access token, refreshing if expired */
export async function getValidToken(): Promise<string | null> {
  let auth = await loadAuth();
  if (!auth) return null;

  if (Date.now() >= auth.expiresAt - 60000) {
    try {
      auth = await refreshAccessToken(auth);
    } catch {
      return null;
    }
  }

  return auth.accessToken;
}
