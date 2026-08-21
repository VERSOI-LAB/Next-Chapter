const CODE_TTL_MS = 5 * 60 * 1000;
const VERIFIED_TTL_MS = 30 * 60 * 1000;

const store = new Map();

function normalizePhone(phone) {
  return String(phone || '').replace(/[^0-9]/g, '');
}

function generateCode(phone) {
  const key = normalizePhone(phone);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  store.set(key, { code, expiresAt: Date.now() + CODE_TTL_MS, verified: false, verifiedAt: null });
  return code;
}

function verifyCode(phone, code) {
  const key = normalizePhone(phone);
  const entry = store.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return false;
  }
  if (entry.code !== String(code)) return false;

  entry.verified = true;
  entry.verifiedAt = Date.now();
  return true;
}

function isVerified(phone) {
  const key = normalizePhone(phone);
  const entry = store.get(key);
  if (!entry || !entry.verified) return false;
  if (Date.now() - entry.verifiedAt > VERIFIED_TTL_MS) return false;
  return true;
}

function clear(phone) {
  store.delete(normalizePhone(phone));
}

module.exports = { generateCode, verifyCode, isVerified, clear, normalizePhone };
