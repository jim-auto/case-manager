/**
 * Passcode authentication using SHA-256 hash stored in localStorage.
 */

const HASH_KEY = 'case-manager-passcode-hash';

/**
 * Hash a passcode string with SHA-256.
 * @param {string} passcode
 * @returns {Promise<string>} hex-encoded hash
 */
async function hashPasscode(passcode) {
  const encoded = new TextEncoder().encode(passcode);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Check if a passcode has been registered.
 * @returns {boolean}
 */
export function isPasscodeSet() {
  return localStorage.getItem(HASH_KEY) !== null;
}

/**
 * Register a new passcode.
 * @param {string} passcode
 */
export async function setPasscode(passcode) {
  const hash = await hashPasscode(passcode);
  localStorage.setItem(HASH_KEY, hash);
}

/**
 * Verify passcode against stored hash.
 * @param {string} passcode
 * @returns {Promise<boolean>}
 */
export async function verifyPasscode(passcode) {
  const stored = localStorage.getItem(HASH_KEY);
  if (!stored) return false;
  const hash = await hashPasscode(passcode);
  return hash === stored;
}
