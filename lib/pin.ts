/**
 * Tiny PIN-hashing helper. Wraps `expo-crypto` so every tool that needs
 * a numeric PIN can hash and verify consistently. Doc Vault was already
 * doing this inline; this module factors it out so Notes (and any future
 * tool) can share the same primitive.
 *
 * Note: SHA-256 of a 4-digit PIN is *not* a defence against an attacker
 * who has the device file system — there are only 10 000 possible inputs.
 * It exists to:
 *   1. stop casual observers (incl. AsyncStorage exports) from reading PINs,
 *   2. give a uniform compare API across tools,
 *   3. lay the groundwork for a future per-device key-derivation step.
 *
 * For real at-rest security, layer biometric unlock + encrypt-the-note-body
 * with a key derived from the PIN. That's a follow-up; this module is the
 * minimum table-stakes fix.
 */
import * as Crypto from 'expo-crypto';

export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

/** Constant-ish-time string compare so we don't leak via early-exit. */
function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  const candidate = await hashPin(pin);
  return safeEquals(candidate, hash);
}
