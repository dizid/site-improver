# Site Improver - Features Documentation

A complete automated pipeline for website rebuilding, lead generation, and cold outreach. Built for agencies and freelancers who want to demonstrate value before the pitch.

---

## Table of Contents

1. [Core Pipeline](#core-pipeline)
2. [Lead Generation](#lead-generation)
3. [Site Scoring](#site-scoring)
4. [Web Scraping](#web-scraping)
5. [Template Building](#template-building)
6. [AI-Powered Copy Enhancement](#ai-powered-copy-enhancement)
7. [Netlify Deployment](#netlify-deployment)
8. [Email Outreach](#email-outreach)
9. [Batch Processing](#batch-processing)
10. [Dashboard](#dashboard)
11. [CLI Commands](#cli-commands)
12. [API Endpoints](#api-endpoints)
13. [Configuration](#configuration)
14. [Database](#database)

---

## Core Pipeline

The heart of Site Improver is an automated pipeline that transforms any business website into a modern, optimized version.

### Pipeline Stages

1. **Scrape** - Extract all content, branding, and contact info from the target site
2. **Build** - Generate a new site using industry-specific templates
3. **Polish** - Enhance copy with AI for conversion optimization
4. **Deploy** - Push to Netlify for instant preview hosting
5. **Outreach** - Send personalized cold email with preview link

### Pipeline Options

| Option | Description |
|--------|-------------|
| `skipPolish` | Skip AI copy enhancement (faster, uses original text) |
| `skipDeploy` | Build HTML only, don't deploy to Netlify |
| `skipEmail` | Don't send outreach email after deployment |

---

## Lead Generation

Find potential clients via Google Maps business data using the Outscraper API.

### Features

- **Location-Based Search** - Search by business type + city/region
- **Batch Search** - Search multiple locations in one run
- **Industry Search** - Target specific industries across multiple cities
- **Deduplication** - Automatic removal of duplicate websites
- **Rate Limiting** - Built-in delays to respect API limits

### Data Extracted

- Business name
- Website URL
- Phone number
- Email address
- Full address (city, state)
- Google rating & review count
- Business category
- Place ID
- Coordinates (lat/lng)

### Alternative: Google Custom Search

A free-tier option using Google Custom Search API for basic lead finding (name, website, snippet only).

---

## Site Scoring

Evaluate website quality to identify the best targets - sites with low scores are prime candidates for redesign.

### Scoring Criteria (0-100 scale, lower = better target)

| Factor | Weight | What It Measures |
|--------|--------|------------------|
| HTTPS | 15% | Secure connection |
| Speed | 20% | Page load time (<2s = 100%, >10s = 0%) |
| Mobile | 20% | Responsive viewport meta tag |
| Modern Design | 25% | CSS flexbox/grid, modern fonts, no table layouts, framework usage |
| SEO Basics | 20% | Title, meta description, H1, structured data, heading hierarchy |

### Score Classifications

| Score Range | Classification | Recommendation |
|-------------|----------------|----------------|
| 0-20 | Prime Target | Highest priority - major issues |
| 20-40 | Strong Target | Significant improvement potential |
| 40-60 | Moderate Target | Worth pursuing |
| 60-80 | Weak Target | Marginal opportunity |
| 80-100 | Skip | Site is already decent |

### Features

- **Single Site Scoring** - Score individual URLs
- **Batch Scoring** - Score multiple sites with concurrency control
- **Lead Filtering** - Automatically filter leads to only targets below threshold

---

## Web Scraping

Intelligent content extraction using Playwright headless browser and Cheerio HTML parsing.

### Identity Extraction

- **Logo** - Multiple selector patterns (header img, .logo, brand classes)
- **Business Name** - OG meta, title parsing, logo text, brand elements
- **Favicon** - Standard icon links

### Content Extraction

- **Headlines** - H1, H2, H3 tags (max 10)
- **Paragraphs** - Body text 50-1000 chars (max 10)
- **Services** - List items from services sections (max 10)
- **Testimonials** - Review/testimonial sections with author (max 5)

### Contact Extraction

- **Phone** - Regex pattern matching for US phone numbers
- **Email** - Email regex with spam filtering (excludes example@, wixpress, etc.)
- **Address** - Common address container selectors
- **Social Links** - Facebook, Instagram, Twitter/X, LinkedIn, YouTube
- **Business Hours** - Hour/schedule sections

### Media Extraction

- **Images** - All images with filtering:
  - Skips tiny images (<50px)
  - Skips tracking pixels, icons, SVGs
  - Includes alt text and section context
  - Max 20 images

### Color Extraction

- Extracts computed background and text colors from all elements
- Converts RGB to hex
- Filters out pure black/white
- Returns top 5 unique brand colors

### Metadata

- Page title
- Meta description (standard + OG)
- OG image

---

## Template Building

Handlebars-based template system with industry-specific configurations.

### Features

- **Component System** - Reusable HTML components (header, hero, services, etc.)
- **Industry Detection** - Automatic detection based on keywords in content
- **Slot Mapping** - Maps scraped data to template slots
- **Fallback Values** - Industry-specific defaults when data is missing
- **AI Enhancement Flags** - Marks which slots should be AI-polished

### Industry Configurations

Each industry has a `template.json` defining:
- Keywords for detection
- Slot mappings (source paths + fallbacks)
- AI enhancement preferences
- Custom styling hints

### Template Structure

```
templates/
├── base/
│   └── components/
│       ├── header.html
│       ├── hero.html
│       ├── services.html
│       └── ...
└── industries/
    ├── plumber/
    │   └── template.json
    ├── restaurant/
    │   └── template.json
    └── ...
```

---

## AI-Powered Copy Enhancement

Uses Claude (Anthropic) to transform generic copy into conversion-focused content.

### Polishing Modes

1. **Slot-by-Slot** - Polish individual content slots with specific prompts
2. **Services Polish** - Enhance entire service list for consistency
3. **Full Site Polish** - Generate all copy in one cohesive pass

### Slot-Specific Prompts

| Slot | Guidelines |
|------|------------|
| Headline | Punchy, benefit-driven, max 10 words |
| Subheadline | Supports headline, core value prop, max 25 words |
| Service Description | Benefit-focused, concise, max 20 words |
| CTA Text | Action-oriented, creates urgency, max 4 words |
| About Text | Trust-building, warm, personal, max 60 words |
| Meta Description | SEO-friendly, click-worthy, max 155 chars |

### AI Configuration

- **Model**: Claude Sonnet (configurable)
- **Concurrency**: 3 parallel requests (configurable)
- **Max Tokens**: Varies by slot type (200-1000)

### Style Guidelines (System Prompt)

- Concise and punchy, no fluff
- Benefits over features
- Active voice
- Urgency without sleaze
- Industry-appropriate tone
- Preserve local/personal feel
- Keep specific details (years, locations, etc.)

---

## Netlify Deployment

Automated site hosting on Netlify's free tier.

### Features

- **Auto-Generated Site Names** - `preview-{business-slug}-{hash}.netlify.app`
- **File Hashing** - Efficient incremental deploys
- **Clean URLs** - Automatic `_redirects` for SPA routing
- **Deploy Verification** - Waits for deploy to be ready
- **Site Cleanup** - Delete old preview sites by age

### Deployment Flow

1. Create new Netlify site with unique name
2. Prepare deploy directory (index.html + _redirects)
3. Calculate file hashes for efficient upload
4. Upload only required files
5. Wait for deploy to complete
6. Return preview URL

### Cleanup

Automatically delete preview sites older than configurable threshold (default 30 days).

---

## Email Outreach

AI-generated personalized cold emails with automated follow-up sequences.

### Email Generation

- **Initial Email** - Personalized pitch with preview link
- **Subject Lines** - AI-generated, curiosity-driven (3 options)
- **Follow-ups** - 3-stage sequence with different angles
- **HTML Formatting** - Styled email with CTA button

### Email Style

- Casual, friendly, human (not salesy)
- Short paragraphs, scannable
- No fluff or filler
- Confident but not arrogant
- Creates curiosity without being pushy

### Email Structure

1. Hook (1 line) - Pattern interrupt, reference their business
2. Offer (2-3 lines) - What you did, preview link
3. Value prop (1-2 lines) - Why it matters
4. CTA (1 line) - Simple next step
5. Sign off

### Follow-Up Sequence

| Day | Follow-Up | Approach |
|-----|-----------|----------|
| 3 | First | Different angle, add social proof |
| 7 | Second | "Floating to top", mention expiration |
| 12 | Breakup | Final notice, FOMO, door open |
| 14 | Expire | Auto-expire status (no email) |

### Email Sending

Uses Resend API for reliable delivery with:
- Plain text + HTML versions
- Tracking ID storage
- Sent timestamp logging

---

## Batch Processing

End-to-end automation: find leads, score sites, process pipeline, send emails.

### Batch Flow

1. **Find Leads** - Search via Outscraper API
2. **Score Sites** - Evaluate all websites
3. **Filter Targets** - Keep only sites below score threshold
4. **Process Pipeline** - Scrape, build, polish, deploy each target
5. **Send Emails** - Automated outreach for each deployment

### Batch Options

| Option | Description |
|--------|-------------|
| `query` | Business type to search (e.g., "plumber") |
| `locations` | Array of cities/regions |
| `limitPerLocation` | Max leads per location (default 20) |
| `maxLeads` | Total leads to process (default 50) |
| `maxScore` | Score threshold for targeting (default 60) |
| `dryRun` | Find and score only, don't deploy |
| `skipEmail` | Don't send outreach emails |

### CSV Processing

Import leads from CSV file with columns:
- `website` or `url` or `site` (required)
- `name` or `business` or `company`
- `email`
- `phone`

### Duplicate Prevention

- Checks existing deployments before processing
- Deduplicates by website URL
- Handles URL normalization (trailing slashes, protocol)

---

## Dashboard

React-based web dashboard for managing leads and tracking conversions.

### Stats Overview

- Total leads
- Emailed count
- Responded count
- Converted count
- Conversion rate
- Total revenue
- Breakdown by industry

### Lead Management

- **Status Tracking**: Pending → Emailed → Responded → Converted → Expired
- **Search**: Filter by name, email, or industry
- **Status Filter**: View by status category
- **Preview Links**: Direct links to deployed sites
- **Notes**: Add notes to any deployment
- **Manual Email Send**: Trigger email from dashboard
- **Delete**: Remove deployment (optionally from Netlify too)

### New Lead Form

- URL validation
- Skip email option
- Real-time processing status

### Auto-Refresh

Dashboard refreshes data every 30 seconds.

---

## CLI Commands

### `scrape <url>`
Scrape a website and output JSON data.
```bash
npm run scrape https://example.com
npm run scrape https://example.com -- -o data.json
```

### `build <url>`
Scrape and build HTML (no deploy).
```bash
npm run build https://example.com
npm run build https://example.com -- -o output.html --no-polish
```

### `deploy <url>`
Full scrape, build, polish, and deploy.
```bash
npm run deploy https://example.com
npm run deploy https://example.com -- --no-polish
```

### `pipeline <url>`
Complete pipeline including email.
```bash
npm run pipeline https://example.com
npm run pipeline https://example.com -- --no-email
```

### `outreach <siteId>`
Send outreach email for existing deployment.
```bash
npm run outreach site-abc123
```

### `sequence`
Run daily follow-up sequence for all deployments.
```bash
npm run sequence
```

### `cleanup`
Delete old preview sites from Netlify.
```bash
npm run cleanup
npm run cleanup -- -d 14  # Delete sites older than 14 days
```

### `list`
List all deployments.
```bash
npm run list
npm run list -- -s emailed  # Filter by status
```

### `find <query>`
Find leads via Google Maps.
```bash
npm run find "plumber"
npm run find "plumber" -- -l "Austin, TX" -n 50 -o leads.json
```

### `score <urls...>`
Score website quality.
```bash
npm run score https://example1.com https://example2.com
```

### `batch <query>`
Full batch processing.
```bash
npm run batch "dentist" -- -l "Denver, CO,Austin, TX" -m 10
npm run batch "plumber" -- --dry-run  # Score only, don't deploy
```

### `process-csv <file>`
Process leads from CSV.
```bash
npm run process-csv leads.csv
npm run process-csv leads.csv -- --dry-run --max-score 50
```

---

## API Endpoints

### Deployments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/deployments` | List all deployments (filterable) |
| GET | `/api/deployments/:siteId` | Get single deployment |
| PATCH | `/api/deployments/:siteId` | Update status/notes |
| DELETE | `/api/deployments/:siteId` | Delete deployment |

### Stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Get dashboard statistics |

### Actions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/deployments/:siteId/send-email` | Send initial outreach |
| POST | `/api/deployments/:siteId/send-followup` | Send follow-up email |
| POST | `/api/pipeline` | Start pipeline for URL |

### Query Parameters

**GET /api/deployments**
- `status` - Filter by status (pending, emailed, responded, converted, expired)
- `search` - Search in name, email, industry
- `sort` - Sort field (default: createdAt)
- `order` - Sort order (asc, desc)

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | Claude API for AI copy |
| `NETLIFY_AUTH_TOKEN` | Yes* | Netlify deployment |
| `RESEND_API_KEY` | For email | Email sending |
| `FROM_EMAIL` | For email | Sender email address |
| `OUTSCRAPER_API_KEY` | For leads | Google Maps lead finding |
| `PORT` | No | Server port (default 3000) |
| `DB_PATH` | No | Database file path |
| `LOG_LEVEL` | No | Logging level |

*Required for respective features

### Config File (`src/config.js`)

```javascript
CONFIG = {
  timeouts: {
    pageLoad: 30000,      // Page load timeout
    scoring: 15000,       // Scoring timeout
    deployPoll: 2000,     // Deploy check interval
    deployMax: 60000,     // Max deploy wait
    scrapeWait: 2000,     // Post-load JS settle time
    apiRequest: 30000     // API timeout
  },

  limits: {
    headlines: 10,
    paragraphs: 10,
    services: 10,
    testimonials: 5,
    images: 20,
    colors: 5,
    siteNameLength: 30
  },

  scoring: {
    speedThresholds: { excellent: 2000, good: 4000, fair: 6000, poor: 10000 },
    weights: { https: 15, speed: 20, mobile: 20, modern: 25, seo: 20 },
    maxTargetScore: 60,
    primeTargetScore: 40
  },

  batch: {
    defaultDelay: 5000,
    defaultConcurrency: 2,
    rateLimit: 1000
  },

  ai: {
    model: 'claude-sonnet-4-20250514',
    maxTokens: { slot: 200, services: 800, fullSite: 1000 },
    concurrency: 3
  },

  cleanup: { maxAgeDays: 30 },

  emailSequence: {
    followUp1: 3,  // Days after initial
    followUp2: 7,
    followUp3: 12,
    expire: 14
  },

  server: {
    defaultPort: 3000,
    functionsPort: 9999,
    corsOrigins: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:9999']
  },

  database: { defaultPath: './deployments.json' }
}
```

---

## Database

Simple JSON file-based storage.

### Deployment Record Schema

```javascript
{
  siteId: string,           // Netlify site ID
  siteName: string,         // Netlify subdomain
  original: string,         // Original website URL
  preview: string,          // Preview URL
  businessName: string,
  industry: string,
  phone: string,
  email: string,
  address: string,
  city: string,
  status: 'pending' | 'emailed' | 'responded' | 'converted' | 'expired',
  notes: string,
  emailId: string,          // Resend email ID
  emailSentAt: string,      // ISO timestamp
  emailSubject: string,
  emailBody: string,
  followUp1SentAt: string,
  followUp2SentAt: string,
  followUp3SentAt: string,
  createdAt: string,
  updatedAt: string
}
```

### Operations

- `loadDb()` - Load database from file
- `saveDb(db)` - Write database to file
- `saveDeployment(data)` - Add new deployment
- `getDeployment(siteId)` - Get single deployment
- `getDeployments(status?)` - List all (optionally filtered)
- `updateDeployment(siteId, updates)` - Update fields
- `deleteDeployment(siteId)` - Remove deployment

---

## Deployment Modes

### Local Development
```bash
npm run dev              # Express server on port 3000
npm run dashboard:dev    # Vite dev server on port 5173
netlify dev              # Full Netlify dev environment
```

### Production (Netlify)
- Dashboard: Static build served from `dashboard/dist`
- API: Netlify Functions at `/.netlify/functions/api`
- Note: Pipeline endpoint not available in serverless (requires Playwright)

---

## Architecture

```
site-improver/
├── src/
│   ├── cli.js           # CLI entry point
│   ├── server.js        # Express API server
│   ├── config.js        # Centralized configuration
│   ├── db.js            # JSON database operations
│   ├── logger.js        # Structured logging
│   ├── utils.js         # Utility functions
│   ├── scraper.js       # Playwright web scraping
│   ├── siteScorer.js    # Website quality scoring
│   ├── leadFinder.js    # Outscraper API integration
│   ├── templateBuilder.js # Handlebars template system
│   ├── aiPolish.js      # Claude AI copy enhancement
│   ├── netlifyDeploy.js # Netlify API integration
│   ├── emailGenerator.js # AI email content generation
│   ├── emailSender.js   # Resend API integration
│   ├── outreach.js      # Email campaign management
│   ├── pipeline.js      # Full pipeline orchestration
│   ├── batch.js         # Batch processing logic
│   └── index.js         # Module exports
├── dashboard/
│   └── src/
│       └── App.jsx      # React dashboard
├── netlify/
│   └── functions/
│       └── api.js       # Serverless API wrapper
├── templates/
│   ├── base/components/ # Reusable HTML components
│   └── industries/      # Industry-specific configs
└── deployments.json     # Local database
```

---

## Integrations

| Service | Purpose | Required |
|---------|---------|----------|
| Anthropic Claude | AI copy enhancement & email generation | For AI features |
| Netlify | Preview site hosting | For deployment |
| Resend | Transactional email | For outreach |
| Outscraper | Google Maps lead data | For lead finding |
| Playwright | Browser automation | For scraping/scoring |
