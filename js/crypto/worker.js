// NOTE5 — Crypto Worker
// Cifrado: AES-256-GCM con subclave por sobre (HKDF-SHA256).
// La contraseña entra aquí. Nunca sale.

const VERSION = 0x01;
const PBKDF2_ITERATIONS = 100_000;
const SALT_MASTER = 'note5-master-v1';
const INFO_AEAD   = 'note5-aead-v1';
const USERID_TAG  = 'note5-userid-v1';

const SALT_LEN  = 16;
const NONCE_LEN = 12;
const TAG_LEN   = 16;
const OVERHEAD  = 1 + SALT_LEN + NONCE_LEN + TAG_LEN;  // 45

const enc = new TextEncoder();

const state = {
  userId: null,
  masterKey: null,     // CryptoKey HKDF
  derivedAt: 0,
};

self.onmessage = async (e) => {
  const { id, type, payload } = e.data || {};
  try {
    let result;
    switch (type) {
      case 'deriveIdentity': result = await deriveIdentity(payload); break;
      case 'encrypt':        result = await encrypt(payload); break;
      case 'decrypt':        result = await decrypt(payload); break;
      case 'lock':           lock(); result = { ok: true }; break;
      case 'status':         result = { derived: !!state.masterKey, userId: state.userId, derivedAt: state.derivedAt }; break;
      default: throw new Error('unknown_type:' + type);
    }
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err.message || String(err) });
  }
};

function report(stage, pct, detail) {
  self.postMessage({ type: 'progress', stage, pct, detail });
}

// ---------- Derivation ----------

async function deriveIdentity({ username, password }) {
  if (!username || !password) throw new Error('missing_credentials');

  const t0 = performance.now();
  report('pbkdf2-master', 5,
    `PBKDF2-SHA256 · ${PBKDF2_ITERATIONS.toLocaleString()} iterations · salt="${SALT_MASTER}"`);

  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(`${username}:${password}`),
    { name: 'PBKDF2' }, false, ['deriveBits']
  );

  const masterBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(SALT_MASTER),
      iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey, 256
  );

  report('pbkdf2-master', 60,
    `Master key material · 256 bits · ${(performance.now() - t0).toFixed(0)} ms`);

  // userId = SHA-256(masterBits ‖ "note5-userid-v1")
  const idBuf = new Uint8Array(masterBits.byteLength + USERID_TAG.length);
  idBuf.set(new Uint8Array(masterBits), 0);
  idBuf.set(enc.encode(USERID_TAG), masterBits.byteLength);
  const idHash = await crypto.subtle.digest('SHA-256', idBuf);
  state.userId = bufToHex(idHash);
  report('userid', 75, `Identity · ${state.userId.slice(0, 24)}…`);

  // Master key como CryptoKey HKDF
  state.masterKey = await crypto.subtle.importKey(
    'raw', masterBits, { name: 'HKDF' }, false, ['deriveKey']
  );

  state.derivedAt = Date.now();
  report('ready', 80, 'Master key ready');
  return { userId: state.userId };
}

// ---------- Encrypt ----------

async function encrypt({ plaintext }) {
  if (!state.masterKey) throw new Error('locked');

  const bytes = toUint8(plaintext);
  const t0 = performance.now();

  report('salt', 10, `HKDF-SHA256 · salt ${SALT_LEN} B random`);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const key  = await deriveAeadKey(salt);

  report('nonce', 30, `Nonce ${NONCE_LEN} B random`);
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LEN));

  report('gcm', 45, `AES-256-GCM · plaintext ${bytes.byteLength.toLocaleString()} B`);
  const aad = new Uint8Array([VERSION]);
  const ctTag = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aad, tagLength: 128 },
    key, bytes
  ));

  // envelope = [version][salt][nonce][ct‖tag]
  const envelope = new Uint8Array(1 + SALT_LEN + NONCE_LEN + ctTag.byteLength);
  envelope[0] = VERSION;
  envelope.set(salt,  1);
  envelope.set(nonce, 1 + SALT_LEN);
  envelope.set(ctTag, 1 + SALT_LEN + NONCE_LEN);

  report('envelope', 60,
    `Envelope ${envelope.byteLength.toLocaleString()} B · +${OVERHEAD} B overhead · ${(performance.now() - t0).toFixed(0)} ms`);

  return envelope.buffer;
}

// ---------- Decrypt ----------

async function decrypt({ envelope }) {
  if (!state.masterKey) throw new Error('locked');

  const bytes = toUint8(envelope);
  if (bytes.byteLength < OVERHEAD) throw new Error('envelope_too_short');
  if (bytes[0] !== VERSION) throw new Error(`unsupported_version:${bytes[0]}`);

  const salt  = bytes.slice(1, 1 + SALT_LEN);
  const nonce = bytes.slice(1 + SALT_LEN, 1 + SALT_LEN + NONCE_LEN);
  const ctTag = bytes.slice(1 + SALT_LEN + NONCE_LEN);
  const aad   = new Uint8Array([VERSION]);

  const t0 = performance.now();
  report('hkdf', 20, 'Deriving per-envelope subkey');
  const key = await deriveAeadKey(salt);

  report('gcm', 40, `AES-256-GCM · ciphertext ${ctTag.byteLength} B · verifying tag`);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aad, tagLength: 128 },
    key, ctTag
  );

  report('plaintext', 60,
    `Plaintext ${pt.byteLength.toLocaleString()} B · ${(performance.now() - t0).toFixed(0)} ms`);
  return pt;
}

async function deriveAeadKey(salt) {
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode(INFO_AEAD) },
    state.masterKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function toUint8(x) {
  if (x instanceof Uint8Array) return x;
  if (x instanceof ArrayBuffer) return new Uint8Array(x);
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  throw new Error('unsupported_input_type');
}

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function lock() {
  state.userId = null;
  state.masterKey = null;
  state.derivedAt = 0;
}
