# 🎮 Project Overview: MuskMarket Logic & Flow

This document provides a comprehensive overview of the MuskMarket game engine, automation processes, and technical architecture.

---

## 🏛️ Game Architecture

MuskMarket is designed to be a high-engagement, fully automated prediction ecosystem. The core logic is distributed across three main layers:

### 1. The Ingestion Layer (Post Monitoring)
The monitoring system runs as a persistent service (`watcher-complete.mjs`) using Puppeteer and Headless Chromium to scrape Elon Musk's X profile in real-time. 
- **WebSocket Feed:** New posts are pushed instantly to the frontend `LiveFeed`.
- **Webhook Integration:** Detected posts are forwarded to the `ifttt-webhook` Supabase Edge Function for processing.

### 2. The Validation Engine (`detect-winner`)
This is the "brain" of the game. It triggers whenever a new post is ingested or a prediction window ends.
- **Matching Logic:** Uses exact keyword and mention matching (`@Tesla`, `#SpaceX`, etc.) to identify the winning category.
- **Round Lifecycle:** Automatically transitions rounds from `Open` to `Finalized`.
- **Winner Identification:** Identifies all users who correctly predicted the topic of the first post within the window.

### 3. The Payout Engine (Automated Rewards)
MuskMarket operates on an "auto-payout" model, eliminating the need for user-triggered claims or gas fees.
- **Vault Integration:** Connects to a custom secure vault API (`64.176.63.197:8000`) for SOL distribution.
- **Individual Payouts:** The backend iterates through all winners and triggers individual `/payout` calls to the vault.
- **On-Chain Verification:** All rewards are broadcasted to the Solana network, and transaction signatures are recorded in the database.

---

## 🔁 Automated Round Lifecycle

1. **Round Creation:** The Admin creates a round, defining the prediction window and the vote lock time.
2. **Voting Phase:** Users with eligible $MUX token balances cast their predictions.
3. **Vote Locking:** A specific time before the window opens (e.g., 60 mins), voting is automatically disabled to ensure fairness.
4. **Monitoring Phase:** The system starts scanning for Elon's posts.
5. **Resolution:**
   - **Winner Found:** The first post that matches a category within the window resolves the round. SOL is distributed instantly.
   - **No Winner:** If the window ends without a match, the round is marked `no_winner` and the pool is rolled over to the next round.

---

## 💰 Economic Model (Creator Rewards)

The reward pool is sustainably funded by **Creator Rewards** from pump.fun.
- **Auto-Funding Bot:** Runs every 10 minutes to withdraw rewards from the source and fund the MuskMarket vault.
- **Distribution Rule:** A configurable percentage (default 15%) of the **current** vault balance is distributed as rewards for each successful round.

---

## 📊 Technical Security

- **Server-Side Verification:** Token balances are verified on-chain at the moment of voting, not just in the UI.
- **Duplicate Prevention:** RLS policies and unique constraints prevent users from voting multiple times or bypassing registration requirements.
- **Vault Integrity:** The payout engine includes a robust fallback to Solana RPC nodes to ensure the vault balance is always accurately reported even if the primary API is under maintenance.
