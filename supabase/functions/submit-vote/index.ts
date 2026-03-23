import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verify token balance on-chain using Solana RPC
async function verifyTokenBalanceOnChain(
  walletAddress: string,
  tokenContract: string,
  rpcUrl: string
): Promise<number> {
  // If no contract is set, voting is effectively open to all.
  // We'll return 999,999,999 to represent a "passing" balance that fits in NUMERIC(20,6)
  if (!tokenContract || tokenContract.trim().length === 0) {
    return 1000000; 
  }

  try {
    console.log(`Verifying balance for ${walletAddress} on contract ${tokenContract}`);
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { mint: tokenContract },
          { encoding: "jsonParsed" },
        ],
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      console.error("RPC Error:", data.error);
      return 0;
    }

    if (data.result?.value?.length > 0) {
      const tokenAmount = data.result.value[0].account.data.parsed.info.tokenAmount;
      return Number(tokenAmount.uiAmount) || 0;
    }
    
    return 0;
  } catch (error) {
    console.error("Error verifying token balance on-chain:", error);
    return 0;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { walletAddress, roundId, optionId } = body;

    if (!walletAddress || !roundId || !optionId) {
      return new Response(JSON.stringify({ error: "Missing required fields: walletAddress, roundId, or optionId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get wallet config for minimum token balance
    const { data: walletConfig, error: configError } = await supabase
      .from("wallet_config")
      .select("min_token_balance, token_contract_address")
      .single();

    if (configError && configError.code !== "PGRST116") {
      throw new Error(`Config error: ${configError.message}`);
    }

    const minBalance = walletConfig?.min_token_balance || 1;
    const tokenContract = walletConfig?.token_contract_address || "";

    // Verify token balance ON-CHAIN (server-side verification)
    const rpcUrl = Deno.env.get("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";
    const verifiedTokenBalance = await verifyTokenBalanceOnChain(walletAddress, tokenContract, rpcUrl);
    
    if (verifiedTokenBalance < minBalance) {
      return new Response(
        JSON.stringify({
          error: `Insufficient token balance. Required: ${minBalance}, Verified: ${verifiedTokenBalance}. Please make sure you have the required tokens in your wallet.`,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if round is open
    const { data: round, error: roundError } = await supabase
      .from("prediction_rounds")
      .select("*")
      .eq("id", roundId)
      .single();

    if (roundError || !round) {
      return new Response(JSON.stringify({ error: "Round not found or database error" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (round.status !== "open") {
      return new Response(JSON.stringify({ error: `Round is ${round.status}, not open for voting.` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Vote locking logic: lock votes X minutes before prediction_start_time
    if (round.prediction_start_time) {
      const now = new Date();
      const predictionStart = new Date(round.prediction_start_time);
      const voteLockMinutes = round.vote_lock_minutes ?? 60;
      const voteLockTime = new Date(predictionStart.getTime() - voteLockMinutes * 60 * 1000);

      if (now >= voteLockTime) {
        const minutesUntilPrediction = Math.ceil((predictionStart.getTime() - now.getTime()) / (60 * 1000));
        return new Response(
          JSON.stringify({
            error: `Voting is locked. Prediction monitoring starts in ${minutesUntilPrediction > 0 ? minutesUntilPrediction + " minutes" : "now"}.`,
            vote_locked: true,
            prediction_start_time: round.prediction_start_time,
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Get or create user profile
    let { data: profile, error: profileGetError } = await supabase
      .from("profiles")
      .select("id")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (profileGetError) {
      throw new Error(`Profile fetch error: ${profileGetError.message}`);
    }

    if (!profile) {
      console.log(`Creating new profile for ${walletAddress}`);
      const { data: newProfile, error: profileInsertError } = await supabase
        .from("profiles")
        .insert({
          wallet_address: walletAddress,
          display_name: `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`,
        })
        .select("id")
        .single();

      if (profileInsertError) {
        throw new Error(`Profile creation failed: ${profileInsertError.message}`);
      }
      profile = newProfile;

      // Add user role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: profile.id,
        role: "user",
      });
      
      if (roleError) {
        console.error("Warning: Could not assign user role:", roleError.message);
      }
    }

    // Check if user already voted this round
    const { data: existingVote, error: voteCheckError } = await supabase
      .from("votes")
      .select("id")
      .eq("round_id", roundId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (voteCheckError) {
      throw new Error(`Vote check error: ${voteCheckError.message}`);
    }

    if (existingVote) {
      return new Response(JSON.stringify({ error: "You have already voted this round" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert vote
    console.log(`Inserting vote for user ${profile.id} on round ${roundId}`);
    const { data: vote, error: voteError } = await supabase
      .from("votes")
      .insert({
        round_id: roundId,
        user_id: profile.id,
        option_id: optionId,
        wallet_address: walletAddress,
        token_balance_at_vote: verifiedTokenBalance,
      })
      .select()
      .single();

    if (voteError) {
      throw new Error(`Vote insertion failed: ${voteError.message}`);
    }

    // Increment total_predictions on the user's profile
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("total_predictions")
      .eq("id", profile.id)
      .single();
    await supabase
      .from("profiles")
      .update({ total_predictions: (currentProfile?.total_predictions || 0) + 1 })
      .eq("id", profile.id);

    // Increment total_predictions_made in payout_stats
    const { data: stats } = await supabase.from("payout_stats").select("*").single();
    if (stats) {
      await supabase
        .from("payout_stats")
        .update({
          total_predictions_made: (stats.total_predictions_made || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", stats.id);
    } else {
      await supabase.from("payout_stats").insert({
        total_predictions_made: 1,
        total_paid_usd: 0,
        total_rounds_completed: 0,
      });
    }

    return new Response(JSON.stringify({ success: true, vote }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error submitting vote:", error);
    const errorMessage = error.message || error.error_description || error.toString() || "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
