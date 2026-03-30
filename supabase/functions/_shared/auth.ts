const encoder = new TextEncoder();
const decoder = new TextDecoder();

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PASSWORD_CHALLENGE_TTL_MS = 1000 * 60 * 10;

export interface SessionPayload {
  userId: string;
  username: string;
  walletAddress: string;
  issuedAt: number;
  expiresAt: number;
}

export interface PasswordChallengePayload {
  action: "password_reset";
  username: string;
  walletAddress: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return toBase64Url(bytes);
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function getSessionSecret(): string {
  return Deno.env.get("AUTH_SESSION_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

export async function createSessionToken(input: Omit<SessionPayload, "issuedAt" | "expiresAt">): Promise<string> {
  const secret = getSessionSecret();
  if (!secret) throw new Error("Missing session signing secret");

  const payload: SessionPayload = {
    ...input,
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadBytes = encoder.encode(payloadJson);
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, payloadBytes);

  return `${toBase64Url(payloadBytes)}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const secret = getSessionSecret();
  if (!secret) throw new Error("Missing session signing secret");

  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;

  const payloadBytes = fromBase64Url(payloadPart);
  const signatureBytes = fromBase64Url(signaturePart);
  const key = await importHmacKey(secret);
  const valid = await crypto.subtle.verify("HMAC", key, signatureBytes as unknown as BufferSource, payloadBytes as unknown as BufferSource);
  if (!valid) return null;

  const payload = JSON.parse(decoder.decode(payloadBytes)) as SessionPayload;
  if (!payload.userId || !payload.walletAddress || !payload.username) return null;
  if (Date.now() > payload.expiresAt) return null;

  return payload;
}

export async function createPasswordChallenge(input: Pick<PasswordChallengePayload, "username" | "walletAddress">): Promise<{ token: string; message: string }> {
  const secret = getSessionSecret();
  if (!secret) throw new Error("Missing session signing secret");

  const payload: PasswordChallengePayload = {
    action: "password_reset",
    username: input.username,
    walletAddress: input.walletAddress,
    nonce: randomNonce(),
    issuedAt: Date.now(),
    expiresAt: Date.now() + PASSWORD_CHALLENGE_TTL_MS,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadBytes = encoder.encode(payloadJson);
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, payloadBytes);
  const token = `${toBase64Url(payloadBytes)}.${toBase64Url(new Uint8Array(signature))}`;

  const message = [
    "Elonmarket password reset",
    `Username: ${payload.username}`,
    `Wallet: ${payload.walletAddress}`,
    `Challenge: ${token}`,
  ].join("\n");

  return { token, message };
}

export async function verifyPasswordChallenge(token: string): Promise<PasswordChallengePayload | null> {
  const secret = getSessionSecret();
  if (!secret) throw new Error("Missing session signing secret");

  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;

  const payloadBytes = fromBase64Url(payloadPart);
  const signatureBytes = fromBase64Url(signaturePart);
  const key = await importHmacKey(secret);
  const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, payloadBytes);
  if (!valid) return null;

  const payload = JSON.parse(decoder.decode(payloadBytes)) as PasswordChallengePayload;
  if (payload.action !== "password_reset" || !payload.username || !payload.walletAddress || !payload.nonce) return null;
  if (Date.now() > payload.expiresAt) return null;

  return payload;
}
