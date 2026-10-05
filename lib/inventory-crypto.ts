import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const VERSION = "v1";

function getEncryptionKey() {
  const encoded = process.env.INVENTORY_ENCRYPTION_KEY;

  if (!encoded) {
    throw new Error(
      "INVENTORY_ENCRYPTION_KEY is missing from the server environment.",
    );
  }

  const key = Buffer.from(encoded, "base64");

  if (key.length !== 32) {
    throw new Error(
      "INVENTORY_ENCRYPTION_KEY must be a base64 encoded 32-byte key.",
    );
  }

  return key;
}

export function normalizeInventoryCode(value: string) {
  return value.trim();
}

export function hashInventoryCode(value: string) {
  return createHash("sha256")
    .update(normalizeInventoryCode(value), "utf8")
    .digest("hex");
}

export function buildInventoryCodeHint(value: string) {
  const normalized = normalizeInventoryCode(value);

  if (normalized.length <= 4) return "••••";
  const visible = normalized.slice(
    -Math.min(4, Math.floor(normalized.length / 2)),
  );

  return visible ? `••••-${visible}` : "••••";
}

export function encryptInventoryCode(value: string) {
  const normalized = normalizeInventoryCode(value);

  if (!normalized) {
    throw new Error("Inventory codes cannot be empty.");
  }

  const key = getEncryptionKey();

  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptInventoryCode(payload: string) {
  const parts = payload.split(".");
  if (parts.length !== 4) throw new Error("Invalid encrypted payload.");
  const [version, ivValue, tagValue, encryptedValue] = parts;
  if (
    Buffer.from(ivValue, "base64url").length !== 12 ||
    Buffer.from(tagValue, "base64url").length !== 16
  )
    throw new Error("Invalid encrypted payload.");

  if (version !== VERSION || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Unsupported inventory code format.");
  }

  const key = getEncryptionKey();

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivValue, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
