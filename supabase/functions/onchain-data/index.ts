import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOLANA_RPC = Deno.env.get("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";

async function getSOLBalance(address: string): Promise<number> {
  if (!address) return 0;
  const res = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [address],
    }),
  });
  const data = await res.json();
  if (data.error) {
    console.error("getBalance error:", data.error);
    return 0;
  }
  return (data.result?.value || 0) / 1e9; // lamports to SOL
}

async function getTokenSupply(mint: string): Promise<{ supply: number; decimals: number }> {
  if (!mint) return { supply: 0, decimals: 0 };
  const res = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenSupply",
      params: [mint],
    }),
  });
  const data = await res.json();
  if (data.error) {
    console.error("getTokenSupply error:", data.error);
    return { supply: 0, decimals: 0 };
  }
  const info = data.result?.value;
  return {
    supply: Number(info?.uiAmount || 0),
    decimals: info?.decimals || 0,
  };
}

async function getTokenHolderCount(mint: string): Promise<number> {
  if (!mint) return 0;

  // Method 1: Pump.fun API (free, works for pump.fun tokens)
  try {
    const res = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`);
    if (res.ok) {
      const data = await res.json();
      console.log("Pump.fun data keys:", Object.keys(data || {}));
      const holders = data?.holder_count ?? data?.holderCount ?? data?.holders ?? 0;
      if (holders > 0) {
        console.log("Pump.fun holder count:", holders);
        return holders;
      }
    } else {
      console.log("Pump.fun status:", res.status);
    }
  } catch (e) {
    console.error("Pump.fun API failed:", e);
  }

  // Method 2: Solscan free public API
  try {
    const res = await fetch(
      `https://public-api.solscan.io/token/meta?tokenAddress=${mint}`,
      { headers: { Accept: "application/json" } }
    );
    console.log("Solscan status:", res.status);
    if (res.ok) {
      const data = await res.json();
      console.log("Solscan data keys:", Object.keys(data || {}));
      const holders = data?.holder ?? data?.holderCount ?? 0;
      if (holders > 0) {
        console.log("Solscan holder count:", holders);
        return holders;
      }
    }
  } catch (e) {
    console.error("Solscan API failed:", e);
  }

  // Method 3: Helius DAS API if key is available
  const heliusKey = Deno.env.get("HELIUS_API_KEY");
  if (heliusKey) {
    try {
      const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "holder-count",
          method: "getTokenAccounts",
          params: { mint, limit: 1, page: 1 },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.result?.total) {
          console.log("Helius holder count:", data.result.total);
          return data.result.total;
        }
      }
    } catch (e) {
      console.error("Helius failed:", e);
    }
  }

  return 0;
}

/**
 * Generate HMAC-SHA256 signature.
 * For GET requests: sign empty string "" (FastAPI request.body() returns b"" for GET)
 * For POST requests: sign the actual JSON body string
 */
async function generateHMAC(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getVaultInfo(vaultUrl: string, apiKey: string, hmacSecret: string): Promise<{ address: string; balance_sol: number }> {
  let address = "";
  let balance = 0;

  try {
    console.log("Vault URL used:", vaultUrl);
    const fundRes = await fetch(`${vaultUrl}/fund`);
    console.log("Fund response status:", fundRes.status);
    if (fundRes.ok) {
      const fundData = await fundRes.json();
      console.log("Fund data:", JSON.stringify(fundData));
      address = fundData.vault_address || fundData.address || "";
    }
  } catch (e) {
    console.error("Vault address fetch failed:", e);
  }

  try {
    // GET request: FastAPI reads empty body, so sign empty string
    const hmacHex = await generateHMAC("", hmacSecret);

    const balRes = await fetch(`${vaultUrl}/balance`, {
      headers: {
        "x-api-key": apiKey,
        "X-HMAC-SIGNATURE": hmacHex,
      },
    });
    if (balRes.ok) {
      const balData = await balRes.json();
      balance = balData.sol || balData.balance || (balData.lamports ? balData.lamports / 1_000_000_000 : 0);
    } else {
      console.warn(`Vault API balance error: ${balRes.status}`);
    }
  } catch (e) {
    console.error("Vault balance fetch failed:", e);
  }

  if (balance === 0 && address) {
    console.log(`Using RPC fallback for vault balance at ${address}`);
    balance = await getSOLBalance(address);
  }

  return { address, balance_sol: balance };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vaultUrl = (Deno.env.get("VAULT_URL") || "").replace(/\/+$/, "");
    const vaultApiKey = Deno.env.get("VAULT_PASSWORD")!;
    const hmacSecret = Deno.env.get("VAULT_HMAC_SECRET") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get wallet config from DB
    const { data: walletConfig } = await supabase
      .from("wallet_config")
      .select("id, vault_wallet_address, payout_wallet_address, token_contract_address, payout_percentage")
      .single();

    if (!walletConfig) {
      return new Response(
        JSON.stringify({ error: "Wallet config not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { vault_wallet_address, payout_wallet_address, token_contract_address, payout_percentage } = walletConfig;

    // Fetch all on-chain data in parallel
    const [vaultInfo, payoutBalanceSOL, tokenSupplyData, holderCount] = await Promise.all([
      getVaultInfo(vaultUrl, vaultApiKey, hmacSecret),
      getSOLBalance(payout_wallet_address),
      getTokenSupply(token_contract_address),
      getTokenHolderCount(token_contract_address),
    ]);

    // Update vault address if it's different from config
    const finalVaultAddress = vaultInfo.address || vault_wallet_address;
    const vaultBalanceSOL = vaultInfo.balance_sol;

    if (vaultInfo.address && vaultInfo.address !== vault_wallet_address) {
      await supabase
        .from("wallet_config")
        .update({ vault_wallet_address: vaultInfo.address })
        .eq("id", walletConfig.id);
    }

    const currentRoundPayout = vaultBalanceSOL * ((payout_percentage || 15) / 100);

    // Update wallet_balances table so other parts of the app stay in sync
    await supabase
      .from("wallet_balances")
      .upsert({
        id: "singleton",
        vault_balance_sol: vaultBalanceSOL,
        payout_balance_sol: payoutBalanceSOL,
        claimable_rewards_sol: 0,
        last_updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    const result = {
      vault: {
        address: finalVaultAddress,
        balance_sol: vaultBalanceSOL,
      },
      payout: {
        address: payout_wallet_address,
        balance_sol: payoutBalanceSOL,
      },
      token: {
        address: token_contract_address,
        total_supply: tokenSupplyData.supply,
        decimals: tokenSupplyData.decimals,
        holder_count: holderCount,
      },
      round_payout: {
        percentage: payout_percentage || 15,
        estimated_sol: currentRoundPayout,
      },
      fetched_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("onchain-data error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
