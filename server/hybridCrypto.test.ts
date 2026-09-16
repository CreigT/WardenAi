import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptWardenPayload, encryptWardenPayload, generateHybridKeyPair, publicHybridKey, type WardenEnvelope } from './hybridCrypto';

const clone = (e: WardenEnvelope): WardenEnvelope => ({ ...e });
const flip = (s: string) => `${s.slice(0, -1)}${s.endsWith('A') ? 'B' : 'A'}`;

test('hybrid envelope round-trips plaintext', () => {
  const keys = generateHybridKeyPair('test-key-1');
  const envelope = encryptWardenPayload('warden-test-payload', publicHybridKey(keys));
  assert.equal(envelope.v, 1);
  assert.equal(envelope.kem, 'X25519+ML-KEM-768');
  assert.equal(envelope.aead, 'AES-256-GCM');
  assert.equal(decryptWardenPayload(envelope, keys).toString('utf8'), 'warden-test-payload');
});

test('ciphertext tampering is rejected', () => {
  const keys = generateHybridKeyPair('test-key-2');
  const envelope = encryptWardenPayload('secret', publicHybridKey(keys));
  const bad = clone(envelope); bad.ct = flip(bad.ct);
  assert.throws(() => decryptWardenPayload(bad, keys), /WARDEN_DECRYPT_FAILED/);
});

test('authenticated kid tampering is rejected', () => {
  const keys = generateHybridKeyPair('test-key-3');
  const envelope = encryptWardenPayload('secret', publicHybridKey(keys));
  const bad = { ...envelope, kid: 'other-key' };
  assert.throws(() => decryptWardenPayload(bad, keys), /WARDEN_DECRYPT_FAILED/);
});

test('wrong hybrid private key is rejected', () => {
  const senderTarget = generateHybridKeyPair('same-kid');
  const wrong = generateHybridKeyPair('same-kid');
  const envelope = encryptWardenPayload('secret', publicHybridKey(senderTarget));
  assert.throws(() => decryptWardenPayload(envelope, wrong), /WARDEN_DECRYPT_FAILED/);
});

test('unsupported algorithms and malformed lengths are rejected', () => {
  const keys = generateHybridKeyPair('test-key-5');
  const envelope = encryptWardenPayload('secret', publicHybridKey(keys));
  assert.throws(() => decryptWardenPayload({ ...envelope, v: 2 }, keys), /WARDEN_DECRYPT_FAILED/);
  assert.throws(() => decryptWardenPayload({ ...envelope, iv: 'AA' }, keys), /WARDEN_DECRYPT_FAILED/);
  assert.throws(() => decryptWardenPayload({ ...envelope, extra: 'nope' }, keys), /WARDEN_DECRYPT_FAILED/);
});
