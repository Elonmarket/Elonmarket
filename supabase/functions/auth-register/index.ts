import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import bs58 from "https://esm.sh/bs58@6.0.0";
import nacl from "https://esm.sh/tweetnacl@1.0.3";
import { createSessionToken } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HASH_ITERATIONS = 210_000;
const HASH_LENGTH = 32;

const encoder = new TextEncoder();

function encodeBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: HASH_ITERATIONS,
    },
    key,
    HASH_LENGTH * 8,
  );

  return encodeBase64(new Uint8Array(derivedBits));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const username = (body.username ?? body.display_name ?? "").trim();
    const walletAddress = (body.walletAddress ?? body.wallet_address ?? "").trim();
    const password = typeof body.password === "string" ? body.password : "";



    if (!username) {
      return new Response(
        JSON.stringify({ error: "Username is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!password) {
      return new Response(
        JSON.stringify({ error: "Password is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }



    if (action === "register") {
      if (!walletAddress) {
        return new Response(
          JSON.stringify({ error: "Wallet address is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if wallet already exists (one account per wallet)
      const { data: existingByWallet } = await supabase
        .from("profiles")
        .select("id")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (existingByWallet) {
        return new Response(
          JSON.stringify({ error: "Wallet is already registered." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Block registration if username is already used (case-insensitive)
      const { data: usernameTaken, error: rpcError } = await supabase
        .rpc("profile_username_exists", { _username: username });

      if (rpcError) {
        // Fallback when RPC is missing: check with ilike (case-insensitive), exact match by escaping %_
        const escaped = username.replace(/[%_\\]/g, "\\$&");
        const { data: existingByName } = await supabase
          .from("profiles")
          .select("id")
          .ilike("display_name", escaped)
          .limit(1);
        if (existingByName && existingByName.length > 0) {
          return new Response(
            JSON.stringify({ error: "Username is already taken." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else if (usernameTaken) {
        return new Response(
          JSON.stringify({ error: "Username is already taken." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const salt = crypto.getRandomValues(new Uint8Array(16));
      const passwordHash = await hashPassword(password, salt);

      const { data: profile, error: insertError } = await supabase
        .from("profiles")
        .insert({
          display_name: username,
          wallet_address: walletAddress,
          password_hash: passwordHash,
          password_salt: encodeBase64(salt),
          password_updated_at: new Date().toISOString(),
        })
        .select("id, display_name, wallet_address, total_wins, total_predictions, total_claimed_usd, unclaimed_rewards_sol")
        .single();

      if (insertError) {
        const code = (insertError as { code?: string }).code;
        const msg = (insertError.message || "").toLowerCase();
        // Unique violation: never allow duplicate username or wallet
        if (code === "23505") {
          if (msg.includes("wallet") || (insertError as { details?: string }).details?.includes("wallet")) {
            return new Response(
              JSON.stringify({ error: "Wallet is already registered." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          return new Response(
            JSON.stringify({ error: "Username is already taken." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        console.error("Profile insert error:", insertError);
        return new Response(
          JSON.stringify({ error: insertError.message || "Registration failed." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          user: profile,
          sessionToken: await createSessionToken({
            userId: profile.id,
            username: profile.display_name ?? username,
            walletAddress: profile.wallet_address,
          }),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "login") {
      const { data: profile, error: selectError } = await supabase
        .from("profiles")
        .select("id, display_name, wallet_address, total_wins, total_predictions, total_claimed_usd, unclaimed_rewards_sol, password_hash, password_salt")
        .ilike("display_name", username.replace(/[%_\\]/g, "\\$&"))
        .limit(1)
        .maybeSingle();

      if (selectError || !profile) {
        return new Response(
          JSON.stringify({ error: "User not found." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!profile.password_hash || !profile.password_salt) {
        return new Response(
          JSON.stringify({ error: "This account does not have a password set yet." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const providedHash = await hashPassword(password, decodeBase64(profile.password_salt));
      const hashesMatch = timingSafeEqual(
        decodeBase64(providedHash),
        decodeBase64(profile.password_hash),
      );

      if (!hashesMatch) {
        return new Response(
          JSON.stringify({ error: "Invalid username or password." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { password_hash: _passwordHash, password_salt: _passwordSalt, ...safeProfile } = profile;

      return new Response(
        JSON.stringify({
          user: safeProfile,
          sessionToken: await createSessionToken({
            userId: safeProfile.id,
            username: safeProfile.display_name ?? username,
            walletAddress: safeProfile.wallet_address,
          }),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'register' or 'login'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("auth-register error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
