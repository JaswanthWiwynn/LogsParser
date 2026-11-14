# Logs Parser

Upload an Excel or CSV export. Rows where result is failed are opened from the errorlink column, then packed into one downloadable text file.

No database required. Log fetching uses `/api/fetch-log` (Vite middleware locally, Vercel serverless in production).

## Local

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:5173/

## Deploy on Vercel

1. Push this repo to GitHub (already: `JaswanthWiwynn/LogsParser`).
2. Go to [vercel.com/new](https://vercel.com/new) and import that repo.
3. Framework preset: **Vite** (or leave auto-detect).
4. Build command: `npm run build`
5. Output directory: `dist`
6. Click **Deploy**.
7. Open the `*.vercel.app` URL and upload a spreadsheet — log fetch should work there (unlike GitHub Pages).

Optional CLI:

```powershell
npm i -g vercel
vercel login
vercel
vercel --prod
```
