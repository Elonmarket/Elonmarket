import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const ELON_AVATAR =
  "https://pbs.twimg.com/profile_images/1815749056821346304/jS8I28PL_400x400.jpg";

/**
 * IFTTT Webhook — ultra-fast responder.
 *
 * 1. Validates & parses the payload
 * 2. Returns 200 immediately so IFTTT never times out
 * 3. Inserts the tweet + triggers winner detection in the background
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ────────────────────────────────────────────
    const webhookSecret = Deno.env.get("IFTTT_WEBHOOK_SECRET");
    const providedSecret =
      req.headers.get("x-webhook-secret") ||
      new URL(req.url).searchParams.get("secret");

    if (webhookSecret && providedSecret !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse payload ──────────────────────────────────
    const body = await req.json();
    console.log("IFTTT payload received:", JSON.stringify(body));

    const tweetText: string = body.text || body.Text || body.tweet_text || "";
    const tweetUrl: string = body.tweet_url || body.LinkToTweet || body.link || "";
    const createdAt: string = body.created_at || body.CreatedAt || new Date().toISOString();
    const userName: string = body.user_name || body.UserName || "Elon Musk";
    const authorUsername: string = body.author_username || body.user_username || body.UserName || "elonmusk";
    const authorId: string = body.author_id || "44196397";
    const tweetTypeRaw: string = body.tweet_type || "post";
    const quotedTweetId: string | null = body.quoted_tweet_id || null;
    const quotedTweetText: string | null = body.quoted_tweet_text || null;

    if (!tweetText) {
      return new Response(
        JSON.stringify({ error: "No tweet text provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip retweets (RSS often formats as "RT by @elonmusk: ...").
    // We only want posts/quote-posts for winner detection.
    if (/^RT by\s+@/i.test(tweetText)) {
      console.log("Skipping retweet:", tweetText.slice(0, 120));
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "retweet" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Filter out replies (not posts that happen to start with @) ──
    // IMPORTANT: Tweets starting with @ (like "@Tesla is working hard") are often
    // standalone posts mentioning companies, not replies. Accept them even if marked as replies.
    const startsWithMention = /^@\w+/i.test(tweetText.trim());
    const isReply =
      body.in_reply_to_status_id && body.in_reply_to_status_id !== "";

    // Only filter as reply if it's actually a reply AND doesn't start with @ mention
    if (isReply && !startsWithMention) {
      console.log("Skipping reply:", tweetText.slice(0, 80));
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "reply" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Log if we're accepting a tweet that starts with @ even though it might be marked as reply
    if (startsWithMention && isReply) {
      console.log("Accepting tweet starting with @ mention (may be incorrectly marked as reply):", tweetText.slice(0, 80));
    }

    // ── Build tweet record ─────────────────────────────
    const tweetIdMatch = tweetUrl.match(/status\/(\d+)/);
    const tweetId = tweetIdMatch
      ? tweetIdMatch[1]
      : `ifttt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // IFTTT sends timestamps in the applet-owner's local timezone.
    // Configure this offset (in hours) to match your IFTTT account timezone.
    // Philippines (PHT) = UTC+8
    const IFTTT_TIMEZONE_OFFSET_HOURS = 8;

    let parsedDate: string;
    try {
      // IFTTT sends dates like "February 09, 2026 at 01:18PM"
      const match = createdAt.match(
        /^(\w+)\s+(\d{1,2}),\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})(AM|PM)$/i
      );
      if (match) {
        const [, monthName, day, year, rawHour, minute, ampm] = match;
        const months: Record<string, string> = {
          january: "01", february: "02", march: "03", april: "04",
          may: "05", june: "06", july: "07", august: "08",
          september: "09", october: "10", november: "11", december: "12",
        };
        const mm = months[monthName.toLowerCase()] || "01";
        let hh = parseInt(rawHour, 10);
        if (ampm.toUpperCase() === "PM" && hh !== 12) hh += 12;
        if (ampm.toUpperCase() === "AM" && hh === 12) hh = 0;
        const dd = day.padStart(2, "0");
        const hhStr = String(hh).padStart(2, "0");

        // Build a Date in the IFTTT sender's local time, then subtract the offset to get UTC
        const localDate = new Date(`${year}-${mm}-${dd}T${hhStr}:${minute}:00.000Z`);
        localDate.setUTCHours(localDate.getUTCHours() - IFTTT_TIMEZONE_OFFSET_HOURS);
        parsedDate = localDate.toISOString();
      } else {
        // Fallback: try generic parsing
        const sanitized = createdAt.replace(/\s+at\s+/i, " ");
        const d = new Date(sanitized);
        parsedDate = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
      }
    } catch {
      parsedDate = new Date().toISOString();
    }

    const tweetType = tweetTypeRaw === "quote" ? ("quote" as const) : ("post" as const);

    const tweetRecord = {
      tweet_id: tweetId,
      text: tweetText,
      author_id: authorId,
      author_username: authorUsername,
      author_name: userName,
      author_avatar: ELON_AVATAR,
      tweet_type: tweetType,
      quoted_tweet_id: tweetType === "quote" ? quotedTweetId : null,
      quoted_tweet_text: tweetType === "quote" ? quotedTweetText : null,
      created_at_twitter: parsedDate,
      fetched_at: new Date().toISOString(),
    };

    // ── Respond immediately ────────────────────────────
    // IFTTT gets its 200 right away; DB work happens in the background.
    const response = new Response(
      JSON.stringify({ success: true, tweet_id: tweetId, message: "Accepted" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

    // ── Background processing (fire-and-forget) ───────
    const backgroundWork = (async () => {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { error: insertError } = await supabase
          .from("tweets")
          .upsert(tweetRecord, { onConflict: "tweet_id" });

        if (insertError) {
          console.error("DB insert error:", insertError);
          return;
        }

        console.log("Tweet stored:", tweetId);

        // Trigger winner detection
        await fetch(`${supabaseUrl}/functions/v1/detect-winner`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ triggered_by: "ifttt_webhook", tweet_id: tweetId }),
        }).then((r) => r.json())
          .then((r) => console.log("Winner detection:", JSON.stringify(r)))
          .catch((e) => console.error("Winner detection error:", e));
      } catch (err) {
        console.error("Background processing error:", err);
      }
    })();

    // Keep the isolate alive until background work finishes
    // deno-lint-ignore no-explicit-any
    if (typeof (globalThis as any).EdgeRuntime?.waitUntil === "function") {
      // deno-lint-ignore no-explicit-any
      (globalThis as any).EdgeRuntime.waitUntil(backgroundWork);
    }

    return response;
  } catch (error: unknown) {
    console.error("IFTTT webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
