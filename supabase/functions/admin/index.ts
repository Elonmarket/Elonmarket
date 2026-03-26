import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOLANA_RPC = Deno.env.get("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";

async function getSOLBalance(address: string): Promise<number> {
  if (!address) return 0;
  try {
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
    return (data.result?.value || 0) / 1e9;
  } catch (e) {
    console.error("RPC balance fetch failed:", e);
    return 0;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, adminWallet, adminSecretKey, data } = await req.json();

    if (!action || !adminWallet) {
      return new Response(JSON.stringify({ error: "Missing action or admin wallet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin access
    const expectedSecretKey = Deno.env.get("ADMIN_SECRET_KEY");
    
    if (adminWallet === "private_admin") {
      if (!adminSecretKey || adminSecretKey !== expectedSecretKey) {
        return new Response(JSON.stringify({ error: "Unauthorized - Invalid admin credentials" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { data: isAdmin } = await supabase.rpc("is_admin_wallet", {
        _wallet: adminWallet,
      });

      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Unauthorized - Admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    switch (action) {
      case "update_wallet_config": {
        const updateData: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        
        if (data.vaultWallet !== undefined) updateData.vault_wallet_address = data.vaultWallet;
        if (data.payoutWallet !== undefined) updateData.payout_wallet_address = data.payoutWallet;
        if (data.tokenContract !== undefined) updateData.token_contract_address = data.tokenContract;
        if (data.minTokenBalance !== undefined) updateData.min_token_balance = data.minTokenBalance;
        if (data.payoutPercentage !== undefined) updateData.payout_percentage = data.payoutPercentage;
        if (data.twitterUserId !== undefined) updateData.twitter_user_id = data.twitterUserId;
        if (data.twitterUsername !== undefined) updateData.twitter_username = data.twitterUsername;

        const { data: existingConfig } = await supabase.from("wallet_config").select("id").single();
        if (existingConfig) {
          const { error } = await supabase
            .from("wallet_config")
            .update(updateData)
            .eq("id", existingConfig.id);
          if (error) throw error;
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_platform_config": {
        for (const [key, value] of Object.entries(data)) {
          await supabase
            .from("platform_config")
            .update({
              value: JSON.stringify(value),
              updated_at: new Date().toISOString(),
            })
            .eq("key", key);
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create_round": {
        const { data: lastRound } = await supabase
          .from("prediction_rounds")
          .select("round_number")
          .order("round_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        const newRoundNumber = (lastRound?.round_number || 0) + 1;

        const { data: newRound, error } = await supabase
          .from("prediction_rounds")
          .insert({
            round_number: newRoundNumber,
            question: data.question || "What will Elon post about first?",
            start_time: data.startTime || new Date().toISOString(),
            end_time: data.endTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            prediction_start_time: data.predictionStartTime || null,
            vote_lock_minutes: data.voteLockMinutes || 60,
            status: data.status || "upcoming",
          })
          .select()
          .single();

        if (error) throw error;

        // Add options
        if (data.options && data.options.length > 0) {
          const optionsToInsert = data.options.map((opt: any) => {
            const keywords = opt.keywords || [opt.label.toLowerCase()];
            // If the option is "X", always ensure 𝕏 is a keyword
            if (opt.label === "X" && !keywords.includes("𝕏")) {
              keywords.push("𝕏");
            }
            return {
              round_id: newRound.id,
              label: opt.label,
              keywords: keywords,
              color: opt.color || "#00FF88",
              icon: opt.icon || "zap",
            };
          });

          await supabase.from("prediction_options").insert(optionsToInsert);
        }

        return new Response(JSON.stringify({ success: true, round: newRound }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "start_round": {
        const { error } = await supabase
          .from("prediction_rounds")
          .update({
            status: "open",
            start_time: new Date().toISOString(),
          })
          .eq("id", data.roundId);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_round": {
        const updateFields: Record<string, any> = {};
        if (data.question) updateFields.question = data.question;
        if (data.startTime) updateFields.start_time = data.startTime;
        if (data.endTime) updateFields.end_time = data.endTime;
        if (data.predictionStartTime) updateFields.prediction_start_time = data.predictionStartTime;
        if (data.voteLockMinutes !== undefined) updateFields.vote_lock_minutes = data.voteLockMinutes;
        if (data.status) updateFields.status = data.status;

        const { error } = await supabase
          .from("prediction_rounds")
          .update(updateFields)
          .eq("id", data.id);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_game_config": {
        const { error } = await supabase
          .from("game_config")
          .update({
            rss_feed_url: data.rss_feed_url,
            posts_to_display: data.posts_to_display,
            cooldown_minutes: data.cooldown_minutes,
            default_options: data.default_options,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.id);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "add_option": {
        const { error } = await supabase.from("prediction_options").insert({
          round_id: data.roundId,
          label: data.label,
          keywords: data.keywords || [data.label.toLowerCase()],
          color: data.color || "#00FF88",
          icon: data.icon || "zap",
        });

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "remove_option": {
        const { error } = await supabase
          .from("prediction_options")
          .delete()
          .eq("id", data.optionId);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "add_admin":
      case "remove_admin": {
        return new Response(JSON.stringify({ error: "Admin role management is disabled for security." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "verify_admin": {
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }


      case "vault_refresh_balance": {
        const vaultUrl = Deno.env.get("VAULT_URL")!;
        const vaultApiKey = Deno.env.get("VAULT_PASSWORD")!;

        let vaultBalance = 0;
        let vaultAddress = "";

        try {
          // 1. Get current address from fund endpoint
          const fundRes = await fetch(`${vaultUrl}/fund`);
          if (fundRes.ok) {
            const fundData = await fundRes.json();
            vaultAddress = fundData.vault_address || fundData.address || "";
          }
        } catch (e) {
          console.error("Vault address fetch error:", e);
        }

        try {
          const headers: Record<string, string> = { 
            "Content-Type": "application/json",
            "x-api-key": vaultApiKey 
          };

          const vaultResponse = await fetch(`${vaultUrl}/balance`, {
            method: "GET",
            headers,
          });

          if (vaultResponse.ok) {
            const vaultData = await vaultResponse.json();
            vaultBalance = vaultData.balance || 0;
          }
        } catch (e) {
          console.error("Vault balance fetch error:", e);
        }

        // 2. Fallback: If balance is 0/error but we have an address, use RPC
        if (vaultBalance === 0 && vaultAddress) {
          vaultBalance = await getSOLBalance(vaultAddress);
        }

        const { data: balRow } = await supabase.from("wallet_balances").select("id").single();
        if (balRow) {
          await supabase
            .from("wallet_balances")
            .update({
              vault_balance_sol: vaultBalance,
              last_updated_at: new Date().toISOString(),
            })
            .eq("id", balRow.id);
        }

        return new Response(JSON.stringify({ success: true, balance: vaultBalance }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "vault_config": {
        const vaultUrl = Deno.env.get("VAULT_URL")!;
        const vaultApiKey = Deno.env.get("VAULT_PASSWORD")!;

        const headers: Record<string, string> = { 
          "Content-Type": "application/json",
          "x-api-key": vaultApiKey 
        };

        const configResponse = await fetch(`${vaultUrl}/config`, {
          method: "POST",
          headers,
          body: JSON.stringify(data), // { percent: 20 } or { percent: 20, drain_wallet: "..." }
        });

        const configResult = await configResponse.json();
        return new Response(JSON.stringify(configResult), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: unknown) {
    console.error("Admin error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
