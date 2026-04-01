import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import { createClient } from "@supabase/supabase-js";

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

// ── Supabase client for live logging ──
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let sb = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  console.log("✅ Live logging enabled (poller_logs table)");
} else {
  console.warn("⚠️ Live logging disabled — missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

/** Insert a log entry into poller_logs (fire-and-forget). */
async function log(level, message) {
  console.log(`[${level.toUpperCase()}] ${message}`);
  if (!sb) return;
  try {
    await sb.from("poller_logs").insert({ level, message });
  } catch (e) {
    // Silently ignore logging errors so they don't break polling
  }
}

if (!NITTER_BASE_URL || !SUPABASE_WEBHOOK_URL) {
  console.error("Missing NITTER_BASE_URL or SUPABASE_WEBHOOK_URL");
  process.exit(1);
}

console.log("Loaded env PROFILE_USERNAME raw =", JSON.stringify(RAW_PROFILE_ENV));
console.log("Using PROFILE_USERNAME:", PROFILE_USERNAME);

let lastTweetId = null;

/** Strip the "RT by @username: " prefix from tweet text. */
function stripRtPrefix(text) {
  return (text || "").replace(/^RT by\s+@\w+:\s*/i, "").trim().toLowerCase();
}

/** Strip HTML tags from a string. */
function stripHtml(html) {
  if (!html || typeof html !== "string") return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Extract images from HTML string.
 * Returns first two image URLs (usually avatar and first media).
 */
function extractImagesFromHtml(html) {
  if (!html) return [];
  const imgRegex = /<img[^>]+src="([^">]+)"/gi;
  const urls = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

/**
 * Extract quoted tweet text from RSS item description (Nitter may put it in a blockquote).
 * Returns { mainText, quotedTweetText, quotedAuthorName, quotedAuthorUsername, quotedAuthorAvatar, mediaUrl }
 */
function parseQuoteFromDescription(title, description) {
  const mainText = (title || "").trim();
  const rawDesc = description || "";
  const images = extractImagesFromHtml(rawDesc);
  
  // Default values
  let result = { 
    mainText, 
    quotedTweetText: null,
    quotedAuthorName: null,
    quotedAuthorUsername: null,
    quotedAuthorAvatar: images[0] || null,
    mediaUrl: images[1] || null 
  };

  if (!rawDesc) return result;

  const blockquoteMatch = rawDesc.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
  if (blockquoteMatch) {
    const rawQuote = blockquoteMatch[1];
    result.quotedTweetText = stripHtml(rawQuote).trim();
    
    // Try to extract author from blockquote if available
    // Nitter often has <b>Author Name (@username)</b> inside blockquote
    const authorMatch = rawQuote.match(/<b>([^<]+)\s+\((@\w+)\)<\/b>/i);
    if (authorMatch) {
      result.quotedAuthorName = authorMatch[1].trim();
      result.quotedAuthorUsername = authorMatch[2].trim().replace("@", "");
    }
    return result;
  }

  // If this is a pure retweet ("RT by @...") and there's no blockquote,
  // treat the full description text as the quoted tweet so keywords match.
  if (/^RT by\s+@/i.test(mainText)) {
    const fullText = stripHtml(rawDesc).trim();
    
    // Extract author from "Name (@handle): text" pattern
    const authorPattern = /^([^(@]+)\s+\((@\w+)\):\s*(.*)$/s;
    const authorMatch = fullText.match(authorPattern);
    
    if (authorMatch) {
      result.quotedAuthorName = authorMatch[1].trim();
      result.quotedAuthorUsername = authorMatch[2].trim().replace("@", "");
      result.quotedTweetText = authorMatch[3].trim();
    } else {
      result.quotedTweetText = fullText || null;
    }
  }

  return result;
}

async function poll() {
  try {
    // Use with_replies to include tweets that start with @ (e.g. "@Tesla is working hard")
    const feedPath = INCLUDE_REPLIES ? `${PROFILE_USERNAME}/with_replies/rss` : `${PROFILE_USERNAME}/rss`;
    const rssUrl = `${NITTER_BASE_URL.replace(/\/$/, "")}/${feedPath}`;
    await log("poll", `Polling RSS: ${rssUrl}`);
    const res = await fetch(rssUrl);
    if (!res.ok) {
      const errText = await res.text();
      await log("error", `RSS error ${res.status}: ${errText.slice(0, 120)}`);
      return;
    }

    const xml = await res.text();
    const parsed = await parseStringPromise(xml);

    const channel = parsed && parsed.rss && parsed.rss.channel && parsed.rss.channel[0];
    const items = (channel && channel.item) || [];

    if (items.length === 0) {
      await log("info", "No items in RSS feed");
    }

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
        await log("skip", `Reply skipped: ${title.slice(0, 60)}`);
        continue;
      }

      

      const isRt = /^RT by\s+@/i.test(title);
      const { 
        mainText, 
        quotedTweetText, 
        quotedAuthorName, 
        quotedAuthorUsername, 
        quotedAuthorAvatar, 
        mediaUrl 
      } = parseQuoteFromDescription(title, description);

      const body = {
        text: mainText,
        tweet_url: isRt ? guid : link,
        created_at: pubDate,
        user_name: USER_DISPLAY_NAME,
        author_username: PROFILE_USERNAME,
        tweet_type: isRt ? "repost" : (quotedTweetText ? "quote" : "post"),
      };
      if (quotedTweetText) body.quoted_tweet_text = quotedTweetText;
      if (quotedAuthorName) body.quoted_author_name = quotedAuthorName;
      if (quotedAuthorUsername) body.quoted_author_username = quotedAuthorUsername;
      if (quotedAuthorAvatar) body.quoted_author_avatar = quotedAuthorAvatar;
      if (mediaUrl) body.media_url = mediaUrl;

      const headers = { "Content-Type": "application/json" };
      if (WEBHOOK_SECRET) headers["x-webhook-secret"] = WEBHOOK_SECRET;

      const tweetTypeLabel = isRt ? "repost" : (quotedTweetText ? "quote" : "post");
      await log(tweetTypeLabel, `New ${tweetTypeLabel} detected: ${mainText.slice(0, 80)}`);

      const resp = await fetch(SUPABASE_WEBHOOK_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        await log("error", `Webhook error ${resp.status}: ${errorText.slice(0, 120)}`);
      } else {
        const preview = quotedTweetText ? `${mainText.slice(0, 40)}... [+quote]` : mainText.slice(0, 80);
        await log("success", `Sent to backend: ${preview}`);
        
      }

      lastTweetId = guid;
    }
  } catch (e) {
    await log("error", `Poll error: ${e.message || e}`);
  }
}

async function main() {
  await log("info", `Poller started — monitoring @${PROFILE_USERNAME} every 10s`);
  await poll();
  setInterval(poll, 10_000);
}

main();
