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
    const { walletAddress, roundId, signedMessage } = await req.json();

    if (!walletAddress) {
      return new Response(JSON.stringify({ error: "Missing wallet address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vaultUrl = Deno.env.get("VAULT_URL");
    const vaultPassword = Deno.env.get("VAULT_PASSWORD");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile with accumulated rewards
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("wallet_address", walletAddress)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const unclaimedRewards = profile.unclaimed_rewards_sol || 0;

    if (unclaimedRewards <= 0) {
      return new Response(JSON.stringify({ error: "No unclaimed rewards available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If roundId is provided, check if already claimed for that specific round
    if (roundId) {
      const { data: existingClaim } = await supabase
        .from("claims")
        .select("*")
        .eq("round_id", roundId)
        .eq("user_id", profile.id)
        .maybeSingle();

      if (existingClaim) {
        return new Response(
          JSON.stringify({
            error: "You have already claimed for this round",
            claim: existingClaim,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get all unclaimed winning rounds for this user
    const { data: unclaimedWins } = await supabase
      .from("votes")
      .select("round_id, prediction_rounds!inner(id, status, winning_option_id, payout_per_winner)")
      .eq("user_id", profile.id)
      .in("prediction_rounds.status", ["finalized", "paid"])
      .not("prediction_rounds.winning_option_id", "is", null);

    // Filter to only votes where user voted for the winning option and hasn't claimed
    const unclaimedRounds: string[] = [];
    let totalClaimAmount = 0;

    if (unclaimedWins) {
      for (const vote of unclaimedWins) {
        const round = (vote as any).prediction_rounds;
        if (!round) continue;

        // Check if user voted for winning option
        const { data: winVote } = await supabase
          .from("votes")
          .select("id")
          .eq("round_id", round.id)
          .eq("user_id", profile.id)
          .eq("option_id", round.winning_option_id)
          .maybeSingle();

        if (!winVote) continue;

        // Check if already claimed
        const { data: existingClaim } = await supabase
          .from("claims")
          .select("id")
          .eq("round_id", round.id)
          .eq("user_id", profile.id)
          .maybeSingle();

        if (!existingClaim) {
          unclaimedRounds.push(round.id);
          totalClaimAmount += round.payout_per_winner || 0;
        }
      }
    }

    if (totalClaimAmount <= 0) {
      return new Response(JSON.stringify({ error: "No rewards available to claim" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exact math - use the accumulated total
    const claimAmount = totalClaimAmount;

    // Create claim records for each unclaimed round
    for (const rId of unclaimedRounds) {
      const roundPayout = (await supabase
        .from("prediction_rounds")
        .select("payout_per_winner")
        .eq("id", rId)
        .single()).data?.payout_per_winner || 0;

      await supabase
        .from("claims")
        .insert({
          round_id: rId,
          user_id: profile.id,
          wallet_address: walletAddress,
          amount: roundPayout,
          status: "processing",
          signed_message: signedMessage,
        });
    }

    // Send claim to vault server
    let vaultSuccess = false;
    if (vaultUrl) {
      try {
        const headers: Record<string, string> = { 
          "Content-Type": "application/json",
          "x-api-key": vaultPassword || "65131200"
        };

        const vaultResponse = await fetch(`${vaultUrl}/payout`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            wallet: walletAddress,
            amount: claimAmount,
          }),
        });

        if (vaultResponse.ok) {
          vaultSuccess = true;
          const vaultData = await vaultResponse.json();
          console.log("Vault payout response:", vaultData);

          // Update all claim records to completed
          for (const rId of unclaimedRounds) {
            await supabase
              .from("claims")
              .update({
                status: "completed",
                processed_at: new Date().toISOString(),
                tx_signature: vaultData.tx_signature || vaultData.signature || null,
              })
              .eq("round_id", rId)
              .eq("user_id", profile.id);
          }
        } else {
          const errText = await vaultResponse.text();
          console.error("Vault payout error:", errText);
        }
      } catch (vaultErr) {
        console.error("Error claiming from vault:", vaultErr);
      }
    }

    // Reset unclaimed rewards and update total claimed
    await supabase
      .from("profiles")
      .update({
        unclaimed_rewards_sol: 0,
        total_claimed_usd: (profile.total_claimed_usd || 0) + claimAmount,
      })
      .eq("id", profile.id);

    /* 
    // Add to recent winners
    if (unclaimedRounds.length > 0) {
      await supabase.from("recent_winners").insert({
        round_id: unclaimedRounds[0],
        user_id: profile.id,
        wallet_address: walletAddress,
        amount: claimAmount,
      });
    }
    */

    return new Response(
      JSON.stringify({
        success: true,
        claim_amount: claimAmount,
        rounds_claimed: unclaimedRounds.length,
        vault_processed: vaultSuccess,
        message: vaultSuccess
          ? `Successfully claimed ${claimAmount.toFixed(6)} SOL from vault.`
          : `Claim of ${claimAmount.toFixed(6)} SOL submitted. Processing...`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error processing claim:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
