import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

// Load .env from the same directory as this script (so PM2 picks it up no matter where it's started from).
// 'override: true' ensures the values in this .env win over any existing env vars set by PM2 or the shell.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env"), override: true });

const NITTER_BASE_URL = process.env.NITTER_BASE_URL;
const SUPABASE_WEBHOOK_URL = process.env.SUPABASE_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.IFTTT_WEBHOOK_SECRET || "";
// Set NITTER_INCLUDE_REPLIES=false to use default feed (excludes tweets starting with @)
const INCLUDE_REPLIES = process.env.NITTER_INCLUDE_REPLIES !== "false";

// Raw env values (for debugging issues like trailing spaces, wrong key names, etc.)
const RAW_PROFILE_ENV = process.env.PROFILE_USERNAME;
const RAW_DISPLAY_ENV = process.env.USER_DISPLAY_NAME;

// Which account to poll: RSS path and author (e.g. elonmusk or moazzammmm77)
const PROFILE_USERNAME = (RAW_PROFILE_ENV ?? "").trim() || "elonmusk";
// Display name shown in app for tweets (e.g. "Elon Musk" or "Your Name")
const USER_DISPLAY_NAME = (RAW_DISPLAY_ENV ?? "").trim() || "Elon Musk";

if (!NITTER_BASE_URL || !SUPABASE_WEBHOOK_URL) {
  console.error("Missing NITTER_BASE_URL or SUPABASE_WEBHOOK_URL");
  process.exit(1);
}

console.log("Loaded env PROFILE_USERNAME raw =", JSON.stringify(RAW_PROFILE_ENV));
console.log("Using PROFILE_USERNAME:", PROFILE_USERNAME);

let lastTweetId = null;

/** Strip HTML tags from a string. */
function stripHtml(html) {
  if (!html || typeof html !== "string") return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Extract quoted tweet text from RSS item description (Nitter may put it in a blockquote).
 * Returns { mainText, quotedTweetText } so winner detection can match both.
 */
function parseQuoteFromDescription(title, description) {
  const mainText = (title || "").trim();
  const rawDesc = description || "";
  if (!rawDesc) return { mainText, quotedTweetText: null };

  const blockquoteMatch = rawDesc.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
  if (blockquoteMatch) {
    const quotedTweetText = stripHtml(blockquoteMatch[1]).trim();
    return { mainText, quotedTweetText: quotedTweetText || null };
  }

  // If this is a pure retweet ("RT by @...") and there's no blockquote,
  // treat the full description text as the quoted tweet so keywords match.
  if (/^RT by\s+@/i.test(mainText)) {
    const fullText = stripHtml(rawDesc).trim();
    return { mainText, quotedTweetText: fullText || null };
  }

  return { mainText, quotedTweetText: null };
}

async function poll() {
  try {
    // Use with_replies to include tweets that start with @ (e.g. "@Tesla is working hard")
    const feedPath = INCLUDE_REPLIES ? `${PROFILE_USERNAME}/with_replies/rss` : `${PROFILE_USERNAME}/rss`;
    const rssUrl = `${NITTER_BASE_URL.replace(/\/$/, "")}/${feedPath}`;
    console.log("Polling RSS:", rssUrl);
    const res = await fetch(rssUrl);
    if (!res.ok) {
      console.error("Nitter RSS error:", res.status, await res.text());
      return;
    }

    const xml = await res.text();
    const parsed = await parseStringPromise(xml);

    const channel = parsed && parsed.rss && parsed.rss.channel && parsed.rss.channel[0];
    const items = (channel && channel.item) || [];

    for (const item of items.reverse()) {
      const link = (item.link && item.link[0]) || "";
      const guidObj = item.guid && item.guid[0];
      const guid = (guidObj && (guidObj._ || guidObj)) || link;
      const title = (item.title && item.title[0]) || "";
      const description = (item.description && item.description[0]) || (item["content:encoded"] && item["content:encoded"][0]) || "";
      const pubDate = (item.pubDate && item.pubDate[0]) || new Date().toISOString();

      if (lastTweetId && guid <= lastTweetId) continue;

      // Skip replies entirely: Nitter marks them as "R to @username: ..."
      if (/^R to\s+@/i.test(title)) {
        console.log("Skipping reply:", title.slice(0, 80));
        continue;
      }

      const { mainText, quotedTweetText } = parseQuoteFromDescription(title, description);
      const body = {
        text: mainText,
        tweet_url: link,
        created_at: pubDate,
        user_name: USER_DISPLAY_NAME,
        author_username: PROFILE_USERNAME,
        tweet_type: quotedTweetText ? "quote" : "post",
      };
      if (quotedTweetText) body.quoted_tweet_text = quotedTweetText;

      const headers = { "Content-Type": "application/json" };
      if (WEBHOOK_SECRET) headers["x-webhook-secret"] = WEBHOOK_SECRET;

      const resp = await fetch(SUPABASE_WEBHOOK_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error("Supabase webhook error:", resp.status, errorText);
      } else {
        const preview = quotedTweetText ? `${mainText.slice(0, 40)}... [+quote]` : mainText.slice(0, 80);
        console.log("Tweet sent to Supabase:", preview);
      }

      lastTweetId = guid;
    }
  } catch (e) {
    console.error("Poll error:", e);
  }
}

async function main() {
  console.log("Starting Nitter poller...");
  await poll();
  setInterval(poll, 10_000);
}

main();
