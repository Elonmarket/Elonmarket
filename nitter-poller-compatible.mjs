import 'dotenv/config';
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, 'seen_ids.json');
const MAX_CACHE_SIZE = 100;

const NITTER_BASE_URL = process.env.NITTER_BASE_URL;
const SUPABASE_WEBHOOK_URL = process.env.SUPABASE_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.IFTTT_WEBHOOK_SECRET || "";
// Set NITTER_INCLUDE_REPLIES=false to use default feed (excludes tweets starting with @)
const INCLUDE_REPLIES = process.env.NITTER_INCLUDE_REPLIES !== "false";
// Optional: profile username for logs (e.g. elonmusk or nipahvirus2026)
const PROFILE_USERNAME = process.env.PROFILE_USERNAME || "elonmusk";

if (!NITTER_BASE_URL || !SUPABASE_WEBHOOK_URL) {
  console.error("Missing NITTER_BASE_URL or SUPABASE_WEBHOOK_URL");
  process.exit(1);
}

/** Load processed GUIDs from file */
function loadSeenIds() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error loading seen_ids.json:", e.message);
  }
  return [];
}

/** Save a new GUID and keep the list at MAX_CACHE_SIZE */
function saveSeenId(id, seenIds) {
  try {
    if (!seenIds.includes(id)) {
      seenIds.push(id);
      // Keep only recent IDs
      if (seenIds.length > MAX_CACHE_SIZE) {
        seenIds = seenIds.slice(seenIds.length - MAX_CACHE_SIZE);
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(seenIds, null, 2));
    }
  } catch (e) {
    console.error("Error saving seen_ids.json:", e.message);
  }
  return seenIds;
}

let processedIds = loadSeenIds();

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
  return { mainText, quotedTweetText: null };
}

async function poll() {
  try {
    // Use with_replies to include tweets that start with @ (e.g. "@Tesla is working hard")
    // Default /rss excludes replies; with_replies includes them for winner detection
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
    
    // Compatible version without optional chaining
    const channel = parsed && parsed.rss && parsed.rss.channel && parsed.rss.channel[0];
    const items = (channel && channel.item) || [];

    // On first run if cache is empty, just initialize with current items to avoid flooding
    const isFirstRun = processedIds.length === 0;
    if (isFirstRun) {
        console.log("First run: Initializing cache with current feed items.");
    }

    // Process from oldest to newest
    for (const item of items.reverse()) {
      const link = (item.link && item.link[0]) || "";
      const guidObj = item.guid && item.guid[0];
      const guid = (guidObj && (guidObj._ || guidObj)) || link;
      const title = (item.title && item.title[0]) || "";
      const description = (item.description && item.description[0]) || (item["content:encoded"] && item["content:encoded"][0]) || "";
      const pubDate = (item.pubDate && item.pubDate[0]) || new Date().toISOString();

      // Check if we have already processed this GUID
      if (processedIds.includes(guid)) {
          continue;
      }

      if (isFirstRun) {
        // Just add to cache, don't send to webhook
        processedIds = saveSeenId(guid, processedIds);
        continue;
      }

      const isRt = /^RT by\s+@/i.test(title);
      const { mainText, quotedTweetText } = parseQuoteFromDescription(title, description);
      const body = {
        text: mainText,
        tweet_url: isRt ? guid : link,
        created_at: pubDate,
        user_name: "Elon Musk",
        author_username: PROFILE_USERNAME,
        tweet_type: isRt ? "repost" : (quotedTweetText ? "quote" : "post"),
      };
      if (quotedTweetText) body.quoted_tweet_text = quotedTweetText;

      const headers = { "Content-Type": "application/json" };
      if (WEBHOOK_SECRET) headers["x-webhook-secret"] = WEBHOOK_SECRET;

      console.log("Found new item:", guid);
      
      const resp = await fetch(SUPABASE_WEBHOOK_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error("Supabase webhook error:", resp.status, errorText);
        // Important: don't save to seen IDs if it failed, so we can retry
      } else {
        const preview = quotedTweetText ? `${mainText.slice(0, 40)}... [+quote]` : mainText.slice(0, 80);
        console.log("Tweet sent to Supabase:", preview);
        // Successfully processed, add to cache
        processedIds = saveSeenId(guid, processedIds);
      }
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
