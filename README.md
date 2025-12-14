# Site Improver

Automated website rebuilding and cold outreach pipeline. Find businesses with bad websites, rebuild them with modern templates, deploy previews, and send personalized outreach emails offering to sell them the upgrade for $1,000.

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Installation](#installation)
- [Configuration](#configuration)
- [User Guide](#user-guide)
  - [Finding Leads](#finding-leads)
  - [Scoring Sites](#scoring-sites)
  - [Batch Processing](#batch-processing)
  - [Single Site Pipeline](#single-site-pipeline)
  - [Dashboard](#dashboard)
  - [Email Sequences](#email-sequences)
- [CLI Reference](#cli-reference)
- [Testing](#testing)
- [API Reference](#api-reference)
- [Technical Architecture](#technical-architecture)
- [Module Reference](#module-reference)
- [Template System](#template-system)
- [Costs](#costs)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Deployment](#deployment)

---

## Overview

### The Business Model

1. Find local businesses with outdated websites
2. Automatically rebuild their site with a modern template
3. Deploy a live preview they can see
4. Email them with the preview link
5. Offer to make it live for $1,000

### Key Features

| Feature | Description |
|---------|-------------|
| **Lead Finding** | Search Google Maps for businesses by industry + location |
| **Site Scoring** | Automatically score website quality (0-100) to find best targets |
| **Auto Rebuild** | Scrape content, apply modern template, polish with AI |
| **One-Click Deploy** | Deploy preview to Netlify with unique URL |
| **AI Outreach** | Generate personalized cold emails with Claude |
| **Follow-up Sequence** | Automated 4-email sequence over 14 days |
| **Dashboard** | Web UI to manage leads and track conversions |

---

## How It Works

### The Pipeline

```
[Search: "plumber" + "Denver, CO"]
        ↓
[Lead Finder] → Google Maps API → List of businesses with websites
        ↓
[Site Scorer] → Quick quality check (HTTPS, mobile, speed, design)
        ↓
[Filter] → Only sites scoring < 60/100
        ↓
[Scraper] → Extract content, images, colors, contact info
        ↓
[Classifier] → Detect industry (restaurant, lawyer, plumber, etc.)
        ↓
[Template Builder] → Map content to modern industry template
        ↓
[AI Polish] → Claude improves headlines, CTAs, descriptions
        ↓
[Netlify Deploy] → Push to unique preview URL
        ↓
[Email Generator] → AI-written personalized outreach
        ↓
[Send] → Deliver via Resend
        ↓
[Follow-up Sequence] → Day 3, 7, 12 automated follow-ups
```

### Site Scoring Criteria

| Factor | Weight | What It Checks |
|--------|--------|----------------|
| HTTPS | 15% | Valid SSL certificate |
| Speed | 20% | Page load time (<2s = 100, >10s = 0) |
| Mobile | 20% | Has viewport meta tag |
| Modern Design | 25% | Flexbox/Grid, modern fonts, transitions, no table layouts |
| SEO | 20% | Title, meta description, H1, structured data |

**Target Thresholds:**
- **0-40**: Prime target (outdated, slow, broken)
- **40-60**: Good target (multiple issues)
- **60-80**: Weak target (mostly decent)
- **80-100**: Skip (modern site)

---

## Installation

### Prerequisites

- Node.js 18+
- Git

### Setup

```bash
# Clone or extract the project
git clone https://github.com/dizid/site-improver.git
cd site-improver

# Install dependencies
npm install

# Install Playwright browser
npx playwright install chromium

# Copy environment template
cp .env.example .env

# Edit .env with your API keys (see Configuration below)
```

### Quick Test

```bash
# Start the dashboard
npm start
# Open http://localhost:3000

# Or test the CLI
npm run score https://example.com
```

---

## Configuration

### Required API Keys

Edit your `.env` file:

```bash
# Claude API - for AI polish and email generation
# Get at: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-...

# Netlify - for deploying preview sites
# Get at: https://app.netlify.com/user/applications#personal-access-tokens
NETLIFY_AUTH_TOKEN=your-netlify-token

# Resend - for sending emails
# Get at: https://resend.com/api-keys
RESEND_API_KEY=re_...
FROM_EMAIL=you@yourdomain.com

# Outscraper - for finding leads via Google Maps
# Get at: https://outscraper.com/
OUTSCRAPER_API_KEY=your-outscraper-key

# Server port (optional)
PORT=3000
```

### Email Domain Setup

For best deliverability:

1. Use a custom domain (not Gmail)
2. Set up SPF, DKIM, and DMARC records
3. Verify domain in Resend dashboard
4. Warm up by sending to friends first
5. Start with 20-30 emails/day

---

## User Guide

### Finding Leads

Search Google Maps for businesses by industry and location:

```bash
# Basic search
npm run find plumber -- -l "Denver, CO"

# More results
npm run find plumber -- -l "Denver, CO" -n 50

# Save to file
npm run find restaurant -- -l "Austin, TX" -n 30 -o leads.json
```

**Output:**
```
🔍 Searching for "plumber" in Denver, CO...

✅ Found 20 businesses:

Bob's Plumbing
   Website: https://bobs-plumbing.com
   Phone:   (555) 123-4567
   Rating:  4.2 (87 reviews)

Quick Drain Services
   Website: https://quickdrain.net
   Phone:   (555) 234-5678
   Rating:  4.5 (142 reviews)
...
```

### Scoring Sites

Check website quality before investing in rebuild:

```bash
# Score single site
npm run score https://bobs-plumbing.com

# Score multiple sites
npm run score https://site1.com https://site2.com https://site3.com
```

**Output:**
```
https://bobs-plumbing.com
   Score: 31/100 (prime_target)
   - HTTPS: 0
   - Speed: 40 (3200ms)
   - Mobile: 0
   - Modern: 35
   - SEO: 40
   Issues: No HTTPS, Not mobile responsive, Slow load
   Target: ✅ Yes
```

### Batch Processing

The main automation command - find, score, filter, and process leads:

```bash
# Full batch: find → score → deploy → email
npm run batch plumber -- -l "Denver, CO" -m 10

# Multiple locations
npm run batch plumber -- -l "Denver, CO, Austin, TX, Phoenix, AZ" -m 20

# Dry run (find and score only, no deploy/email)
npm run batch electrician -- -l "Phoenix, AZ" --dry-run

# Skip emails (deploy only)
npm run batch hvac -- -l "Miami, FL" -m 5 --no-email

# Custom score threshold
npm run batch lawyer -- -l "Chicago, IL" --max-score 50
```

**Options:**
- `-l, --locations`: Comma-separated list of cities
- `-n, --limit`: Leads per location (default: 20)
- `-m, --max`: Max leads to process (default: 10)
- `--max-score`: Only target sites below this score (default: 60)
- `--dry-run`: Find and score only
- `--no-email`: Skip sending outreach emails

### Process from CSV

If you have your own lead list:

```bash
npm run process-csv leads.csv -- -m 20
```

**CSV Format:**
```csv
website,name,email,phone
https://bobs-plumbing.com,Bob's Plumbing,bob@email.com,555-1234
https://joes-hvac.com,Joe's HVAC,joe@email.com,555-5678
```

### Single Site Pipeline

Process one URL through the full pipeline:

```bash
# Full pipeline: scrape → build → deploy → email
npm run pipeline https://bobs-plumbing.com

# Deploy without email
npm run deploy https://bobs-plumbing.com

# Build locally without deploying
npm run build https://bobs-plumbing.com -- -o preview.html
```

### Dashboard

Web UI for managing leads and tracking conversions:

```bash
# Start server
npm start

# Open in browser
open http://localhost:3000
```

**Dashboard Features:**

| Section | Description |
|---------|-------------|
| **Stats Cards** | Total leads, emailed, responded, converted, revenue |
| **Add Lead** | Paste URL to run pipeline from browser |
| **Lead Table** | View all deployments with search/filter |
| **Quick Actions** | Send email, update status, add notes, delete |
| **Industry Breakdown** | See leads grouped by vertical |

**Status Flow:**
```
pending → emailed → responded → converted
                 ↘ expired
```

### Email Sequences

Automated follow-up sequence:

| Day | Email Type | Content |
|-----|------------|---------|
| 0 | Initial | Preview link + $1,000 offer |
| 3 | Follow-up 1 | "Did you get a chance to look?" |
| 7 | Follow-up 2 | "Preview expiring soon" |
| 12 | Breakup | "Taking this down, last chance" |
| 14 | Expire | Preview deleted |

Run the daily sequence processor:

```bash
# Process all pending follow-ups
npm run sequence
```

**Tip:** Set up a cron job to run this daily:
```bash
0 9 * * * cd /path/to/site-improver && npm run sequence
```

### Manual Outreach

Send or resend emails manually:

```bash
# Send initial outreach for a deployment
npm run outreach <siteId>
```

### Cleanup

Delete old preview sites from Netlify:

```bash
# Delete sites older than 30 days
npm run cleanup

# Delete sites older than 14 days
npm run cleanup -- --days 14
```

### List Deployments

```bash
# List all
npm run list

# Filter by status
node src/cli.js list --status pending
node src/cli.js list --status converted
```

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `npm start` | Start dashboard server |
| `npm run find <query>` | Find leads via Google Maps |
| `npm run score <urls>` | Score website quality |
| `npm run batch <query>` | Full batch processing |
| `npm run process-csv <file>` | Process leads from CSV |
| `npm run pipeline <url>` | Single site full pipeline |
| `npm run deploy <url>` | Scrape, build, deploy (no email) |
| `npm run build <url>` | Build locally (no deploy) |
| `npm run scrape <url>` | Scrape only, output JSON |
| `npm run outreach <siteId>` | Send outreach email |
| `npm run sequence` | Process follow-up sequence |
| `npm run list` | List all deployments |
| `npm run cleanup` | Delete old Netlify sites |

---

## Testing

Run the test suite:

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode for development
npm run test:coverage # Generate coverage report
```

Tests cover: utilities, configuration, database operations, template building, and server API endpoints.

---

## API Reference

The dashboard server exposes these REST endpoints:

### Deployments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/deployments` | List all deployments |
| GET | `/api/deployments/:id` | Get single deployment |
| PATCH | `/api/deployments/:id` | Update status/notes |
| DELETE | `/api/deployments/:id` | Delete deployment |

**Query Parameters (GET /api/deployments):**
- `status`: Filter by status (pending, emailed, responded, converted, expired)
- `search`: Search by business name, email, or industry
- `sort`: Sort field (default: createdAt)
- `order`: Sort order (asc/desc)

### Actions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/deployments/:id/send-email` | Send initial outreach |
| POST | `/api/deployments/:id/send-followup` | Send follow-up email |
| POST | `/api/pipeline` | Start pipeline for URL |

### Stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Get dashboard statistics |

**Stats Response:**
```json
{
  "total": 47,
  "pending": 5,
  "emailed": 32,
  "responded": 5,
  "converted": 3,
  "expired": 2,
  "conversionRate": "6.4",
  "revenue": 3000,
  "byIndustry": {
    "home-services": 25,
    "restaurant": 12,
    "lawyer": 10
  }
}
```

---

## Technical Architecture

### Project Structure

```
site-improver/
├── src/
│   ├── cli.js              # Command-line interface
│   ├── index.js            # Main exports
│   ├── server.js           # Express API server
│   ├── utils.js            # Shared utilities (delay, extractCity)
│   ├── logger.js           # Centralized logging module
│   ├── config.js           # Configuration constants
│   │
│   ├── leadFinder.js       # Google Maps lead discovery
│   ├── siteScorer.js       # Website quality scoring
│   ├── batch.js            # Batch processing orchestration
│   │
│   ├── scraper.js          # Playwright web scraping
│   ├── templateBuilder.js  # Template system + slot mapping
│   ├── aiPolish.js         # Claude copy improvement
│   │
│   ├── netlifyDeploy.js    # Netlify API deployment
│   ├── emailGenerator.js   # AI email generation
│   ├── emailSender.js      # Resend integration
│   ├── outreach.js         # Outreach sequence management
│   │
│   ├── pipeline.js         # Full pipeline orchestration
│   └── db.js               # JSON file database
│
├── dashboard/
│   ├── src/
│   │   ├── App.jsx         # Main React component
│   │   ├── main.jsx        # Entry point
│   │   └── styles.css      # Dashboard styles
│   ├── dist/               # Built dashboard files
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── netlify/
│   └── functions/
│       └── api.js          # Serverless API for Netlify deployment
│
├── templates/
│   ├── base/
│   │   ├── styles.css      # Shared CSS
│   │   └── components/     # Reusable HTML components
│   │       ├── header.html
│   │       ├── hero.html
│   │       ├── services-grid.html
│   │       ├── why-us.html
│   │       ├── testimonials.html
│   │       ├── contact-section.html
│   │       ├── cta-banner.html
│   │       └── footer.html
│   │
│   └── industries/
│       ├── home-services/template.json
│       ├── restaurant/template.json
│       ├── lawyer/template.json
│       ├── real-estate/template.json
│       └── retail/template.json
│
├── tests/
│   ├── utils.test.js       # Utility function tests
│   ├── config.test.js      # Configuration tests
│   ├── db.test.js          # Database operation tests
│   ├── templateBuilder.test.js  # Template system tests
│   └── server.test.js      # API endpoint tests
│
├── deployments.json        # Local database
├── netlify.toml            # Netlify deployment config
├── vitest.config.js        # Test configuration
├── package.json
├── .env.example
└── README.md
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 18+ |
| Web Scraping | Playwright |
| HTML Parsing | Cheerio |
| Templates | Handlebars |
| AI | Claude API (Anthropic) |
| Deployment | Netlify API |
| Email | Resend |
| Lead Data | Outscraper (Google Maps) |
| Dashboard | React + Vite |
| Server | Express |
| Database | JSON file |

### Data Flow

```
                    ┌─────────────────┐
                    │   Outscraper    │
                    │  (Google Maps)  │
                    └────────┬────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      LEAD FINDER                            │
│  - Search by query + location                               │
│  - Extract: name, website, phone, email, address            │
│  - Dedupe by website URL                                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      SITE SCORER                            │
│  - Load page with Playwright                                │
│  - Check: HTTPS, speed, mobile, design, SEO                 │
│  - Score 0-100 (lower = better target)                      │
│  - Filter to targets < threshold                            │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                        SCRAPER                              │
│  - Full page load with Playwright                           │
│  - Extract: logo, headlines, paragraphs, services           │
│  - Extract: phone, email, address, hours                    │
│  - Extract: images, colors, meta tags                       │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   TEMPLATE BUILDER                          │
│  - Detect industry from keywords                            │
│  - Select industry template                                 │
│  - Map scraped content to template slots                    │
│  - Generate custom CSS from extracted colors                │
│  - Assemble HTML document                                   │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      AI POLISH                              │
│  - Improve headlines (punchy, benefit-driven)               │
│  - Improve CTAs (action-oriented)                           │
│  - Improve service descriptions                             │
│  - Generate meta description                                │
│  - Batch polish for efficiency                              │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    NETLIFY DEPLOY                           │
│  - Create new site with unique name                         │
│  - Upload HTML + assets                                     │
│  - Wait for deployment ready                                │
│  - Return preview URL                                       │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   EMAIL GENERATOR                           │
│  - Generate personalized email with Claude                  │
│  - Generate subject line variants                           │
│  - Create HTML email with preview button                    │
│  - Generate follow-up emails                                │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    EMAIL SENDER                             │
│  - Send via Resend API                                      │
│  - Track in database                                        │
│  - Schedule follow-ups                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Reference

### LeadFinder (`src/leadFinder.js`)

Finds businesses via Google Maps using Outscraper API.

```javascript
import LeadFinder from './leadFinder.js';

const finder = new LeadFinder(process.env.OUTSCRAPER_API_KEY);

// Search single location
const leads = await finder.search('plumber', 'Denver, CO', 20);

// Search multiple locations
const leads = await finder.searchIndustry('plumber', [
  'Denver, CO',
  'Austin, TX',
  'Phoenix, AZ'
], 20);

// Returns:
// [{
//   name: "Bob's Plumbing",
//   website: "https://bobs-plumbing.com",
//   phone: "(555) 123-4567",
//   email: "bob@bobs-plumbing.com",
//   address: "123 Main St, Denver, CO",
//   rating: 4.5,
//   reviews: 87,
//   category: "Plumber"
// }, ...]
```

### SiteScorer (`src/siteScorer.js`)

Scores website quality to filter targets.

```javascript
import SiteScorer from './siteScorer.js';

const scorer = new SiteScorer();

// Score single site
const result = await scorer.score('https://bobs-plumbing.com');
// Returns:
// {
//   url: "https://bobs-plumbing.com",
//   score: 31,
//   scores: { https: 0, speed: 40, mobile: 0, modern: 35, seo: 40 },
//   issues: ["No HTTPS", "Not mobile responsive"],
//   isTarget: true,
//   isPrimeTarget: true,
//   recommendation: "prime_target"
// }

// Score and filter leads
const { targets, stats } = await scorer.filterLeads(leads, {
  maxScore: 60,
  onlyPrime: false
});
```

### Scraper (`src/scraper.js`)

Extracts content from websites using Playwright.

```javascript
import { scrapeSite } from './scraper.js';

const data = await scrapeSite('https://bobs-plumbing.com');
// Returns:
// {
//   url, businessName, logo, favicon,
//   headlines: [...],
//   paragraphs: [...],
//   services: [...],
//   testimonials: [...],
//   phone, email, address, hours,
//   socialLinks: [...],
//   images: [{ src, alt, context }],
//   colors: ["#1e40af", "#3b82f6"],
//   title, description
// }
```

### TemplateBuilder (`src/templateBuilder.js`)

Maps content to industry templates.

```javascript
import TemplateBuilder from './templateBuilder.js';

const builder = new TemplateBuilder('./templates');
await builder.init();

// Detect industry and build
const { html, industry, slots, needsAiPolish } = await builder.build(siteData);

// Build with polished slots
const finalHtml = await builder.buildWithSlots(siteData, polishedSlots);
```

### AIPolisher (`src/aiPolish.js`)

Improves copy using Claude.

```javascript
import AIPolisher from './aiPolish.js';

const polisher = new AIPolisher();

// Polish all slots
const polishedSlots = await polisher.polishAll(slots, siteData);

// Polish entire site in one call
const polished = await polisher.polishEntireSite(siteData, slots);
```

### NetlifyDeployer (`src/netlifyDeploy.js`)

Deploys preview sites to Netlify.

```javascript
import NetlifyDeployer from './netlifyDeploy.js';

const deployer = new NetlifyDeployer(process.env.NETLIFY_AUTH_TOKEN);

// Deploy
const result = await deployer.deploy(html, 'Bob\'s Plumbing');
// Returns:
// {
//   siteId: "abc123",
//   siteName: "preview-bobs-plumbing-a3f2",
//   url: "https://preview-bobs-plumbing-a3f2.netlify.app",
//   adminUrl: "https://app.netlify.com/sites/..."
// }

// Cleanup old sites
const deleted = await deployer.cleanupOldSites(30); // days
```

### EmailGenerator (`src/emailGenerator.js`)

Generates personalized outreach emails.

```javascript
import EmailGenerator, { wrapInHtml } from './emailGenerator.js';

const generator = new EmailGenerator();

// Generate email body
const body = await generator.generateEmail({
  businessName: "Bob's Plumbing",
  industry: "home-services",
  originalUrl: "https://bobs-plumbing.com",
  previewUrl: "https://preview-bobs-plumbing-a3f2.netlify.app",
  phone: "(555) 123-4567"
});

// Generate subject lines
const subjects = await generator.generateSubjectLines({
  businessName: "Bob's Plumbing",
  industry: "home-services"
});
// Returns: ["I rebuilt your website", "Quick question about Bob's Plumbing", ...]

// Generate follow-up
const followUp = await generator.generateFollowUp(data, 1); // attempt 1, 2, or 3

// Wrap in HTML template
const htmlBody = wrapInHtml(body, previewUrl, businessName);
```

### OutreachManager (`src/outreach.js`)

Manages email sequences.

```javascript
import { OutreachManager, runDailySequence } from './outreach.js';

const outreach = new OutreachManager({
  resendApiKey: process.env.RESEND_API_KEY,
  fromEmail: process.env.FROM_EMAIL
});

// Send initial outreach
await outreach.sendInitialOutreach(deployment);

// Send follow-up
await outreach.sendFollowUp(deployment, 1); // attempt 1, 2, or 3

// Run daily sequence (process all pending follow-ups)
await runDailySequence(config);
```

### BatchProcessor (`src/batch.js`)

Orchestrates full batch processing.

```javascript
import BatchProcessor from './batch.js';

const processor = new BatchProcessor({
  maxScoreThreshold: 60,
  skipEmail: false,
  concurrency: 2,
  delayBetween: 5000
});

// Full batch
const results = await processor.run({
  query: 'plumber',
  locations: ['Denver, CO', 'Austin, TX'],
  limitPerLocation: 20,
  maxLeads: 10,
  dryRun: false
});

// Process from CSV
const results = await processor.processCSV('leads.csv', {
  maxLeads: 20,
  dryRun: false
});
```

### Pipeline (`src/pipeline.js`)

Full single-site pipeline.

```javascript
import { rebuildAndDeploy } from './pipeline.js';

const result = await rebuildAndDeploy('https://bobs-plumbing.com', {
  skipPolish: false,
  skipDeploy: false
});
// Returns:
// {
//   original: "https://bobs-plumbing.com",
//   preview: "https://preview-bobs-plumbing-a3f2.netlify.app",
//   siteId: "abc123",
//   html: "...",
//   siteData: {...},
//   industry: "home-services",
//   duration: "12.3"
// }
```

---

## Template System

### Industry Detection

Templates are selected based on keyword matching:

```json
{
  "id": "home-services",
  "keywords": ["plumber", "plumbing", "hvac", "electrician", "roofing", "contractor"]
}
```

### Template Configuration

Each industry has a `template.json`:

```json
{
  "id": "home-services",
  "name": "Home Services",
  "keywords": ["plumber", "electrician", "hvac", ...],
  
  "sections": [
    "header",
    "hero",
    "services-grid",
    "why-us",
    "testimonials",
    "cta-banner",
    "contact-section",
    "footer"
  ],
  
  "slots": {
    "headline": {
      "source": "headlines[0]",
      "fallback": "Professional {{industry}} Services",
      "aiEnhance": true
    },
    "subheadline": {
      "source": "paragraphs[0]",
      "fallback": "Serving your area with quality service",
      "aiEnhance": true,
      "maxLength": 150
    },
    "cta_text": {
      "source": null,
      "fallback": "Get a Free Quote"
    }
  },
  
  "colorMapping": {
    "primary": "colors[0]",
    "secondary": "colors[1]",
    "fallback": {
      "primary": "#1e40af",
      "secondary": "#3b82f6"
    }
  }
}
```

### Components

HTML components use Handlebars syntax:

```html
<!-- hero.html -->
<section class="hero">
  <div class="container">
    <div class="hero-content">
      <h1>{{headline}}</h1>
      <p>{{subheadline}}</p>
      <a href="#contact" class="btn-primary">{{cta_text}}</a>
    </div>
  </div>
</section>
```

### Adding New Industries

1. Create folder: `templates/industries/dental/`
2. Create `template.json` with keywords, sections, slots
3. Optionally add `overrides.css` for custom styling
4. Rebuild dashboard: `npm run dashboard:build`

---

## Costs

| Service | Cost | Notes |
|---------|------|-------|
| **Outscraper** | ~$0.002/lead | Google Maps data |
| **Claude API** | ~$0.01/site | AI polish + email |
| **Netlify** | Free | Unlimited sites on free tier |
| **Resend** | Free | 3,000 emails/month free |

### Unit Economics

| Metric | Value |
|--------|-------|
| Cost per qualified lead | ~$0.02-0.03 |
| Price per conversion | $1,000 |
| Break-even conversion rate | 0.003% |
| Typical cold email response | 1-5% |

**Example:**
- Process 100 leads → $3 cost
- 3% response rate → 3 responses
- 33% close rate → 1 sale
- **Revenue: $1,000 - $3 = $997 profit**

---

## Troubleshooting

### "OUTSCRAPER_API_KEY not set"

Get an API key at https://outscraper.com/ and add to `.env`

### "NETLIFY_AUTH_TOKEN not set"

1. Go to https://app.netlify.com/user/applications#personal-access-tokens
2. Create new token
3. Add to `.env`

### Playwright fails to launch

```bash
npx playwright install chromium
```

### Site scoring times out

Some sites have aggressive bot protection. The scorer will return score: 0 (prime target) for sites that fail to load.

### Emails going to spam

1. Verify your domain in Resend
2. Set up SPF, DKIM, DMARC records
3. Warm up domain slowly (20-30/day)
4. Avoid spam trigger words
5. Personalize emails (AI helps with this)

### Dashboard not loading

```bash
# Rebuild dashboard
npm run dashboard:build

# Check if server is running
npm start
```

### Rate limiting

Add delays between operations:

```javascript
const processor = new BatchProcessor({
  delayBetween: 10000  // 10 seconds between sites
});
```

---

## Development

### Running in Dev Mode

```bash
# Terminal 1: API server
npm run dev

# Terminal 2: Dashboard with hot reload
npm run dashboard:dev
```

### Adding Features

1. Create module in `src/`
2. Export from `src/index.js`
3. Add CLI command in `src/cli.js`
4. Add API endpoint in `src/server.js`
5. Update dashboard in `dashboard/src/App.jsx`

---

## Deployment

### Local Development (Full Features)

```bash
npm start  # Dashboard + Pipeline at http://localhost:3000
```

The local server provides full functionality including the pipeline (scraping, AI polish, Netlify deployment).

### Netlify Deployment (Dashboard Only)

The dashboard can be deployed to Netlify for remote access. **Note:** Pipeline operations (scraping, deploying previews) require the local server because Playwright cannot run in serverless environments.

```bash
# Install Netlify CLI
npm install -g netlify-cli
netlify login

# Initialize (first time)
netlify init

# Deploy preview
netlify deploy

# Deploy to production
netlify deploy --prod
```

**Required Netlify Environment Variables** (set in Netlify Dashboard > Site Settings > Environment Variables):
- `ANTHROPIC_API_KEY`
- `NETLIFY_AUTH_TOKEN`
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `OUTSCRAPER_API_KEY`

### Production Workflow

1. **Run pipeline locally** to process websites:
   ```bash
   npm run batch plumber -- -l "Denver, CO" -m 10
   ```
2. **Data saves** to `deployments.json`
3. **Dashboard** (local or Netlify) displays the data
4. **Manage leads** and send emails from dashboard

### About Sample Data

The `deployments.json` file ships with sample entries for demo purposes. To use real production data:

1. Clear seed data: `echo "[]" > deployments.json`
2. Run the pipeline on real websites
3. View results in dashboard

---

### Database Schema

Deployments are stored in `deployments.json`:

```json
{
  "siteId": "abc123",
  "siteName": "preview-bobs-plumbing-a3f2",
  "original": "https://bobs-plumbing.com",
  "preview": "https://preview-bobs-plumbing-a3f2.netlify.app",
  "businessName": "Bob's Plumbing",
  "industry": "home-services",
  "phone": "(555) 123-4567",
  "email": "bob@bobsplumbing.com",
  "address": "123 Main St, Denver, CO",
  "city": "Denver",
  "status": "emailed",
  "createdAt": "2025-12-10T10:30:00Z",
  "emailSentAt": "2025-12-10T10:35:00Z",
  "emailSubject": "I rebuilt your website",
  "followUp1SentAt": "2025-12-13T10:35:00Z",
  "notes": "Called back, scheduling demo"
}
```

---

## Quick Start Checklist

- [ ] Clone repo / extract tarball
- [ ] Run `npm install`
- [ ] Run `npx playwright install chromium`
- [ ] Copy `.env.example` to `.env`
- [ ] Add `ANTHROPIC_API_KEY`
- [ ] Add `NETLIFY_AUTH_TOKEN`
- [ ] Add `RESEND_API_KEY` and `FROM_EMAIL`
- [ ] Add `OUTSCRAPER_API_KEY`
- [ ] Run `npm test` to verify setup
- [ ] Test with `npm run score https://example.com`
- [ ] Run dashboard with `npm start`
- [ ] Try batch with `npm run batch plumber -- -l "Your City" --dry-run`
- [ ] Remove `--dry-run` when ready to process for real
- [ ] (Optional) Deploy dashboard: `netlify deploy --prod`

---

## License

MIT

---

## Support

Built by Marc @ [Dizid](https://dizid.com)

For issues, open a GitHub issue or reach out directly.
