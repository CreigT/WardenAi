import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { x25519 } from '@noble/curves/ed25519.js';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';

export const WARDEN_CRYPTO_VERSION = 1 as const;
export const WARDEN_KEM = 'X25519+ML-KEM-768' as const;
export const WARDEN_AEAD = 'AES-256-GCM' as const;
const KDF_SALT = createHash('sha256').update('WARDEN-HYBRID-KEM-V1', 'utf8').digest();
const KDF_INFO = Buffer.from('warden.ai/hybrid-kem/v1/aes-256-gcm', 'utf8');
const B64URL = /^[A-Za-z0-9_-]+$/;

export interface WardenHybridPublicKey { kid: string; x25519PublicKey: Uint8Array; mlkemPublicKey: Uint8Array; }
export interface WardenHybridPrivateKey extends WardenHybridPublicKey { x25519PrivateKey: Uint8Array; mlkemPrivateKey: Uint8Array; }
export interface WardenEnvelope { v: 1; kem: typeof WARDEN_KEM; aead: typeof WARDEN_AEAD; kid: string; ephX25519: string; mlkemCt: string; iv: string; ct: string; }

function b64u(bytes: Uint8Array): string { return Buffer.from(bytes).toString('base64url'); }
function fromB64u(value: unknown, name: string): Buffer {
  if (typeof value !== 'string' || !value || !B64URL.test(value) || value.includes('=')) throw new Error('WARDEN_DECRYPT_FAILED');
  try { const out = Buffer.from(value, 'base64url'); if (b64u(out) !== value) throw new Error(); return out; } catch { throw new Error('WARDEN_DECRYPT_FAILED'); }
}
function aad(kid: string): Buffer {
  return Buffer.from(`v=1&kem=X25519%2BML-KEM-768&aead=AES-256-GCM&kid=${encodeURIComponent(kid)}`, 'utf8');
}
function derive(x: Uint8Array, pq: Uint8Array): Buffer {
  if (x.length !== 32 || pq.length !== 32) throw new Error('WARDEN_CRYPTO_INVALID_SECRET');
  return Buffer.from(hkdfSync('sha256', Buffer.concat([Buffer.from(x), Buffer.from(pq)]), KDF_SALT, KDF_INFO, 32));
}
function rejectZeroX25519(secret: Uint8Array) {
  if (secret.length !== 32 || timingSafeEqual(Buffer.from(secret), Buffer.alloc(32))) throw new Error('WARDEN_DECRYPT_FAILED');
}

export function generateHybridKeyPair(kid: string): WardenHybridPrivateKey {
  if (!kid || kid.length > 200) throw new Error('WARDEN_CRYPTO_INVALID_KID');
  const xPriv = randomBytes(32);
  const xPub = x25519.getPublicKey(xPriv);
  const pq = ml_kem768.keygen();
  return { kid, x25519PrivateKey: xPriv, x25519PublicKey: xPub, mlkemPrivateKey: pq.secretKey, mlkemPublicKey: pq.publicKey };
}

export function encryptWardenPayload(plaintext: Uint8Array | string, recipient: WardenHybridPublicKey): WardenEnvelope {
  if (!recipient.kid || recipient.x25519PublicKey.length !== 32) throw new Error('WARDEN_CRYPTO_INVALID_KEY');
  const ephPriv = randomBytes(32);
  const ephPub = x25519.getPublicKey(ephPriv);
  const xSecret = x25519.getSharedSecret(ephPriv, recipient.x25519PublicKey);
  rejectZeroX25519(xSecret);
  const encapsulated = ml_kem768.encapsulate(recipient.mlkemPublicKey);
  const key = derive(xSecret, encapsulated.sharedSecret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  cipher.setAAD(aad(recipient.kid));
  const input = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : Buffer.from(plaintext);
  const ciphertext = Buffer.concat([cipher.update(input), cipher.final(), cipher.getAuthTag()]);
  key.fill(0); Buffer.from(xSecret).fill(0); Buffer.from(encapsulated.sharedSecret).fill(0); ephPriv.fill(0);
  return { v: 1, kem: WARDEN_KEM, aead: WARDEN_AEAD, kid: recipient.kid, ephX25519: b64u(ephPub), mlkemCt: b64u(encapsulated.cipherText), iv: b64u(iv), ct: b64u(ciphertext) };
}

export function decryptWardenPayload(envelope: unknown, recipient: WardenHybridPrivateKey): Buffer {
  try {
    if (!envelope || typeof envelope !== 'object') throw new Error();
    const e = envelope as Record<string, unknown>;
    const allowed = new Set(['v','kem','aead','kid','ephX25519','mlkemCt','iv','ct']);
    if (Object.keys(e).some(k => !allowed.has(k)) || e.v !== 1 || e.kem !== WARDEN_KEM || e.aead !== WARDEN_AEAD || e.kid !== recipient.kid) throw new Error();
    const eph = fromB64u(e.ephX25519, 'ephX25519'); const pqCt = fromB64u(e.mlkemCt, 'mlkemCt'); const iv = fromB64u(e.iv, 'iv'); const ct = fromB64u(e.ct, 'ct');
    if (eph.length !== 32 || pqCt.length !== 1088 || iv.length !== 12 || ct.length < 16) throw new Error();
    const xSecret = x25519.getSharedSecret(recipient.x25519PrivateKey, eph); rejectZeroX25519(xSecret);
    const pqSecret = ml_kem768.decapsulate(pqCt, recipient.mlkemPrivateKey);
    const key = derive(xSecret, pqSecret); const body = ct.subarray(0, -16); const tag = ct.subarray(-16);
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 }); decipher.setAAD(aad(recipient.kid)); decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(body), decipher.final()]);
    key.fill(0); Buffer.from(xSecret).fill(0); Buffer.from(pqSecret).fill(0); return plaintext;
  } catch { throw new Error('WARDEN_DECRYPT_FAILED'); }
}

export function publicHybridKey(key: WardenHybridPrivateKey): WardenHybridPublicKey {
  return { kid: key.kid, x25519PublicKey: key.x25519PublicKey, mlkemPublicKey: key.mlkemPublicKey };
}
