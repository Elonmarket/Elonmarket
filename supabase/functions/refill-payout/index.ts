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
    const { roundId, vaultBalance, adminWallet } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin
    const { data: isAdmin } = await supabase.rpc("is_admin_wallet", {
      _wallet: adminWallet,
    });

    // Get round
    const { data: round } = await supabase
      .from("prediction_rounds")
      .select("*")
      .eq("id", roundId)
      .single();

    if (!round) {
      return new Response(JSON.stringify({ error: "Round not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only finalized rounds can be refilled
    if (round.status !== "finalized") {
      return new Response(
        JSON.stringify({ error: "Round must be finalized before refill" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if already refilled
    if (round.refill_completed) {
      return new Response(JSON.stringify({ error: "Round has already been refilled" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No refill for no_winner rounds
    if (round.status === "no_winner") {
      return new Response(
        JSON.stringify({
          message: "No winner - no payout",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get wallet config
    const { data: walletConfig } = await supabase
      .from("wallet_config")
      .select("payout_percentage")
      .single();

    const percentage = walletConfig?.payout_percentage || 15;
    const totalWinners = round.total_winners || 1;

    // Calculate payout
    const totalPayout = (vaultBalance * percentage) / 100;
    const perWinnerPayout = totalPayout / totalWinners;

    // Update round with payout info
    const { error: updateError } = await supabase
      .from("prediction_rounds")
      .update({
        vault_balance_snapshot: vaultBalance,
        payout_amount: totalPayout,
        payout_per_winner: perWinnerPayout,
        refill_completed: true,
        status: "paid",
      })
      .eq("id", roundId);

    if (updateError) {
      throw updateError;
    }

    // Update payout stats
    await supabase
      .from("payout_stats")
      .update({
        total_paid_usd: supabase.rpc("increment_stat", {
          stat_name: "total_paid_usd",
          amount: totalPayout,
        }),
        total_rounds_completed: supabase.rpc("increment_stat", {
          stat_name: "total_rounds_completed",
          amount: 1,
        }),
      })
      .eq("id", (await supabase.from("payout_stats").select("id").single()).data?.id);

    return new Response(
      JSON.stringify({
        success: true,
        total_payout: totalPayout,
        per_winner: perWinnerPayout,
        total_winners: totalWinners,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error refilling payout:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
