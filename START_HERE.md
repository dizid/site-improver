# Site Improver - Quick Start

## Setup (2 minutes)

```bash
npm install
```

## Run Locally

```bash
npm start
# Open http://localhost:3000
```

## Use the Dashboard

1. **Add a lead**: Paste any business website URL in the "Add Lead" form
2. **Wait**: Pipeline scrapes, rebuilds, and deploys (~30 seconds)
3. **View preview**: Click the preview link to see the rebuilt site
4. **Send email**: Click "Send Email" to outreach the business owner

## Deploy to Netlify (optional)

```bash
netlify deploy --prod
```

Set these environment variables in Netlify Dashboard:
- `ANTHROPIC_API_KEY`
- `NETLIFY_AUTH_TOKEN`
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `FIRECRAWL_API_KEY`

## CLI Commands

| Command | What it does |
|---------|--------------|
| `npm start` | Start dashboard |
| `npm run pipeline <url>` | Process single site |
| `npm run batch plumber -- -l "Denver, CO"` | Find & process leads |
| `npm test` | Run tests |

## Files

- `.env` - Your API keys (already configured)
- `deployments.json` - Your leads database
- `dashboard/` - React dashboard
- `src/` - Core pipeline code

## Clear Sample Data

```bash
echo "[]" > deployments.json
```

Then add real leads via dashboard or CLI.
