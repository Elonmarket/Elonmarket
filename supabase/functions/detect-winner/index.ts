import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Exact word matching for prediction options.
 * For option "X": only matches standalone "X" or "X.com", NOT "text" or "example".
 * If two options appear in one post, pick the first one that appears.
 */
function matchTweetToOption(tweetText: string, options: any[]): { option: any; keywords: string[] } | null {
  const text = tweetText;
  const textLower = text.toLowerCase();

  // Track first match position for each option
  let firstMatch: { option: any; position: number; keywords: string[] } | null = null;

  for (const option of options) {
    const label = option.label;
    const keywords = (option.keywords as string[]) || [label.toLowerCase()];
    let matchPosition = -1;
    const matchedKeywords: string[] = [];

    // Special handling for "X" - must be standalone X or X.com
    if (label === "X") {
      // Match standalone "X" (e.g. "X", "@X", "#X") or "X.com"
      // \b ensures we don't match "SpaceX" because "e" and "X" are both word chars, so no boundary exists.
      const standaloneXRegex = /\bX\b/g;
      const xComRegex = /\bx\.com\b/gi;
      
      const standaloneMatch = standaloneXRegex.exec(text);
      const xComMatch = xComRegex.exec(textLower);
      
      if (standaloneMatch) {
        matchPosition = standaloneMatch.index;
        matchedKeywords.push("X");
      } else if (xComMatch) {
        matchPosition = xComMatch.index;
        matchedKeywords.push("X.com");
      }
    } else {
      // For all other options, check exact word/mention matching
      for (const keyword of keywords) {
        const kw = keyword.toLowerCase();
        // Use word boundary matching for the keyword itself
        const regex = new RegExp(`(?<![a-zA-Z0-9@#])${escapeRegex(kw)}(?![a-zA-Z0-9])`, "gi");
        const match = regex.exec(text);
        if (match && (matchPosition === -1 || match.index < matchPosition)) {
          matchPosition = match.index;
          matchedKeywords.push(keyword);
        }

        // Also check for .com variant (e.g., SpaceX.com, Tesla.com)
        const comRegex = new RegExp(`(?<![a-zA-Z0-9@#])${escapeRegex(kw)}\\.com(?![a-zA-Z0-9])`, "gi");
        const comMatch = comRegex.exec(text);
        if (comMatch && (matchPosition === -1 || comMatch.index < matchPosition)) {
          matchPosition = comMatch.index;
          matchedKeywords.push(`${keyword}.com`);
        }
      }

      // Also check for @ mention (e.g., @Tesla, @SpaceX)
      const mentionRegex = new RegExp(`@${escapeRegex(label)}\\b`, "gi");
      const mentionMatch = mentionRegex.exec(text);
      if (mentionMatch && (matchPosition === -1 || mentionMatch.index < matchPosition)) {
        matchPosition = mentionMatch.index;
        matchedKeywords.push(`@${label}`);
      }
    }

    if (matchPosition >= 0) {
      if (!firstMatch || matchPosition < firstMatch.position) {
        firstMatch = { option, position: matchPosition, keywords: matchedKeywords };
      }
    }
  }

  if (firstMatch) {
    return { option: firstMatch.option, keywords: firstMatch.keywords };
  }
  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const vaultUrl = Deno.env.get("VAULT_URL");
    const vaultPassword = Deno.env.get("VAULT_PASSWORD");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get game config for cooldown
    const { data: gameConfig } = await supabase
      .from("game_config")
      .select("cooldown_minutes")
      .limit(1)
      .single();

    const cooldownMinutes = gameConfig?.cooldown_minutes || 30;

    // Check for rounds in cooldown that are ready for winner detection
    const { data: cooldownRound } = await supabase
      .from("prediction_rounds")
      .select("*, prediction_options(*)")
      .eq("status", "cooldown")
      .lte("cooldown_end_time", new Date().toISOString())
      .single();

    if (cooldownRound) {
      return await processWinnerDetection(supabase, cooldownRound, lovableApiKey, vaultUrl, vaultPassword, corsHeaders);
    }

    // Check for open rounds where prediction time has ended
    const { data: openRound } = await supabase
      .from("prediction_rounds")
      .select("*, prediction_options(*)")
      .eq("status", "open")
      .single();

    if (!openRound) {
      return new Response(JSON.stringify({ message: "No active round found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const endTime = new Date(openRound.end_time);

    // If round has ended (prediction end time passed), transition to cooldown
    if (now >= endTime) {
      const cooldownEndTime = new Date(now.getTime() + cooldownMinutes * 60 * 1000);

      await supabase
        .from("prediction_rounds")
        .update({
          status: "cooldown",
          cooldown_end_time: cooldownEndTime.toISOString(),
        })
        .eq("id", openRound.id);

      return new Response(
        JSON.stringify({
          status: "cooldown_started",
          message: `Prediction window ended. Winner will be revealed after ${cooldownMinutes} minute cooldown.`,
          cooldown_end_time: cooldownEndTime.toISOString(),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if we're within the prediction time frame and should scan tweets
    if (openRound.prediction_start_time) {
      const predictionStart = new Date(openRound.prediction_start_time);
      if (now >= predictionStart && now < endTime) {
        // We're in the prediction window - check for matching tweets NOW
        return await processLiveDetection(supabase, openRound, lovableApiKey, vaultUrl, vaultPassword, corsHeaders);
      }
    }

    return new Response(JSON.stringify({ message: "Round still active", end_time: openRound.end_time }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error detecting winner:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Live detection during prediction time frame
async function processLiveDetection(
  supabase: any,
  round: any,
  lovableApiKey: string | undefined,
  vaultUrl: string | undefined,
  vaultPassword: string | undefined,
  corsHeaders: Record<string, string>
) {
  const options = round.prediction_options as any[];
  const predictionStart = round.prediction_start_time || round.start_time;
  const now = new Date();
  const endTime = new Date(round.end_time);

  // If prediction window has ended, check for winner or mark as no winner
  if (now >= endTime) {
    // Get all tweets during the prediction window
    const { data: tweets } = await supabase
      .from("tweets")
      .select("*")
      .gte("created_at_twitter", predictionStart)
      .lte("created_at_twitter", round.end_time)
      .order("created_at_twitter", { ascending: true });

    if (!tweets || tweets.length === 0) {
      // No tweets during prediction window - no winner
      await handleNoWinner(supabase, round);
      return new Response(
        JSON.stringify({
          winner_detected: false,
          message: "No posts during prediction window. Pool carries to next round.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check each tweet in order - first matching post/quote wins
    for (const tweet of tweets) {
      if (tweet.tweet_type !== "post" && tweet.tweet_type !== "quote") continue;

      const match = matchTweetToOption(tweet.text, options);
      if (match) {
        // Winner found! Finalize immediately
        return await finalizeRound(supabase, round, tweet, match.option, match.keywords, vaultUrl, vaultPassword, corsHeaders);
      }
    }

    // No match found - mark as no winner, pool carries over
    await handleNoWinner(supabase, round);
    return new Response(
      JSON.stringify({
        winner_detected: false,
        message: "No post matched any prediction option. Pool carries to next round.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Still within prediction window - check for matching tweets
  const { data: tweets } = await supabase
    .from("tweets")
    .select("*")
    .gte("created_at_twitter", predictionStart)
    .lte("created_at_twitter", round.end_time)
    .order("created_at_twitter", { ascending: true });

  if (!tweets || tweets.length === 0) {
    return new Response(JSON.stringify({ message: "No tweets yet in prediction window, monitoring..." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check each tweet in order (first match wins)
  for (const tweet of tweets) {
    // Only consider posts and quoted reposts (not comments/standard reposts)
    if (tweet.tweet_type !== "post" && tweet.tweet_type !== "quote") continue;

    const match = matchTweetToOption(tweet.text, options);
    if (match) {
      // Winner found! Finalize immediately
      return await finalizeRound(supabase, round, tweet, match.option, match.keywords, vaultUrl, vaultPassword, corsHeaders);
    }
  }

  return new Response(JSON.stringify({ message: "No matching tweet found yet, continuing to monitor..." }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function processWinnerDetection(
  supabase: any,
  round: any,
  lovableApiKey: string | undefined,
  vaultUrl: string | undefined,
  vaultPassword: string | undefined,
  corsHeaders: Record<string, string>
) {
  const options = round.prediction_options as any[];
  const predictionStart = round.prediction_start_time || round.start_time;

  // Get all tweets during the prediction time frame
  const { data: tweets } = await supabase
    .from("tweets")
    .select("*")
    .gte("created_at_twitter", predictionStart)
    .lte("created_at_twitter", round.end_time)
    .order("created_at_twitter", { ascending: true });

  if (!tweets || tweets.length === 0) {
    // No tweets during prediction window - no winner
    await handleNoWinner(supabase, round);
    return new Response(
      JSON.stringify({
        winner_detected: false,
        message: "No posts during prediction window. Pool carries to next round.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check each tweet in order - first matching post/quote wins
  for (const tweet of tweets) {
    if (tweet.tweet_type !== "post" && tweet.tweet_type !== "quote") continue;

    const match = matchTweetToOption(tweet.text, options);
    if (match) {
      return await finalizeRound(supabase, round, tweet, match.option, match.keywords, vaultUrl, vaultPassword, corsHeaders);
    }
  }

  // No match found - mark as no winner, pool carries over
  await handleNoWinner(supabase, round);
  return new Response(
    JSON.stringify({
      winner_detected: false,
      message: "No post matched any prediction option. Pool carries to next round.",
      first_tweet: tweets[0]?.text,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleNoWinner(supabase: any, round: any) {
  await supabase
    .from("prediction_rounds")
    .update({
      status: "no_winner",
      finalized_at: new Date().toISOString(),
    })
    .eq("id", round.id);
}

async function finalizeRound(
  supabase: any,
  round: any,
  tweet: any,
  winningOption: any,
  matchedKeywords: string[],
  vaultUrl: string | undefined,
  vaultPassword: string | undefined,
  corsHeaders: Record<string, string>
) {
  // Update tweet with match info
  await supabase
    .from("tweets")
    .update({
      matched_option_id: winningOption.id,
      matched_keywords: matchedKeywords,
    })
    .eq("id", tweet.id);

  // Mark option as winner
  await supabase
    .from("prediction_options")
    .update({ is_winner: true })
    .eq("id", winningOption.id);

  // Get winners (users who voted for winning option)
  // Business rule: if multiple users picked the correct option,
  // ONLY the earliest voter wins the round.
  const { data: winningVotes } = await supabase
    .from("votes")
    .select("*, profiles(*)")
    .eq("round_id", round.id)
    .eq("option_id", winningOption.id)
    .order("created_at", { ascending: true });

  // Only the first (earliest) vote is considered the winner
  const earliestWinningVote = winningVotes && winningVotes.length > 0 ? [winningVotes[0]] : [];
  const winnerCount = earliestWinningVote.length;

  // Get wallet config for payout percentage
  const { data: walletConfig } = await supabase
    .from("wallet_config")
    .select("payout_percentage")
    .single();

  const payoutPercentage = walletConfig?.payout_percentage || 20;

  // Get vault balance
  const { data: balances } = await supabase.from("wallet_balances").select("*").single();
  const vaultBalance = balances?.vault_balance_sol || 0;
  const accumulated = round.accumulated_from_previous || 0;

  // Calculate payout: percentage of vault balance + accumulated
  const basePayout = vaultBalance * (payoutPercentage / 100);
  const totalPayout = basePayout + accumulated;
  const perWinnerPayout = winnerCount > 0 ? totalPayout / winnerCount : 0;

  // Finalize round
  await supabase
    .from("prediction_rounds")
    .update({
      status: "finalized",
      winning_option_id: winningOption.id,
      winning_tweet_id: tweet.tweet_id,
      winning_tweet_text: tweet.text,
      finalized_at: new Date().toISOString(),
      total_winners: winnerCount,
      vault_balance_snapshot: vaultBalance,
      payout_amount: totalPayout,
      payout_per_winner: perWinnerPayout,
    })
    .eq("id", round.id);

  // Update winner profile(s) and accumulate rewards
  if (earliestWinningVote && winnerCount > 0) {
    const winnersForVault: { user: string; amount: number }[] = [];

    for (const vote of earliestWinningVote) {
      // Update win count
      await supabase
        .from("profiles")
        .update({
          total_wins: (vote.profiles?.total_wins || 0) + 1,
          // Add per-winner payout to unclaimed rewards
          unclaimed_rewards_sol: (vote.profiles?.unclaimed_rewards_sol || 0) + perWinnerPayout,
        })
        .eq("id", vote.user_id);

      winnersForVault.push({
        user: vote.wallet_address,
        amount: perWinnerPayout,
      });
    }

    // Send winners to vault server
    if (vaultUrl && winnersForVault.length > 0) {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (vaultPassword) {
          headers["x-vault-password"] = vaultPassword;
        }

        const vaultResponse = await fetch(`${vaultUrl}/winners`, {
          method: "POST",
          headers,
          body: JSON.stringify({ winners: winnersForVault }),
        });

        const vaultData = await vaultResponse.json();
        console.log("Vault response:", vaultData);
      } catch (vaultErr) {
        console.error("Error sending winners to vault:", vaultErr);
      }
    }
  }

  // Update payout stats
  const { data: stats } = await supabase.from("payout_stats").select("*").single();
  if (stats) {
    await supabase
      .from("payout_stats")
      .update({
        total_paid_usd: (stats.total_paid_usd || 0) + totalPayout,
        total_rounds_completed: (stats.total_rounds_completed || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", stats.id);
  }

  return new Response(
    JSON.stringify({
      winner_detected: true,
      winning_option: winningOption.label,
      winning_tweet: tweet.text,
      total_winners: winnerCount,
      payout_per_winner: perWinnerPayout,
      total_payout: totalPayout,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
