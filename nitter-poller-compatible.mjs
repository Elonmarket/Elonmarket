import 'dotenv/config';
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

const NITTER_BASE_URL = process.env.NITTER_BASE_URL;
const SUPABASE_WEBHOOK_URL = process.env.SUPABASE_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.IFTTT_WEBHOOK_SECRET || "";
// Set NITTER_INCLUDE_REPLIES=false to use default feed (excludes tweets starting with @)
const INCLUDE_REPLIES = process.env.NITTER_INCLUDE_REPLIES !== "false";

if (!NITTER_BASE_URL || !SUPABASE_WEBHOOK_URL) {
  console.error("Missing NITTER_BASE_URL or SUPABASE_WEBHOOK_URL");
  process.exit(1);
}

let lastTweetId = null;

async function poll() {
  try {
    // Use with_replies to include tweets that start with @ (e.g. "@Tesla is working hard")
    // Default /rss excludes replies; with_replies includes them for winner detection
    const feedPath = INCLUDE_REPLIES ? "elonmusk/with_replies/rss" : "elonmusk/rss";
    const rssUrl = `${NITTER_BASE_URL.replace(/\/$/, "")}/${feedPath}`;
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

    for (const item of items.reverse()) {
      const link = (item.link && item.link[0]) || "";
      const guidObj = item.guid && item.guid[0];
      const guid = (guidObj && (guidObj._ || guidObj)) || link;
      const title = (item.title && item.title[0]) || "";
      const pubDate = (item.pubDate && item.pubDate[0]) || new Date().toISOString();

      if (lastTweetId && guid <= lastTweetId) continue;

      const body = {
        text: title,
        tweet_url: link,
        created_at: pubDate,
        user_name: "Elon Musk",
      };

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
        console.log("Tweet sent to Supabase:", title.slice(0, 80));
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
