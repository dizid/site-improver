# Site Improver

A tool to find businesses with outdated websites, rebuild them with modern templates, and reach out to offer the improved version.

## Quick Start

1. Start the server:
   ```bash
   npm run dev
   ```
2. Open dashboard: http://localhost:5173
3. Enter a website URL in the "Process Website" section
4. Wait ~30 seconds for the preview to deploy

## Workflow

### Single Site Demo
1. Paste any business website URL
2. Click "Transform Site"
3. Review the generated preview
4. If satisfied, approve and send the outreach email (via Emails tab)

### Batch Lead Discovery
1. Go to "Find Leads" section
2. Enter industry + location (e.g., "plumbers, Denver CO")
3. Review discovered leads in the table
4. Click "Process" on qualified leads to build previews

## Configuration

### Required API Keys (`.env` file)
```
ANTHROPIC_API_KEY=your_key     # For AI-powered content polish
NETLIFY_AUTH_TOKEN=your_token  # For deploying preview sites
```

### Optional API Keys
```
RESEND_API_KEY=your_key        # For sending outreach emails
FROM_EMAIL=you@example.com     # Sender email address
GOOGLE_PLACES_API_KEY=your_key # For lead discovery
PAGESPEED_API_KEY=your_key     # For faster site scoring
```

## Status Labels Explained

| Dashboard Label | Meaning |
|-----------------|---------|
| New Lead | Lead discovered, not yet processed |
| Ready to Process | Passed scoring, ready for pipeline |
| Analyzing Site... | Scraping website content |
| Building Preview... | Generating new site from template |
| Deploying... | Uploading to Netlify |
| Preview Ready | Live preview available |
| Email Sent | Outreach email delivered |
| Customer! | Lead converted to paying customer |
| Expired | No response, lead archived |

## Scoring System

Sites are scored 0-100 to find good improvement candidates:

| Score Range | Classification | Action |
|-------------|----------------|--------|
| < 35 | Prime Target | Significant improvement possible |
| 35-65 | Good Target | Worth pursuing |
| > 65 | Skip | Site is already decent |

**Lower scores = worse sites = better targets**

Scoring considers:
- HTTPS security (15%)
- Page load speed (20%)
- Mobile responsiveness (20%)
- Modern design indicators (25%)
- SEO basics (20%)

## Email Safety

By default, **all emails queue for approval** before sending. No emails go out automatically.

To manage emails:
1. Go to the "Emails" tab
2. Review pending emails in the Queue
3. Preview content before approving
4. Click "Approve & Send" or "Reject"

Settings in the Emails tab allow you to:
- Toggle auto-send (off by default)
- Toggle approval requirement (on by default)

## Project Structure

```
src/
  server.js          # API endpoints
  pipeline.js        # Main scrape -> build -> deploy flow
  siteScorer.js      # Browser-based site scoring
  pageSpeedScorer.js # PageSpeed API scoring
  templateBuilder.js # HTML template generation
  aiPolish.js        # AI content enhancement
  outreach.js        # Email queue management
  db.js              # JSON file database

dashboard/
  src/views/DashboardView.vue  # Main UI

templates/
  base/              # Base template components
  modern/            # Modern style variant
```

## Common Tasks

### Process a specific URL
```javascript
import { rebuildAndDeploy } from './src/pipeline.js';
const result = await rebuildAndDeploy('https://example-business.com');
console.log(result.preview); // Netlify preview URL
```

### Score a site
```javascript
import SiteScorer from './src/siteScorer.js';
const scorer = new SiteScorer();
const result = await scorer.score('https://example.com');
console.log(result.score, result.isTarget);
```

### Run batch discovery
```javascript
import { runBatch } from './src/batch.js';
await runBatch('plumbers', ['Denver, CO'], { maxLeads: 10 });
```

## Troubleshooting

### "No email found" for a lead
The scraper couldn't find an email on the site. Check the original site manually or add the email through the dashboard.

### Build fails with timeout
Some sites are slow or block scrapers. Try:
1. Check if the site loads normally in a browser
2. The site may have anti-bot protection

### Preview looks wrong
The template system works best with standard business sites. Complex web apps or sites with heavy JavaScript may not extract well.

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Run just the backend
npm run server

# Run just the dashboard
npm run dashboard
```
