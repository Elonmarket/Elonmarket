import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const vaultUrl = Deno.env.get("VAULT_URL");
    const vaultPassword = Deno.env.get("VAULT_PASSWORD");

    // 1. Get finalized but NOT paid rounds
    const { data: rounds } = await supabase
      .from("prediction_rounds")
      .select("*")
      .eq("status", "finalized")
      .is("paid_at", null);

    if (!rounds || rounds.length === 0) {
      return new Response(JSON.stringify({ message: "No rounds to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const round of rounds) {
      // Prevent double execution
      if (!round.winning_option_id) continue;

      // 2. Get winners
      const { data: winners } = await supabase
        .from("votes")
        .select("user_id, wallet_address")
        .eq("round_id", round.id)
        .eq("option_id", round.winning_option_id);

      if (!winners || winners.length === 0) continue;

      // 3. Process payouts
      for (const winner of winners) {
        try {
          // Check if already paid
          const { data: existing } = await supabase
            .from("claims")
            .select("id")
            .eq("round_id", round.id)
            .eq("user_id", winner.user_id)
            .maybeSingle();

          if (existing) continue;

          let txSig: string | null = null;

          // Send payout via vault
          if (vaultUrl) {
            const res = await fetch(`${vaultUrl}/payout`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": vaultPassword || "",
              },
              body: JSON.stringify({
                wallet: winner.wallet_address,
                amount: round.payout_per_winner,
              }),
            });

            if (res.ok) {
              const data = await res.json();
              txSig = data.tx_signature || data.signature || null;
            } else {
              console.error("Vault error:", await res.text());
              continue;
            }
          }

          // 4. Save payout log
          await supabase.from("claims").insert({
            round_id: round.id,
            user_id: winner.user_id,
            wallet_address: winner.wallet_address,
            amount: round.payout_per_winner,
            status: "completed",
            tx_signature: txSig,
            processed_at: new Date().toISOString(),
          });

          // 5. 🔥 REALTIME EVENT (THIS IS THE MAGIC)
          await supabase.from("payout_events").insert({
            user_id: winner.user_id,
            message: `🎉 Congratulations! You won ${round.payout_per_winner} SOL`,
            amount: round.payout_per_winner,
            round_id: round.id,
          });

        } catch (err) {
          console.error("Payout error:", err);
        }
      }

      // 6. Mark round as paid
      await supabase
        .from("prediction_rounds")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", round.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Auto payout executed",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Fatal error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
