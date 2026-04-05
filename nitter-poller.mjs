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

/** Strip the "RT by @username: " or "RT @username: " prefix from tweet text. */
function stripRtPrefix(text) {
  return (text || "").replace(/^RT\s+(by\s+)?@\w+:\s*/i, "").trim();
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
 * Extract the profile avatar URL from Nitter HTML.
 * Nitter puts profile pics as small <img> inside <a> tags linking to the user profile.
 * Media images are usually larger or inside different containers.
 */
function extractAvatarFromHtml(html) {
  if (!html) return null;
  // Look for profile pic pattern: <a href="/username"><img src="...pic/profile_images..." /></a>
  const avatarMatch = html.match(/<a[^>]+href="\/[^"]+"><img[^>]+src="([^"]+pic\/profile_images[^"]+)"/i);
  if (avatarMatch) return avatarMatch[1];
  // Fallback: look for any pic/profile_images URL
  const profilePicMatch = html.match(/src="([^"]*pic\/profile_images[^"]*)"/i);
  if (profilePicMatch) return profilePicMatch[1];
  return null;
}

/**
 * Extract media images from Nitter HTML (excluding profile avatars).
 * Returns the first media image URL found.
 */
function extractMediaFromHtml(html) {
  if (!html) return null;
  const images = extractImagesFromHtml(html);
  // Filter out profile images — media images typically contain pic/media, pic/tweet_video, pic/amplify
  for (const url of images) {
    if (/pic\/(media|tweet_video|amplify|ext_tw)/i.test(url)) return url;
  }
  // Fallback: return first non-profile image
  for (const url of images) {
    if (!/pic\/profile_images/i.test(url)) return url;
  }
  return null;
}

/**
 * Extract author info from Nitter HTML description.
 * Nitter formats: <b>Display Name</b> or links to /@username
 */
function extractAuthorFromHtml(html) {
  if (!html) return { name: null, username: null };

  // Pattern 1: <a href="/@username">@username</a>
  const usernameMatch = html.match(/<a[^>]+href="\/@([^"]+)"[^>]*>/i);
  // Pattern 2: <b>Display Name</b>
  const nameMatch = html.match(/<b>([^<]+)<\/b>/i);
  // Pattern 3: "Display Name (@username)" in bold
  const combinedMatch = html.match(/<b>([^<]+)\s*\(@(\w+)\)<\/b>/i);

  if (combinedMatch) {
    return { name: combinedMatch[1].trim(), username: combinedMatch[2].trim() };
  }

  return {
    name: nameMatch ? nameMatch[1].trim() : null,
    username: usernameMatch ? usernameMatch[1].trim() : null,
  };
}

/**
 * Extract quoted tweet text from RSS item description (Nitter may put it in a blockquote).
 * Returns { mainText, quotedTweetText, quotedAuthorName, quotedAuthorUsername, quotedAuthorAvatar, mediaUrl }
 */
