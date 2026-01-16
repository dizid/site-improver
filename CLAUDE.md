# Site Improver

An automated lead generation and website rebuilding SaaS that:
1. Finds local businesses with outdated websites
2. Scrapes their site and rebuilds it with modern templates
3. Deploys previews to Netlify
4. Sends cold outreach emails with before/after comparison

## Quick Start

```bash
npm run dev              # Start local dev server (http://localhost:5173)
netlify dev              # Full Netlify dev environment
npm test                 # Run Vitest test suite
```

## Tech Stack

- **Runtime**: Node.js (ESM modules)
- **API**: Express.js + Netlify Functions (serverless)
- **Frontend**: Vue 3 + Vite (dashboard at `/dashboard`)
- **Scraping**: Firecrawl API (serverless-compatible)
- **AI**: Claude API (copy enhancement, email generation)
- **Hosting**: Netlify (previews and dashboard)
- **Email**: Resend API
- **Lead Data**: Outscraper / Google Places API

## Core Files

| File | Purpose |
|------|---------|
| `src/pipeline.js` | Main orchestration: scrape → build → polish → deploy |
| `src/scraperLite.js` | Firecrawl-based content extraction + Schema.org parsing |
| `src/templateBuilder.js` | Handlebars templates + Google Fonts + layout variants |
| `src/aiPolish.js` | Claude-powered copy enhancement + content generation |
| `src/emailGenerator.js` | Cold email generation with A/B testing |
| `src/outreach.js` | Email queue and sending logic |
| `src/db.js` | JSON/Firebase database operations |
| `src/server.js` | Express API routes |
| `src/config.js` | Configuration + feature detection |
| `src/siteScorer.js` | Browser-based site scoring |
| `src/pageSpeedScorer.js` | PageSpeed API scoring |

## Project Structure

```
src/                     # Backend source code
dashboard/src/           # Vue 3 dashboard
templates/
  base/                  # Base template components
  modern/                # Modern style variant
tests/                   # Vitest test suite
```

## Pipeline Flow

```
1. Scrape (Firecrawl) → siteData
   - Extract: identity, content, contacts, images, colors
   - Parse: Schema.org JSON-LD for ratings, hours, reviews
   - Detect: language (en, nl, de, fr, es, it)

2. Hero Image Selection → siteData.images[0]
   - Priority: og:image → extracted images → stock photo → gradient

3. Build Template → HTML
   - Detect industry from keywords
   - Select font pairing (elegant, bold, friendly, professional, modern)
   - Apply layout variant (classic, minimal, bold, elegant)

4. AI Polish → enhanced content
   - If content is weak: generate missing headline, subheadline, testimonials
   - Polish all slots with industry-appropriate copy

5. Deploy to Netlify → preview URL

6. Save to Database → deployment record
```

## Industry System

9 supported industries with custom configurations:

| Industry | Font Style | Layout Variant |
|----------|------------|----------------|
| plumber | bold | bold |
| electrician | bold | bold |
| restaurant | friendly | bold |
| lawyer | elegant | elegant |
| real-estate | professional | minimal |
| retail | friendly | classic |
| home-services | bold | classic |
| dentist | professional | minimal |
| general | modern | classic |

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

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude AI for copy enhancement |
| `NETLIFY_AUTH_TOKEN` | Yes | Netlify API for deploying previews |
| `FIRECRAWL_API_KEY` | No | Firecrawl serverless scraping |
| `RESEND_API_KEY` | No | Transactional email |
| `FROM_EMAIL` | No | Sender address |
| `GOOGLE_PLACES_API_KEY` | No | Lead discovery |
| `OUTSCRAPER_API_KEY` | No | Google Maps data |
| `PAGESPEED_API_KEY` | No | Faster site scoring |
| `UNSPLASH_ACCESS_KEY` | No | Stock photo fallback |
| `PEXELS_API_KEY` | No | Stock photo fallback |

### Graceful Degradation

Pipeline continues even when services are unavailable:
- No `ANTHROPIC_API_KEY` → uses original text
- No `NETLIFY_AUTH_TOKEN` → builds HTML without deploying
- No image APIs → uses CSS gradients

## Scoring System

Sites are scored 0-100 to find good improvement candidates:

| Score Range | Classification | Action |
|-------------|----------------|--------|
| < 35 | Prime Target | Significant improvement possible |
| 35-65 | Good Target | Worth pursuing |
| > 65 | Skip | Site is already decent |

**Lower scores = worse sites = better targets**

Scoring considers: HTTPS (15%), Page load speed (20%), Mobile responsiveness (20%), Modern design (25%), SEO basics (20%)

## Status Labels

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

## Database Schema

**Deployments** (`deployments.json` or Firebase):
```javascript
{
  siteId, siteName, original, preview,
  businessName, industry, phone, email, address, city,
  status: 'pending' | 'emailed' | 'responded' | 'converted' | 'expired',
  notes, emailId, emailSentAt, emailSubject, emailBody,
  createdAt, updatedAt
}
```

**Leads** (with status tracking):
```javascript
{
  id, url, businessName, email, phone, address,
  rating, reviewCount, industry, source,
  status: 'new' | 'processing' | 'completed' | 'failed',
  createdAt
}
```

## Email Safety

By default, **all emails queue for approval** before sending. No emails go out automatically.

To manage emails:
1. Go to the "Emails" tab
2. Review pending emails in the Queue
3. Click "Approve & Send" or "Reject"

## Common Tasks

```javascript
// Process a specific URL
import { rebuildAndDeploy } from './src/pipeline.js';
const result = await rebuildAndDeploy('https://example-business.com');
console.log(result.preview);

// Score a site
import SiteScorer from './src/siteScorer.js';
const scorer = new SiteScorer();
const result = await scorer.score('https://example.com');
console.log(result.score, result.isTarget);

// Run batch discovery
import { runBatch } from './src/batch.js';
await runBatch('plumbers', ['Denver, CO'], { maxLeads: 10 });
```

## Testing

75 tests covering:
- Database operations (`tests/db.test.js`)
- API routes (`tests/server.test.js`)
- Template building (`tests/templateBuilder.test.js`)
- Configuration (`tests/config.test.js`)
- Utilities (`tests/utils.test.js`)
- Lead sources (`tests/leadSource.test.js`)

## Code Style

- ESM modules (`import/export`)
- Async/await throughout
- Structured logging via pino (`src/logger.js`)
- Error classes with step tracking
- Configuration in `src/config.js`

## Safe to Modify

- `/src/` - All source code
- `/templates/` - HTML templates and JSON configs
- `/dashboard/src/` - Vue dashboard
- `/tests/` - Test files

## Never Modify

- `/node_modules/`
- `/.netlify/`
- `/dist/`, `/build/`
- `/.env` files (reference only)

## Troubleshooting

### "No email found" for a lead
The scraper couldn't find an email on the site. Check the original site manually or add the email through the dashboard.

### Build fails with timeout
Some sites are slow or block scrapers. Check if the site loads normally in a browser - it may have anti-bot protection.

### Preview looks wrong
The template system works best with standard business sites. Complex web apps or sites with heavy JavaScript may not extract well.
