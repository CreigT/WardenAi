import { Router } from 'express';
import { decryptWardenPayload, encryptWardenPayload, generateHybridKeyPair, publicHybridKey, type WardenHybridPrivateKey } from './hybridCrypto';

export const hybridCryptoRouter = Router();

// Development/test-only in-memory keyring. Production MUST supply durable KMS/HSM-backed
// hybrid keys instead of enabling this route. Never expose private key material.
const keyring = new Map<string, WardenHybridPrivateKey>();

function enabled() { return process.env.WARDEN_HYBRID_CRYPTO_ENABLED === 'true'; }
function guard(_req: any, res: any, next: any) {
  if (!enabled()) return res.status(404).json({ error: 'not_found' });
  next();
}

hybridCryptoRouter.get('/crypto/status', (_req, res) => {
  res.json({ enabled: enabled(), version: 1, kem: 'X25519+ML-KEM-768', aead: 'AES-256-GCM', keyStorage: 'development-memory-only' });
});

hybridCryptoRouter.post('/crypto/dev/keys', guard, (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'development_only' });
  const kid = typeof req.body?.kid === 'string' ? req.body.kid.trim() : '';
  if (!kid || keyring.has(kid)) return res.status(400).json({ error: 'invalid_or_existing_kid' });
  const keys = generateHybridKeyPair(kid); keyring.set(kid, keys); const pub = publicHybridKey(keys);
  res.status(201).json({ kid, x25519PublicKey: Buffer.from(pub.x25519PublicKey).toString('base64url'), mlkemPublicKey: Buffer.from(pub.mlkemPublicKey).toString('base64url') });
});

hybridCryptoRouter.post('/crypto/dev/encrypt', guard, (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'development_only' });
  const key = keyring.get(req.body?.kid); if (!key || typeof req.body?.plaintext !== 'string') return res.status(400).json({ error: 'invalid_request' });
  res.json({ envelope: encryptWardenPayload(req.body.plaintext, publicHybridKey(key)) });
});

hybridCryptoRouter.post('/crypto/dev/decrypt', guard, (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'development_only' });
  const kid = req.body?.envelope?.kid; const key = typeof kid === 'string' ? keyring.get(kid) : undefined;
  if (!key) return res.status(400).json({ error: 'decrypt_failed' });
  try { res.json({ plaintext: decryptWardenPayload(req.body.envelope, key).toString('utf8') }); }
  catch { res.status(400).json({ error: 'decrypt_failed' }); }
});
