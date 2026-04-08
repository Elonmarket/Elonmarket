# 🚀 Elonmarket: Free-to-Play Elon Prediction Market (SOL Rewards)

ca: HzRrwoMTjWbq3rqMM8J3mT6rFW1ERT5VBo5r34qopump

ElonMarket is a decentralized, free-to-play Elon prediction market where people predict what Elon Musk will post first on X among the prediction options available.

The game works by letting players vote on different topic options for Elon’s post for example Grok, Starlink, Tesla, or X. Each round collects votes from the community on which topic they believe Elon will post about first among the topics Within the prediction window.

Once Elon makes a new post, Repost or Quote Repost the system automatically monitoring all Elon activities live 24/7. The first option that matches the detected topic of the post becomes the winning choice, and everyone who voted for that option wins the round. Winners automatically receive SOL rewards directly in their wallets—no manual claims, no gas interactions, and no complex wallet connections.


**Simple. Transparent. Automated.**

![Elonmarket Banner](public/images/elonmarket-banner1.jpeg)

## 🌟 Core Features

- 🔮 **Predict Elon's X post:** Foresee the next topic in the Musk ecosystem.
- 💰 **Win SOL automatically:** Rewards are sent directly to your registered wallet.
- 🔌 **No wallet connection required:** Participate using just your username and wallet address.
- 👤 **Unified Identity:** Your Username + Wallet Address = Your Account.
- 🔐 **Token-Gated Participation:** Hold $EMARKET tokens to unlock voting eligibility.
- ⚡ **Real-Time Streaming:** Watch Elon's posts appear live via our high-speed monitoring engine.
- 🤖 **Automated Reward Engine:** Instant winner detection and distribution.
- 🏆 **Global Leaderboard:** Track your rank against the world's best predictors.
- 💎 **Sustainable Rewards:** Funded by Creator Rewards from pump.fun with auto-vault funding every 20 minutes.

---

## 📍 How It Works (Game Flow)

### 1️⃣ User Registration
Users register by submitting a **Username** and a **Solana Wallet Address**.
- No email. No password. No wallet signature.
- Your identity is tied directly to your provided wallet and chosen username.

### 2️⃣ Token Eligibility ($EMARKET Requirement)
To participate, users must hold a minimum threshold of $EMARKET tokens (e.g., 20,000 $EMARKET). Our backend verifies your on-chain balance before allowing any predictions to be placed.

### 3️⃣ Prediction Window
Each round has a specific time window (e.g., 1:00 PM – 3:00 PM UTC). Users must cast their votes before the window opens or before the **Vote Lock** period begins.

### 4️⃣ Prediction Options
Each round features curated options based on the Elon
 ecosystem:
- **Grok / AI**
- **Tesla**
- **Starlink**
- **SpaceX**
- **X / X.com**
- **Doge**
- **Gork / Grokpedia**

### 5️⃣ Real-Time Monitoring & Validation
Our dedicated scraping engine monitors Elon's X profile in real-time. A valid winning post must:
- Be authored post, qoute or reposted by Elon except replies.
- Appear within the prediction window.
- Contain an exact keyword match (e.g., "Starlink" or "@Tesla").
- Be the **first** matching option detected in the window.

### 6️⃣ Automated Distribution
Once a winner is determined:
1. The system identifies all users who voted for the winning category.
2. The reward pool (2-10% of the current vault balance) is finalized.
3. **SOL is distributed automatically** to the winner(s) via the vault.
4. No claiming or gas fees required from the user.

---

## 💎 Reward Pool & Funding
The Elonmarket vault is funded entirely by **Creator Rewards** generated from pump.fun. An automated bot runs every 20 minutes to withdraw eligible rewards and transfer them to the vault, ensuring a continuous and transparent reward cycle.

**No-Winner Rounds:** If no matching post is detected within a window, or if no one voted for the winning option, the round ends with no payout.

---

## 📊 Data-Driven Design
Elonmarket is built on extensive analysis of Elon Musk's posting behavior. Over 75% of his activity consistently revolves around his core companies (Tesla, SpaceX, X, Grok). Our prediction windows and options are strategically aligned with peak activity periods to ensure high-engagement gameplay.

---

## 🛠️ Tech Stack & Architecture

- **Frontend:** React (Vite), TypeScript, Tailwind CSS, Framer Motion.
- **Backend:** Supabase (Edge Functions, PostgreSQL, Realtime).
- **Monitoring:** Node.js Scraper with Headless Chromium & WebSocket streaming.
- **Blockchain:** Solana (Web3.js) & Custom Vault API for automated payouts.
- **Infrastructure:** Ubuntu VPS, PM2 Process Manager, Nginx.

---

## 📜 Technical Documentation

- [Project Setup & Installation](docs/SETUP.md)
- [Architecture & Game Logic](docs/PROJECT_OVERVIEW.md)
- [Supabase Configuration](docs/SUPABASE_SETUP.md)

---

![Elonmarket Mobile](public/images/elonmarket-banner2.jpeg)

## ⚖️ License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
