const textEncoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function generateVaultHmac(
  secret: string,
  payload?: Record<string, unknown> | null,
): Promise<string> {
  const body = payload ? JSON.stringify(payload) : "";
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(body));
  return toHex(signature);
}

export function getVaultConfig() {
  return {
    url: Deno.env.get("VAULT_URL") || "",
    gameApiKey: Deno.env.get("VAULT_GAME_API_KEY") || Deno.env.get("VAULT_PASSWORD") || "",
    adminApiKey: Deno.env.get("VAULT_ADMIN_API_KEY") || "",
    hmacSecret: Deno.env.get("VAULT_HMAC_SECRET") || "",
  };
}

export async function buildVaultHeaders(
  apiKey: string,
  payload?: Record<string, unknown> | null,
): Promise<Record<string, string>> {
  const { hmacSecret } = getVaultConfig();
  if (!apiKey) throw new Error("Missing vault API key");
  if (!hmacSecret) throw new Error("Missing VAULT_HMAC_SECRET");

  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "X-HMAC-SIGNATURE": await generateVaultHmac(hmacSecret, payload ?? null),
  };
}
