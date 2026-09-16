# Warden Hybrid Crypto v1

Status: protocol contract for implementation and interoperability testing.

## Goal

Warden v1 uses hybrid key establishment so an encrypted payload depends on both a classical X25519 shared secret and an ML-KEM-768 shared secret. Payload encryption uses AES-256-GCM.

Do not implement X25519, ML-KEM, HKDF, SHA-256, AES, or GCM primitives manually. Use maintained cryptographic libraries and validate them against published vectors.

## Envelope

All binary fields use unpadded base64url.

```json
{
  "v": 1,
  "kem": "X25519+ML-KEM-768",
  "aead": "AES-256-GCM",
  "kid": "recipient-key-id",
  "ephX25519": "...",
  "mlkemCt": "...",
  "iv": "...",
  "ct": "..."
}
```

`ct` contains AES-GCM ciphertext followed by its 16-byte authentication tag.

## Fixed parameters

- X25519 ephemeral public key: 32 bytes.
- ML-KEM-768 ciphertext: 1088 bytes.
- ML-KEM-768 shared secret: 32 bytes.
- AES-256-GCM key: 32 bytes.
- AES-GCM IV: 12 random bytes; a fresh IV is mandatory for every encryption under a derived key.
- AES-GCM tag: 16 bytes.
- KDF: HKDF-SHA-256.

## Hybrid secret construction

Let `ss_x25519` be the 32-byte X25519 Diffie-Hellman output and `ss_mlkem` be the 32-byte ML-KEM-768 decapsulation/encapsulation shared secret.

Reject an all-zero X25519 shared secret.

Create the input key material as an unambiguous, fixed-length concatenation:

```
IKM = ss_x25519 || ss_mlkem
```

Derive exactly 32 bytes with HKDF-SHA-256:

```
salt = SHA-256("WARDEN-HYBRID-KEM-V1")
info = UTF8("warden.ai/hybrid-kem/v1/aes-256-gcm")
key = HKDF-SHA-256(IKM, salt, info, 32)
```

The strings above are protocol constants. Changing either requires a new protocol version.

## Authenticated metadata

The AES-GCM Additional Authenticated Data is the exact UTF-8 encoding of this canonical string:

```
v=1&kem=X25519%2BML-KEM-768&aead=AES-256-GCM&kid=<kid>
```

`kid` must be percent-encoded as a URI query-component before constructing AAD. The recipient must reconstruct the same AAD before decryption. This binds version, algorithms, and recipient key identifier to the ciphertext.

## Encryption

1. Resolve the recipient's active X25519 and ML-KEM-768 public keys by `kid`.
2. Generate a fresh X25519 ephemeral key pair.
3. Compute `ss_x25519` with the recipient X25519 public key.
4. Encapsulate to the recipient ML-KEM-768 public key, producing `mlkemCt` and `ss_mlkem`.
5. Derive the 32-byte payload key exactly as specified above.
6. Generate a cryptographically random 12-byte IV.
7. Build canonical AAD.
8. Encrypt plaintext with AES-256-GCM using the derived key, IV, and AAD.
9. Serialize the envelope using unpadded base64url for binary fields.
10. Erase ephemeral/shared-secret/key buffers where the runtime permits it.

## Decryption

1. Parse JSON with strict schema validation. Reject unknown version/algorithm identifiers.
2. Decode base64url fields and enforce exact lengths before cryptographic processing.
3. Resolve the private key pair identified by `kid`; reject unknown, revoked, or expired keys according to key policy.
4. Compute the X25519 shared secret and reject an all-zero result.
5. Decapsulate `mlkemCt` with the ML-KEM-768 private key.
6. Derive the AES key using the exact v1 KDF construction.
7. Reconstruct canonical AAD.
8. AES-GCM decrypt and authenticate. Authentication failure is fatal and returns no plaintext.
9. Erase derived/shared-secret buffers where supported.

## Validation and failure rules

Reject before decryption when any of these are true:

- `v !== 1`
- `kem !== "X25519+ML-KEM-768"`
- `aead !== "AES-256-GCM"`
- missing/empty `kid`
- malformed/non-canonical base64url
- `ephX25519` is not 32 bytes
- `mlkemCt` is not 1088 bytes
- `iv` is not 12 bytes
- `ct` is shorter than the 16-byte GCM tag
- X25519 produces the all-zero shared secret
- AES-GCM authentication fails

Externally, malformed and authentication failures should use one generic decryption failure response. Detailed reason codes belong only in protected audit telemetry to reduce oracle behavior.

## Replay protection

Encryption alone does not prevent replay. Protocol consumers that execute commands/actions MUST bind a unique message identifier and freshness information at the application layer and reject duplicate/expired commands. These values should be included inside the authenticated plaintext or in a future version's canonical AAD.

## Key management

- `kid` identifies a recipient hybrid key bundle, not a raw secret.
- Private keys must never be logged or returned by API endpoints.
- Rotation creates a new `kid`; old keys may remain decrypt-only for a defined migration window.
- Revoked keys must not be used for new encryption.
- Production secrets belong in an approved secret/KMS facility, not source control or browser storage.

## Required test vectors

Before enabling this protocol for production traffic, commit deterministic interoperability fixtures generated from fixed test-only keys/randomness. Each vector must include recipient public keys, ephemeral public key, ML-KEM ciphertext, IV, plaintext, AAD, derived AES key (test fixture only), and final envelope. Tests must verify successful decrypt plus failures for every tampered authenticated field, ciphertext/tag, wrong private key, malformed lengths, and unsupported version/algorithm.

## Standards basis

- ML-KEM: NIST FIPS 203.
- X25519: RFC 7748.
- KDF construction: HKDF-SHA-256 with explicit Warden v1 domain separation; review against the application's key-establishment requirements before production certification.
- AEAD: AES-256-GCM supplied by a maintained cryptographic library.

This document defines Warden's wire contract. A security review and interoperable test suite are release gates before the feature is described as production-ready or post-quantum secure end-to-end.
