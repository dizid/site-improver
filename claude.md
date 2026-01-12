# Site Improver - Claude Context

## Quick Start

This is an **automated lead generation and website rebuilding SaaS** that:
1. Finds local businesses with outdated websites
2. Scrapes their site and rebuilds it with modern templates
3. Deploys previews to Netlify
4. Sends cold outreach emails with before/after comparison

## Tech Stack

- **Runtime**: Node.js (ESM modules)
- **API**: Express.js + Netlify Functions (serverless)
- **Frontend**: Vue 3 + Vite (dashboard at `/dashboard`)
- **Scraping**: Firecrawl API (serverless-compatible)
- **AI**: Claude API (copy enhancement, email generation)
- **Hosting**: Netlify (previews and dashboard)
- **Email**: Resend API
- **Lead Data**: Outscraper / Google Places API

## Key Commands

```bash
npm run dev              # Start local dev server
netlify dev              # Full Netlify dev environment
npm test                 # Run Vitest test suite
```

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
   - Generate industry-specific CSS

4. AI Polish → enhanced content
   - If content is weak: generate missing headline, subheadline, testimonials
   - Polish all slots with industry-appropriate copy
   - Generate UI labels in detected language

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

## Environment Variables

| Variable | Required For | Description |
|----------|--------------|-------------|
| `FIRECRAWL_API_KEY` | Scraping | Firecrawl serverless scraping |
| `ANTHROPIC_API_KEY` | AI | Claude copy enhancement |
| `NETLIFY_AUTH_TOKEN` | Deploy | Netlify API |
| `RESEND_API_KEY` | Email | Transactional email |
| `FROM_EMAIL` | Email | Sender address |
| `OUTSCRAPER_API_KEY` | Leads | Google Maps data |
| `UNSPLASH_ACCESS_KEY` | Images | Stock photo fallback |
| `PEXELS_API_KEY` | Images | Stock photo fallback |

## Graceful Degradation

Pipeline continues even when services are unavailable:
- No `ANTHROPIC_API_KEY` → uses original text
- No `NETLIFY_AUTH_TOKEN` → builds HTML without deploying
- No image APIs → uses CSS gradients

## Testing

75 tests covering:
- Database operations (`tests/db.test.js`)
- API routes (`tests/server.test.js`)
- Template building (`tests/templateBuilder.test.js`)
- Configuration (`tests/config.test.js`)
- Utilities (`tests/utils.test.js`)
- Lead sources (`tests/leadSource.test.js`)

## Recent Features (2024-2025)

1. **Schema.org Extraction** - Parse JSON-LD for ratings, hours, reviews
2. **Enhanced Testimonial Detection** - 6 strategies including Google/Yelp widgets
3. **Template Variants** - 4 layout styles (classic, minimal, bold, elegant)
4. **Google Fonts** - 5 font pairings by industry
5. **Content Generation** - AI generates missing content when scraped content is weak
6. **Subject Line A/B Testing** - 4 email subject variants
7. **Before/After Screenshots** - Playwright captures for email embedding
8. **Email Queue System** - Approval workflow before sending

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
