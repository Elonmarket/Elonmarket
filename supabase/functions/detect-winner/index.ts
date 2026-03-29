import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildVaultHeaders, getVaultConfig } from "../_shared/vault.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Strip repost headers and "DisplayName (@username)" patterns so account names don't cause false matches. */
function stripAttributionPatterns(text: string): string {
  let cleaned = text;
  // Remove "RT by @username:" prefix
  cleaned = cleaned.replace(/^RT by @\S+:\s*/i, "");
  // Remove attribution labels like "SpaceX (@SpaceX)" before keyword matching.
  cleaned = cleaned.replace(/\b[^()\n]+?\s*\(@[A-Za-z0-9_]+\)/g, "");
  return cleaned;
}

/** Combined text for matching: main tweet + quoted tweet, with attribution stripped. */
function getTweetTextForMatching(tweet: { text?: string | null; quoted_tweet_text?: string | null }): string {
  const mainText = stripAttributionPatterns(tweet.text ?? "");
  const quotedText = stripAttributionPatterns(tweet.quoted_tweet_text ?? "");
  return [mainText, quotedText].filter(Boolean).join("\n");
}

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

    // Special handling for "X" - must be standalone X, 𝕏, or X.com
    if (label === "X") {
      // Match standalone "X" (ASCII), "𝕏" (Unicode symbol), or "x.com"
      const standaloneXRegex = /\bX\b/g;
      const unicodeXRegex = /𝕏/g;
      const xComRegex = /\bx\.com\b/gi;
      
      const standaloneMatch = standaloneXRegex.exec(text);
      const unicodeMatch = unicodeXRegex.exec(text);
      const xComMatch = xComRegex.exec(textLower);
      
      if (unicodeMatch && (matchPosition === -1 || unicodeMatch.index < matchPosition)) {
        matchPosition = unicodeMatch.index;
        matchedKeywords.push("𝕏");
      }
      if (standaloneMatch && (matchPosition === -1 || standaloneMatch.index < matchPosition)) {
        matchPosition = standaloneMatch.index;
        matchedKeywords.push("X");
      }
      if (xComMatch && (matchPosition === -1 || xComMatch.index < matchPosition)) {
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

    // ── Authorization check ─────────────────────────────
    // Allow ONLY: service_role token or admin secret key
    // The anon key is PUBLIC and must NEVER be accepted here
    const authHeader = req.headers.get("Authorization") || "";
    const bearerToken = authHeader.replace("Bearer ", "");
    const adminKey = req.headers.get("x-admin-key") || "";
    const expectedAdminKey = Deno.env.get("ADMIN_SECRET_KEY") || "";

    const isServiceRole = bearerToken === supabaseServiceKey;
    const isAdminKey = adminKey !== "" && adminKey === expectedAdminKey;

    if (!isServiceRole && !isAdminKey) {
      console.error("Unauthorized detect-winner call: no valid credential provided");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Auth OK — caller: ${isServiceRole ? "service_role" : "admin_key"}`);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Load vault config from env vars only (never store secrets in DB)
    const vaultConfig = getVaultConfig();
    console.log(
      `Vault config: url=${vaultConfig.url ? "set" : "missing"}, gameKey=${vaultConfig.gameApiKey ? "set" : "missing"}, hmac=${vaultConfig.hmacSecret ? "set" : "missing"}`,
    );

    // Get request body for potential triggers
    const body = await req.json().catch(() => ({}));
    const triggeredBy = body.triggered_by || "manual";
    const forceFinalize = body.force_finalize === true;

    // Check for open rounds where prediction time has ended
    const { data: openRound } = await supabase
      .from("prediction_rounds")
      .select("*, prediction_options(*)")
      .eq("status", "open")
      .maybeSingle();

    if (!openRound) {
      return new Response(JSON.stringify({ message: "No active round found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const endTime = new Date(openRound.end_time);

    // Only finalize when end_time has truly passed.
    // The cron skew buffer was removed because it caused the cron to lock
    // and finalize rounds up to 2 minutes early — before tweets could arrive.
    // Admin force_finalize still gets a small 30-second grace window.
    const isPastEndTime = now >= endTime;
    const shouldFinalize = isPastEndTime || (forceFinalize && now.getTime() >= (endTime.getTime() - 30000));

    if (shouldFinalize) {
      console.log(`Finalizing round ${openRound.id}. Triggered by: ${triggeredBy}. Past end: ${isPastEndTime}. Force: ${forceFinalize}`);
      return await processWinnerDetection(supabase, openRound, vaultConfig.url, vaultConfig.gameApiKey, corsHeaders);
    }

    if (openRound.prediction_start_time) {
      const predictionStart = new Date(openRound.prediction_start_time);
      if (now >= predictionStart && now < endTime) {
        return await processLiveDetection(supabase, openRound, vaultConfig.url, vaultConfig.gameApiKey, corsHeaders);
      }
    }

    return new Response(JSON.stringify({ message: "Round still active", end_time: openRound.end_time, server_time: now.toISOString() }), {
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

async function lockRoundForProcessing(supabase: any, roundId: string) {
  const { data, error } = await supabase
    .from("prediction_rounds")
    .update({ status: "finalizing" })
    .eq("id", roundId)
    .eq("status", "open")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`Failed to lock round ${roundId} for processing:`, error);
    return false;
  }

  return Boolean(data);
}

// Live detection during prediction time frame
async function processLiveDetection(
  supabase: any,
  round: any,
  vaultUrl: string | undefined,
  vaultGameApiKey: string | undefined,
  corsHeaders: Record<string, string>
) {
  const options = round.prediction_options as any[];
  const predictionStart = round.prediction_start_time || round.start_time;

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

  for (const tweet of tweets) {
    if (tweet.tweet_type !== "post" && tweet.tweet_type !== "quote") continue;

    const match = matchTweetToOption(getTweetTextForMatching(tweet), options);
    if (match) {
      const locked = await lockRoundForProcessing(supabase, round.id);
      if (!locked) {
        return new Response(JSON.stringify({ message: "Round is already being processed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return await finalizeRound(supabase, round, tweet, match.option, match.keywords, vaultUrl, vaultGameApiKey, corsHeaders);
    }
  }

  return new Response(JSON.stringify({ message: "No matching tweet found yet, continuing to monitor..." }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function processWinnerDetection(
  supabase: any,
  round: any,
  vaultUrl: string | undefined,
  vaultGameApiKey: string | undefined,
  corsHeaders: Record<string, string>
) {
  const locked = await lockRoundForProcessing(supabase, round.id);
  if (!locked) {
    return new Response(JSON.stringify({ message: "Round is already being processed or has been finalized" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const options = round.prediction_options as any[];
  const predictionStart = round.prediction_start_time || round.start_time;

  const { data: tweets } = await supabase
    .from("tweets")
    .select("*")
    .gte("created_at_twitter", predictionStart)
    .lte("created_at_twitter", round.end_time)
    .order("created_at_twitter", { ascending: true });

  if (!tweets || tweets.length === 0) {
    await handleNoWinner(supabase, round);
    return new Response(
      JSON.stringify({
        winner_detected: false,
        message: "No posts during prediction window. Round ended with no winners.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  for (const tweet of tweets) {
    if (tweet.tweet_type !== "post" && tweet.tweet_type !== "quote") continue;

    const match = matchTweetToOption(getTweetTextForMatching(tweet), options);
    if (match) {
      return await finalizeRound(supabase, round, tweet, match.option, match.keywords, vaultUrl, vaultGameApiKey, corsHeaders);
    }
  }

  await handleNoWinner(supabase, round);
  return new Response(
    JSON.stringify({
      winner_detected: false,
      message: "No post matched any prediction option. Round ended with no winners.",
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
      winning_option_id: null,
      winning_tweet_id: null,
      winning_tweet_text: null,
      total_winners: 0,
      payout_amount: 0,
      payout_per_winner: 0,
      accumulated_from_previous: 0,
      refill_completed: false,
    })
    .eq("id", round.id);

  await incrementPayoutStats(supabase, { rounds: 1 });
}

async function incrementPayoutStats(
  supabase: any,
  increments: { rounds?: number; paid?: number; predictions?: number }
) {
  const { data: stats } = await supabase.from("payout_stats").select("*").single();
  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  if (increments.rounds) update.total_rounds_completed = (stats?.total_rounds_completed || 0) + increments.rounds;
  if (increments.paid) update.total_paid_usd = (stats?.total_paid_usd || 0) + increments.paid;
  if (increments.predictions) update.total_predictions_made = (stats?.total_predictions_made || 0) + increments.predictions;

  if (stats) {
    await supabase.from("payout_stats").update(update).eq("id", stats.id);
  } else {
    await supabase.from("payout_stats").insert({
      total_rounds_completed: update.total_rounds_completed || 0,
      total_paid_usd: update.total_paid_usd || 0,
      total_predictions_made: update.total_predictions_made || 0,
    });
  }
}

async function finalizeRound(
  supabase: any,
  round: any,
  tweet: any,
  winningOption: any,
  matchedKeywords: string[],
  vaultUrl: string | undefined,
  vaultGameApiKey: string | undefined,
  corsHeaders: Record<string, string>
) {
  await supabase
    .from("tweets")
    .update({
      matched_option_id: winningOption.id,
      matched_keywords: matchedKeywords,
    })
    .eq("id", tweet.id);

  await supabase
    .from("prediction_options")
    .update({ is_winner: true })
    .eq("id", winningOption.id);

  const { data: winningVotes } = await supabase
    .from("votes")
    .select("*, profiles(*)")
    .eq("round_id", round.id)
    .eq("option_id", winningOption.id)
    .order("created_at", { ascending: true });

  const winners = winningVotes ?? [];
  const winnerCount = winners.length;

  if (winnerCount === 0) {
    // Preserve winning_option_id and tweet info so the frontend knows
    // a winning category WAS detected, even though nobody voted for it.
    console.log(`Option '${winningOption.label}' matched but no one voted for it. Preserving winning category info.`);

    await supabase
      .from("prediction_rounds")
      .update({
        status: "no_winner",
        winning_option_id: winningOption.id,
        winning_tweet_id: tweet.tweet_id,
        winning_tweet_text: tweet.text,
        finalized_at: new Date().toISOString(),
        total_winners: 0,
        payout_amount: 0,
        payout_per_winner: 0,
        accumulated_from_previous: 0,
        refill_completed: false,
      })
      .eq("id", round.id);

    await incrementPayoutStats(supabase, { rounds: 1 });

    return new Response(
      JSON.stringify({
        winner_detected: true,
        winning_option: winningOption.label,
        winning_tweet: tweet.text,
        total_winners: 0,
        message: `Winning category: ${winningOption.label}. No one voted for this option, so no payouts were made.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: walletConfig } = await supabase
    .from("wallet_config")
    .select("payout_percentage")
    .single();

  const payoutPercentage = walletConfig?.payout_percentage || 20;
  // Vault credentials from env vars only (never from DB)
  const effectiveVaultUrl = vaultUrl;
  const effectiveVaultKey = vaultGameApiKey;

  let vaultBalance = 0;
  if (effectiveVaultUrl) {
    try {
      const vaultHeaders = await buildVaultHeaders(effectiveVaultKey || "", {});
      const balRes = await fetch(`${effectiveVaultUrl}/balance`, { headers: vaultHeaders });
      if (balRes.ok) {
        const balData = await balRes.json();
        vaultBalance = balData.sol || balData.balance_sol || balData.balance || (balData.lamports ? balData.lamports / 1_000_000_000 : 0);
      }
    } catch (e) {
      console.error("Failed to get vault balance:", e);
    }
  }

  if (vaultBalance === 0) {
    const { data: balances } = await supabase.from("wallet_balances").select("*").single();
    vaultBalance = balances?.vault_balance_sol || 0;
  }

  const totalPayout = vaultBalance * (payoutPercentage / 100);
  const perWinnerPayout = winnerCount > 0 ? totalPayout / winnerCount : 0;

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
      accumulated_from_previous: 0,
      refill_completed: false,
    })
    .eq("id", round.id);

  let successfulPayouts = 0;

  for (const vote of winners) {
    await supabase
      .from("profiles")
      .update({
        total_wins: (vote.profiles?.total_wins || 0) + 1,
      })
      .eq("id", vote.user_id);

    if (!effectiveVaultUrl || perWinnerPayout <= 0) {
      continue;
    }

    try {
      const lamports = Math.floor(perWinnerPayout * 1_000_000_000);
      const payload = {
        round_id: round.id,
        winner_wallet: vote.wallet_address,
        lamports,
      };
      const headers = await buildVaultHeaders(effectiveVaultKey || "", payload);
      const res = await fetch(`${effectiveVaultUrl}/payout`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Payout failed for ${vote.wallet_address}: ${res.status} ${errText}`);
        continue;
      }

      const data = await res.json();
      successfulPayouts += 1;
      console.log(`Payout success for ${vote.wallet_address}: tx=${data.tx_signature || data.signature}`);

      await supabase
        .from("profiles")
        .update({
          total_claimed_usd: (vote.profiles?.total_claimed_usd || 0) + perWinnerPayout,
        })
        .eq("id", vote.user_id);

      await supabase.from("recent_winners").insert({
        round_id: round.id,
        user_id: vote.user_id,
        wallet_address: vote.wallet_address,
        amount: perWinnerPayout,
        tx_signature: data.tx_signature || data.signature || null,
      });
    } catch (e) {
      console.error(`Payout error for ${vote.wallet_address}:`, e);
    }
  }

  const finalStatus = winnerCount > 0 && perWinnerPayout > 0 && successfulPayouts === winnerCount ? "paid" : "finalized";

  await supabase
    .from("prediction_rounds")
    .update({ status: finalStatus })
    .eq("id", round.id);

  // Update wallet_balances so the UI reflects the new vault balance after payout
  if (successfulPayouts > 0 && effectiveVaultUrl) {
    try {
      const headers = await buildVaultHeaders(effectiveVaultKey || "", {});
      const postPayoutRes = await fetch(`${effectiveVaultUrl}/balance`, {
        headers,
      });
      if (postPayoutRes.ok) {
        const postPayoutData = await postPayoutRes.json();
        const newBalance = postPayoutData.sol || (postPayoutData.lamports ? postPayoutData.lamports / 1_000_000_000 : 0);
        await supabase.from("wallet_balances").update({
          vault_balance_sol: newBalance,
          last_updated_at: new Date().toISOString(),
        }).eq("id", (await supabase.from("wallet_balances").select("id").single()).data?.id);
        console.log(`Updated wallet_balances: vault_balance_sol=${newBalance}`);
      }
    } catch (e) {
      console.error("Failed to update wallet_balances after payout:", e);
    }
  }

  await incrementPayoutStats(supabase, {
    rounds: 1,
    paid: successfulPayouts * perWinnerPayout,
  });

  return new Response(
    JSON.stringify({
      winner_detected: true,
      winning_option: winningOption.label,
      winning_tweet: tweet.text,
      total_winners: winnerCount,
      paid_winners: successfulPayouts,
      payout_per_winner: perWinnerPayout,
      total_payout: totalPayout,
      status: finalStatus,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
