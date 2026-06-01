# Profile Job Hunter

This repository is an autonomous job application assistant for Clinton Oremo, built in Node.js.
It crawls job listings, scores them against a profile, drafts application assets, and can dispatch applications via email or simulation.

## What it does

- Crawls jobs from WeWorkRemotely, Remotive, and SerpAPI-powered LinkedIn-style search when `SERPAPI_KEY` is configured
- Deduplicates applications using `applications/history.json`
- Scores job listings using an improved keyword, title, and location relevance engine
- Drafts tailored cover letters and HTML CVs
- Supports AI-powered CV and cover letter generation via OpenAI
- Exposes a live dashboard at `/dashboard.html`
- Provides a backend control API for scanning, history, and application automation

## Install

```bash
cd c:\Users\afric\Documents\Projects\Profile
npm install
```

## Run

Start the backend server:

```bash
npm start
```

Open the live dashboard locally at:

- `http://localhost:3002/dashboard.html`

## Scripts

- `npm start` — run the Express backend server
- `npm run dev` — run a static HTTP server with `http-server`
- `npm run dashboard` — run `autonomous_hunter.js --dashboard`
- `npm run hunt` — run the core job hunter script
- `npm run lint` — run ESLint across the repository
- `npm run test` — run unit tests with Jest

## Environment variables

Create a `.env` file to configure email, AI, and search providers:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_NAME="Clinton Oremo Ouma"
RECIPIENT_EMAIL=clintoniremo@gmail.com
ALERT_EMAIL=clintoniremo@gmail.com
SERPAPI_KEY=your-serpapi-key
OPENAI_API_KEY=your-openai-key
ANALYTHROPIC_API_KEY=your-anthropic-key
CRON_TOKEN=your-cron-token
```

## Notes

- `nodemailer` is installed and can dispatch email if SMTP credentials are configured.
- `openai` is installed and enables AI doc generation when `OPENAI_API_KEY` is set.
- `puppeteer` is not included by default to avoid browser download issues; install it manually for HTML-to-PDF CV compilation.

## Project structure

- `server.js` — Express API and route management
- `autonomous_hunter.js` — crawler, scoring, document generation, and email dispatch logic
- `auto_apply.js` — auto-apply helper for scheduled runs
- `ai_providers/` — AI helpers for OpenAI-driven document generation
- `applications/` — stored application history and generated artifacts
- `uploads/` — uploaded CV and cover letter files
- `dashboard.html` — live local UI for status and job monitoring

## Validation

The backend now supports a live dashboard, improved scoring, real SerpAPI-backed LinkedIn search when configured, and AI doc generation.
Start the server and visit `http://localhost:3002/dashboard.html` to use the interface.