function parseQuoteFromDescription(title, description) {
  const mainText = (title || "").trim();
  const rawDesc = description || "";

  // Default values
  let result = {
    mainText,
    quotedTweetText: null,
    quotedAuthorName: null,
    quotedAuthorUsername: null,
    quotedAuthorAvatar: extractAvatarFromHtml(rawDesc),
    mediaUrl: extractMediaFromHtml(rawDesc)
  };

  if (!rawDesc) return result;

  const blockquoteMatch = rawDesc.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
  if (blockquoteMatch) {
    const rawQuote = blockquoteMatch[1];
    result.quotedTweetText = stripHtml(rawQuote).trim();

    // Extract author from blockquote HTML
    const authorMatch = rawQuote.match(/<b>([^<]+)\s+\((@\w+)\)<\/b>/i);
    if (authorMatch) {
      result.quotedAuthorName = authorMatch[1].trim();
      result.quotedAuthorUsername = authorMatch[2].trim().replace("@", "");
    } else {
      // Try extracting from the HTML structure
      const htmlAuthor = extractAuthorFromHtml(rawQuote);
      if (htmlAuthor.name) result.quotedAuthorName = htmlAuthor.name;
      if (htmlAuthor.username) result.quotedAuthorUsername = htmlAuthor.username;
    }
    // Get avatar from blockquote specifically if available
    const quoteAvatar = extractAvatarFromHtml(rawQuote);
    if (quoteAvatar) result.quotedAuthorAvatar = quoteAvatar;
    return result;
  }

  // If this is a pure retweet ("RT by @...") and there's no blockquote,
  // treat the full description text as the quoted tweet so keywords match.
  if (/^RT by\s+@/i.test(mainText)) {
    const fullText = stripHtml(rawDesc).trim();

    // Try multiple patterns for author extraction
    // Pattern 1: "Name (@handle): text"
    const authorPattern1 = /^([^(@]+)\s+\((@\w+)\):\s*(.*)$/s;
    // Pattern 2: "Name (@handle)\ntext" (newline instead of colon)
    const authorPattern2 = /^([^(@\n]+)\s+\((@\w+)\)\s*\n(.*)$/s;

    const match1 = fullText.match(authorPattern1);
    const match2 = fullText.match(authorPattern2);
    const authorMatch = match1 || match2;

    if (authorMatch) {
      result.quotedAuthorName = authorMatch[1].trim();
      result.quotedAuthorUsername = authorMatch[2].trim().replace("@", "");
      result.quotedTweetText = authorMatch[3].trim();
    } else {
      // Try extracting author from the HTML structure
      const htmlAuthor = extractAuthorFromHtml(rawDesc);
      if (htmlAuthor.name) result.quotedAuthorName = htmlAuthor.name;
      if (htmlAuthor.username) result.quotedAuthorUsername = htmlAuthor.username;
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

      

      // Detect repost: Nitter uses "RT by @username: ..." in title
      const isRt = /^RT\s+(by\s+)?@/i.test(title);
      const {
        mainText: rawMainText,
        quotedTweetText,
        quotedAuthorName,
        quotedAuthorUsername,
        quotedAuthorAvatar,
        mediaUrl
      } = parseQuoteFromDescription(title, description);

      // For reposts, extract original author from the Nitter link URL
      // Link format: http://nitter.instance/OriginalAuthor/status/123456#m
      let repostOriginalUsername = quotedAuthorUsername;
      let repostOriginalName = quotedAuthorName;
      if (isRt && !repostOriginalUsername) {
        const linkAuthorMatch = link.match(/\/([^\/]+)\/status\/\d+/);
        if (linkAuthorMatch) {
          repostOriginalUsername = linkAuthorMatch[1];
          // Use the username as display name if we don't have the real name
          if (!repostOriginalName) repostOriginalName = linkAuthorMatch[1];
        }
      }

      // For reposts, strip the RT prefix from mainText so we get clean content
      const mainText = isRt ? stripRtPrefix(rawMainText) || rawMainText : rawMainText;

      // For reposts without a quotedTweetText, extract the actual content from description
      let finalQuotedText = quotedTweetText;
      if (isRt && !finalQuotedText) {
        const descText = stripHtml(description).trim();
        if (descText) finalQuotedText = descText;
      }

      // For reposts, strip the "Name (@username):" prefix from quoted text if we extracted author separately
      if (isRt && finalQuotedText && repostOriginalUsername) {
        finalQuotedText = finalQuotedText.replace(/^[^(@\n]{0,80}\(@\w+\)\s*:?\s*/u, "").trim() || finalQuotedText;
      }

      const body = {
        text: mainText,
        // For reposts, use link (has original author in URL path) instead of guid (bare number)
        tweet_url: link,
        // For reposts, use current time (when repost was detected) so they appear
        // at the top of the feed, not buried at the original post's time.
        created_at: isRt ? new Date().toISOString() : pubDate,
        user_name: USER_DISPLAY_NAME,
        author_username: PROFILE_USERNAME,
        tweet_type: isRt ? "repost" : (quotedTweetText ? "quote" : "post"),
      };
      if (finalQuotedText) body.quoted_tweet_text = finalQuotedText;
      if (repostOriginalName) body.quoted_author_name = repostOriginalName;
      if (repostOriginalUsername) body.quoted_author_username = repostOriginalUsername;
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
