# KhetiQ — Agmarknet 2.0 Mandi Bhav Sync Engine

Autonomous, serverless data pipeline that extracts live commodity daily prices and arrivals from the Indian Government's **Agmarknet 2.0 Portal** (`api.agmarknet.gov.in`) and synchronizes them into Supabase for **KhetiQ**.

Runs 100% free on **GitHub Actions** with AI-assisted CAPTCHA solving powered by Google's **Gemini 3.1 Flash Lite**.

---

## Architecture Overview

```
Agmarknet 2.0 API Gateway
  │ (Protected by alphanumeric CAPTCHA)
  ▼
GitHub Actions Cron Runner
  │ 1. Fetches CAPTCHA challenge
  │ 2. Solves via Gemini 3.1 Flash Lite (~2.1s)
  │ 3. Fetches priority state price & arrival data
  ▼
Supabase Database (`mandi_prices`)
  │ Upserts unique records (deduplicated by state, district, market, commodity, variety, grade, date)
  ▼
KhetiQ Web & Android App
```

---

## Sync Schedule (IST)

The workflow runs **5 times daily** at strategic APMC mandi trading checkpoints (optimized with off-peak minute offsets to ensure reliable GitHub Actions execution):

| Sync Window | UTC Cron | IST Time | APMC Phase / Purpose |
| :--- | :--- | :--- | :--- |
| **Wave 1** | `15 7 * * *` | **12:45 PM IST** | Morning auctions & early arrivals |
| **Wave 2** | `10 10 * * *` | **03:40 PM IST** | Afternoon active trading sessions |
| **Wave 3** | `48 12 * * *` | **06:18 PM IST** | Evening auction closing rates |
| **Wave 4** | `48 14 * * *` | **08:18 PM IST** | Rural night returns & consolidation |
| **Wave 5** | `48 17 * * *` | **11:18 PM IST** | Final EOD reconciliation & freeze |

---

## Covered Priority States

By default, the engine covers the core northern and central agricultural belt:
1. Madhya Pradesh (id: 19)
2. Uttar Pradesh (id: 34)
3. Rajasthan (id: 29)
4. Punjab (id: 28)
5. Haryana (id: 12)
6. Bihar (id: 5)
7. Gujarat (id: 11)
8. Maharashtra (id: 20)
9. Delhi (id: 25)

*(Any state or all 33 Indian states can be targeted on demand via manual trigger).*

---

## Repository Setup & Deployment

### 1. Create a Public GitHub Repository
Create a new public repository on GitHub (e.g., `khetiq-mandi-sync`). Public repositories receive **unlimited free GitHub Actions runner minutes**.

### 2. Configure Repository Secrets
Navigate to **Settings > Secrets and variables > Actions** in your GitHub repository and add the following 3 repository secrets:

| Secret Name | Value Description |
| :--- | :--- |
| `SUPABASE_URL` | Your Supabase project URL (`https://your-project.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase `service_role` secret key (for write/upsert access) |
| `GEMINI_API_KEY` | Google AI Studio Gemini API Key |

### 3. Push Code to GitHub
```bash
git init
git add .
git commit -m "feat: initial commit for autonomous mandi sync engine"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/khetiq-mandi-sync.git
git push -u origin main
```

---

## On-Demand Backfills & Manual Triggers

You can trigger a manual sync directly from the GitHub web UI:
1. Go to the **Actions** tab in the repository.
2. Select **Agmarknet Mandi Sync** from the left sidebar.
3. Click **Run workflow**.
4. *(Optional)* Provide inputs:
   - **Start Date:** `YYYY-MM-DD` (e.g. `2026-10-10`)
   - **End Date:** `YYYY-MM-DD` (e.g. `2026-10-11`)
   - **Specific States:** e.g. `madhya pradesh,rajasthan` or `all`
5. Click the green **Run workflow** button.

---

## Local Development & Testing

```bash
# 1. Install dependencies
npm install

# 2. Configure local environment
cp .env.example .env
# Edit .env with your keys

# 3. Test CAPTCHA solving
npm run test:captcha

# 4. Run local sync for today
npm start
```
