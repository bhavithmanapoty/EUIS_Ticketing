import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// QR token = base64url(iv[12] || authTag[16] || ciphertext[16]), where the
// plaintext is the ticket UUID's 16 raw bytes. ~59 chars -> small, fast QR.
const IV_LEN = 12;
const TAG_LEN = 16;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function loadKey(hexKey = process.env.QR_SECRET_KEY): Buffer {
  if (!hexKey || !/^[0-9a-f]{64}$/i.test(hexKey)) {
    throw new Error("QR_SECRET_KEY must be 64 hex characters (32 bytes)");
  }
  return Buffer.from(hexKey, "hex");
}

export function encryptTicketId(ticketId: string, hexKey?: string): string {
  if (!UUID_RE.test(ticketId)) throw new Error("Invalid ticket id");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", loadKey(hexKey), iv);
  const plaintext = Buffer.from(ticketId.replace(/-/g, ""), "hex");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64url"
  );
}

/** Returns the ticket UUID, or null if the token is malformed or tampered. */
export function decryptTicketId(token: string, hexKey?: string): string | null {
  const key = loadKey(hexKey);
  try {
    const raw = Buffer.from(token.trim(), "base64url");
    if (raw.length !== IV_LEN + TAG_LEN + 16) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      raw.subarray(0, IV_LEN)
    );
    decipher.setAuthTag(raw.subarray(IV_LEN, IV_LEN + TAG_LEN));
    const hex = Buffer.concat([
      decipher.update(raw.subarray(IV_LEN + TAG_LEN)),
      decipher.final(),
    ]).toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return null;
  }
}
