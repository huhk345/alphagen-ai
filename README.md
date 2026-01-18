<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AlphaGen AI Studio

AlphaGen AI Studio is an AI-native research environment for generating quantitative alpha factors and backtesting them across multiple markets, including crypto, global indices, and China A‑shares.

You can use the app to:

- Describe a trading hypothesis in natural language and let Gemini generate a factor formula.
- Automatically compile that formula into Python/Pandas factor code.
- Run a full backtest pipeline (factor calculation, signal generation, performance metrics, trade reconstruction).
- Visualize performance and trade history in a modern web UI.

View this app in AI Studio:  
https://ai.studio/apps/drive/1gBnkBSLmNM_jzHQTky9ZLbpUjz--bvA3

---

## Features

- **AI‑generated factors**
  - Convert natural-language prompts into alpha factor formulas.
  - Generate ready-to-run Python/Pandas factor code using Gemini.

- **Backtesting engine**
  - Python (FastAPI) backend with `pandas`, `numpy`, `pandas_ta`.
  - Uses `yfinance` to fetch historical price data.
  - Computes Sharpe, annualized return, volatility, max drawdown, win rate and IC.

- **Benchmark support**
  - Crypto: `BTC-USD`, `ETH-USD`
  - Indices: `S&P 500`, `CSI 300` (China A‑share index)
  - Custom A‑share single stock: input any 6‑digit A‑share code (e.g. `600519`, `000001`) as the benchmark.

- **Interactive UI**
  - Factor management (create, list, delete).
  - Performance dashboard with cumulative PnL chart and trade history.
  - Tabs for overview, original formula and generated Python code.

- **Cloud‑ready**
  - Frontend built with Vite + React.
  - Simple deployment path to Cloudflare Pages/Workers.

---

## Tech Stack

- **Frontend**
  - React + TypeScript
  - Vite
  - `lightweight-charts` for time‑series visualization

- **Backend**
  - FastAPI (Python)
  - `pandas`, `numpy`, `pandas_ta`
  - `yfinance` for market data
  - Supabase (optional) for user and backtest result storage

---

## Run Locally

### Prerequisites

- Node.js (for the Vite frontend)
- Python 3 (for the FastAPI backend and backtest engine)

### 1. Install dependencies

Frontend:

```bash
npm install
```

Backend (optional, if you want to run the Python backtest service locally):

```bash
cd server_py
pip install -r ../requirements.txt
```

### 2. Configure environment variables

Create or edit `.env.local` in the project root:

Frontend variables:

- `GEMINI_API_KEY` – API key for Gemini (factor and Python code generation).
- `VITE_API_URL` – URL of the backend API.  
  Default for local development: `http://localhost:3001/api`
- `VITE_GITHUB_CLIENT_ID` – GitHub OAuth App Client ID used by the browser.

Backend environment variables (set according to your deployment setup):

- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- `GITHUB_CLIENT_ID` – same GitHub OAuth App Client ID as above.
- `GITHUB_CLIENT_SECRET` – GitHub OAuth App Client Secret.
- `ALLOWED_EMAILS` (optional) – comma-separated whitelist of allowed email addresses.
- `PY_ENV=DEBUG` and `TEST_USER_ID` (optional) – enable a debug mode that bypasses GitHub auth when no Authorization header is present.

### 3. Start services

Frontend (Vite):

```bash
npm run dev
```

Backend (FastAPI):

```bash
uvicorn server_py.app:app --host 0.0.0.0 --port 3001 --reload
```

Open the frontend in your browser (typically `http://localhost:5173`), log in, and you can start generating factors and running backtests.

---

## Authentication (GitHub OAuth)

This app uses GitHub for authentication. Users sign in with their GitHub account; the frontend receives an access token which is then attached as a Bearer token to all backend API calls.

High-level flow:

- The frontend redirects to GitHub’s OAuth page using `VITE_GITHUB_CLIENT_ID`.
- After the user authorizes, GitHub redirects back to the frontend with a `code`.
- The frontend calls the backend endpoint `POST /auth/github/exchange` with that `code`.
- The backend exchanges the code for a GitHub access token, fetches the GitHub profile, enforces `ALLOWED_EMAILS` if configured, saves the user record to Supabase, and returns a normalized `User` object plus the access token.
- Subsequent `/api/*` requests include `Authorization: Bearer <github_access_token>`; the FastAPI middleware validates the token against GitHub on each request.

To configure GitHub OAuth locally:

- Create a GitHub OAuth App (Settings → Developer settings → OAuth Apps).
- Set the Authorization callback URL to your frontend, for example:  
  `http://localhost:3000/?github_callback=1`
- Copy the Client ID and Client Secret into `VITE_GITHUB_CLIENT_ID`, `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` as described above.

---

## Backtesting & Benchmarks

The app currently supports the following benchmarks:

- **Crypto**
  - `BTC-USD`
  - `ETH-USD`
- **Equity indices**
  - `S&P 500`
  - `CSI 300` (China A‑share blue‑chip index)
- **Custom A‑share stock**
  - Any 6‑digit A‑share code, e.g. `600519`, `000001`

### Backtest outputs

After a backtest completes, the UI shows:

- Cumulative returns: factor strategy vs benchmark.
- Metrics:
  - Sharpe ratio
  - Annualized return
  - Volatility
  - Max drawdown
  - Win rate
  - IC (Information Coefficient), when available.
- Synthetic trade list:
  - buy/sell dates, prices, quantities and amounts.

---

## Development Notes

- Frontend entry point: `App.tsx`
- Performance dashboard: `components/PerformanceDashboard.tsx`
- Shared types: `types.ts`
- Backend app: `server_py/app.py`
- Data and backtest services:
  - `server_py/data_service.py`
  - `server_py/executor.py`
  - `server_py/gemini_service.py`

Useful npm scripts:

- `npm run dev` – start the frontend dev server.
- `npm run build` – production build with Vite.
- `npm run preview` – preview the production build locally.

When you change TypeScript types or backend contracts, run `npm run build` to make sure there are no type or compile-time errors.

---

## Docker Backend (Python 3.11 with conda)

The backend can also be containerized using the provided `Dockerfile` in the project root:

- Base image: `continuumio/miniconda3`
- Python version inside the container: `3.11`
- Core dependencies: `fastapi`, `uvicorn[standard]`, `python-dotenv`, `supabase`, `google-genai`, `yfinance[full]`, `pandas`, `numpy`, `pandas_ta==0.3.14b`, `requests`

Build the image:

```bash
docker build -t alphagen-ai-server-py .
```

Run the container (make sure `.env.local` contains the backend variables described above):

```bash
docker run --env-file .env.local -p 3001:3001 alphagen-ai-server-py
```

The backend API will be available at `http://localhost:3001/api` and can be used by the Vite frontend via `VITE_API_URL`.

---

## Deploy to Cloudflare

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/huhk345/alphagen-ai)

You can use the button above to deploy this repository to Cloudflare. Cloudflare will automatically detect it as a Vite frontend project and create a Pages/Workers deployment.

### Prerequisites

- A Cloudflare account with Workers/Pages enabled.
- Wrangler CLI installed locally (optional for local preview or manual deploy):  
  `npm install -g wrangler`
- Environment variables configured in your Cloudflare project (aligned with `.env.local`):
  - Frontend → backend URL: `VITE_API_URL` (e.g. `https://your-backend-domain/api`)
  - Backend (if also on Cloudflare Workers or another environment): `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY`, etc.

### Wrangler commands (optional)

- Deploy with Wrangler: `wrangler deploy`
- Local Worker dev: `wrangler dev`
- Worker limits and quotas: https://developers.cloudflare.com/workers/platform/limits/#worker-limits
