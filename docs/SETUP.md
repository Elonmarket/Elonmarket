# 🛠️ Project Setup & Installation

Follow these steps to set up the Elonmarket project locally for development.

## 📋 Prerequisites
- **Node.js:** v18.0.0 or higher
- **NPM:** v9.0.0 or higher
- **Supabase CLI:** [Install guide](https://supabase.com/docs/guides/cli)
- **Solana CLI:** [Install guide](https://docs.solana.com/cli/install-solana-cli-tools)

---

## 💻 Frontend Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/your-username/elonmarket.git
   cd elonmarket
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration:**
   Copy the example environment file and fill in your Supabase project details.
   ```bash
   cp .env.example .env
   ```

4. **Start Development Server:**
   ```bash
   npm run dev
   ```

---

## ⚡ Backend Setup (Supabase)

1. **Initialize Project:**
   ```bash
   supabase init
   ```

2. **Database Migrations:**
   Ensure your local or remote Supabase instance has the correct schema.
   ```bash
   supabase migration up
   ```

3. **Edge Functions Deployment:**
   Deploy the game logic and integration functions.
   ```bash
   supabase functions deploy onchain-data admin process-claim detect-winner submit-vote ifttt-webhook
   ```

4. **Required Secrets:**
   Configure the secrets for the Edge Functions.
   ```bash
   supabase secrets set VAULT_URL="<your-vault-url>"
   supabase secrets set VAULT_PASSWORD="<your-vault-api-key>"
   supabase secrets set VAULT_ADMIN_PASSWORD="<your-vault-admin-key>"
   supabase secrets set SOLANA_RPC_URL="<your-rpc-url>"
   supabase secrets set IFTTT_WEBHOOK_SECRET="<strong-random-string>"
   ```

---

## 🕵️‍♂️ Monitoring Scraper (Twitter Watcher)

The scraper runs as a background process to monitor Elon's posts.

1. **Configuration:**
   Ensure `.env` in the root has `SUPABASE_WEBHOOK_URL` and `IFTTT_WEBHOOK_SECRET`.

2. **Install PM2:**
   ```bash
   npm install pm2 -g
   ```

3. **Start Watcher:**
   ```bash
   pm2 start watcher-complete.mjs --name "elon-watcher"
   ```

4. **Monitor Logs:**
   ```bash
   pm2 logs elon-watcher
   ```

---

## 🧪 Testing the Integration

1. **Simulate a Post:**
   Send a mock JSON payload to your `ifttt-webhook` endpoint:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/ifttt-webhook 
     -H "x-webhook-secret: your-secret" 
     -d '{"text": "Tesla is awesome", "tweet_url": "https://x.com/elonmusk/status/123", "user_name": "elonmusk"}'
   ```

2. **Verify Detection:**
   Check the `detect-winner` logs in the Supabase dashboard to ensure it identifies "Tesla" as the winner and triggers the payout.
