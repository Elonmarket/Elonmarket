# Supabase setup – Elon Prediction Game

Use this guide to get the **new** Supabase project ready so the game logic works end-to-end.

---

## 1. Create project and get credentials

1. Go to [supabase.com](https://supabase.com) and open the project you created (or create one).
2. In **Project Settings → API** note:
   - **Project URL** → you’ll use as `VITE_SUPABASE_URL`
   - **anon public** key → you’ll use as `VITE_SUPABASE_PUBLISHABLE_KEY`
3. In **Project Settings → API** under "Project API keys" copy the **service_role** key (keep it secret). You’ll use it for Edge Function secrets and running migrations if needed.

---

## 2. Run database migrations

All tables and policies are in `supabase/migrations/`. Run them in order.

**Option A – Supabase CLI (recommended)**

```bash
# Install Supabase CLI if needed: npm i -g supabase
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF   # from project URL: https://app.supabase.com/project/YOUR_PROJECT_REF
npx supabase db push
```

**Option B – SQL Editor in dashboard**

1. In Supabase dashboard go to **SQL Editor**.
2. Run each migration file in **date order** (oldest first):
   - `20260204043121_bb767884-f0bb-4764-8855-e938ab1947eb.sql`
   - `20260205010957_5cfc7c6f-8c5e-4279-884d-edf5520948e5.sql`
   - `20260205061508_ff3cd61d-bddd-42b7-ae96-9695c679cb63.sql`
   - `20260205061556_72d59a9d-2817-49df-b527-f1a78e6c2fc4.sql`
   - `20260205063852_9e445776-1b1b-4142-9ccf-fad00ce79791.sql`
   - `20260208134910_7bfd37da-1e20-4f98-8884-0dcaa27a3bf4.sql`
   - `20260209034530_2459171a-30b0-45f5-b7f9-5f69815f434d.sql`
   - `20260212000000_game_logic_schema.sql`

The last one adds `cooldown` status, `cooldown_end_time`, and the `game_config` table used by the admin panel.

---

## 3. Frontend environment variables

In the app repo create or edit `.env` (and `.env.local` if you use it):

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_public_key_here
```

Restart the dev server after changing env vars.

---

## 4. Deploy Edge Functions and set secrets

**Deploy functions**

```bash
npx supabase functions deploy admin
npx supabase functions deploy submit-vote
npx supabase functions deploy detect-winner
npx supabase functions deploy ifttt-webhook
npx supabase functions deploy verify-token-balance
npx supabase functions deploy process-claim
npx supabase functions deploy refill-payout
npx supabase functions deploy onchain-data
```

Or deploy all:

```bash
npx supabase functions deploy
```

**Set secrets** (Supabase dashboard: **Project Settings → Edge Functions → Secrets**, or CLI):

| Secret | Required | Description |
|--------|----------|-------------|
| `ADMIN_SECRET_KEY` | **Yes** | Password for admin panel login (use a strong random string). |
| `IFTTT_WEBHOOK_SECRET` | Optional | If set, IFTTT must send this in header `x-webhook-secret` or query `?secret=...`. |
| `SOLANA_RPC_URL` | Optional | RPC for token checks (default: `https://api.mainnet-beta.solana.com`). |
| `VAULT_URL` | Optional | Reward vault API base URL (for payouts). |
| `VAULT_PASSWORD` | Optional | Sent as `x-vault-password` to vault. |

CLI example:

```bash
npx supabase secrets set ADMIN_SECRET_KEY=your_strong_secret_here
npx supabase secrets set IFTTT_WEBHOOK_SECRET=your_secret_if_you_use_it
```

---

## 5. Admin panel access

- URL: `https://your-app.com/admin` (or `http://localhost:5173/admin` in dev).
- Log in with the **same value** you set for `ADMIN_SECRET_KEY`.

---

## 6. Wallet / token configuration (admin panel)

After logging in, open the **Wallets** tab and set:

- **Vault wallet address** – SOL vault for the game.
- **Payout wallet address** – where payouts go.
- **Token contract address** – mint address of the token that must be held to vote (leave empty or set to a dummy to allow everyone for testing).
- **Min token balance** – minimum tokens required to vote (e.g. `1`).
- **Payout percentage** – e.g. `20` (percent of vault per round to winners).

Save. The app uses this for token checks and reward math.

---

## 7. Optional: cron for automatic winner detection

Winner detection runs when:

- A new tweet is received (IFTTT webhook calls `detect-winner`), or  
- Someone clicks **Check winner** in the admin panel.

If the prediction **window ends** and no new tweet arrives, the round will not move to cooldown/finalized until something calls `detect-winner` again. To make that automatic:

**Option A – External cron (e.g. cron-job.org)**

1. Create a free account at [cron-job.org](https://cron-job.org).
2. New cron job:
   - **URL:** `https://YOUR_PROJECT_REF.supabase.co/functions/v1/detect-winner`
   - **Method:** POST
   - **Headers:** `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`, `x-admin-key: YOUR_ADMIN_SECRET_KEY`, and `Content-Type: application/json`
   - **Note:** The anon key is NOT accepted. Use either `service_role` token or `x-admin-key` header.
   - **Schedule:** Every 2 minutes (`*/2 * * * *`).

**Option B – Supabase pg_cron (if enabled)**

If your project has `pg_cron` and `pg_net` enabled, you can schedule an HTTP request to the same URL from the database. Setup depends on your Supabase plan.

---

## 8. IFTTT webhook (for live tweets)

To receive Elon’s tweets during the prediction window:

1. In IFTTT create an applet: “If new tweet by @elonmusk → Make a web request”.
2. **Web request URL:**  
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/ifttt-webhook`  
   If you set `IFTTT_WEBHOOK_SECRET`, add: `?secret=YOUR_SECRET` or send header `x-webhook-secret: YOUR_SECRET`.
3. **Method:** POST.  
4. **Body:** JSON with at least `text`, `created_at`, and optionally `tweet_url`, `user_name`, `in_reply_to_status_id` (to skip replies).

Each received tweet is stored and triggers winner detection.

---

## 9. Quick test flow

1. **Admin:** Set Wallets (token contract + min balance for testing), then open **Rounds**.
2. **Game settings:** Add default options (e.g. Grok, Tesla), Save.
3. **Create round:** Set question, prediction window (start/end UTC), vote lock minutes, then “Create Round & Open Voting”.
4. **Frontend:** Connect wallet (with enough tokens), pick an option, Submit. Refresh – you should still see “Vote submitted” (hasVoted from DB).
5. **Simulate tweet:** Either use IFTTT with a test tweet, or insert a row into `tweets` in Table Editor with `text` containing one option (e.g. “Grok”), `created_at_twitter` in the round’s window, `tweet_type: post`, `author_id: 44096397`, then click **Check winner** in admin.
6. **Cron:** If you set up the 2‑minute cron, leave a round past its end time and confirm it moves to cooldown then finalized/no_winner without clicking Check winner.

---

## 10. Summary checklist

- [ ] Supabase project created and URL + anon key in `.env`
- [ ] All migrations run (including `20260212000000_game_logic_schema.sql`)
- [ ] Edge Functions deployed
- [ ] `ADMIN_SECRET_KEY` set and used to log in at `/admin`
- [ ] Wallet settings filled in (Wallets tab)
- [ ] Optional: cron every intnt to `detect-winner`
- [ ] Optional: IFTTT webhook pointing to `ifttt-webhook` URL

After this, game logic (rounds, voting, vote lock, winner detection, hasVoted on refresh) is ready. Nitter and reward pool can be added next.
