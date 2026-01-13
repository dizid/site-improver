# Site Improver - Features Documentation

A complete automated pipeline for website rebuilding, lead generation, and cold outreach. Built for agencies and freelancers who want to demonstrate value before the pitch.

---

## Table of Contents

1. [Core Pipeline](#core-pipeline)
2. [Lead Generation](#lead-generation)
3. [Lead Qualification](#lead-qualification)
4. [Site Scoring](#site-scoring)
5. [Web Scraping](#web-scraping)
6. [Template Building](#template-building)
7. [AI-Powered Copy Enhancement](#ai-powered-copy-enhancement)
8. [Netlify Deployment](#netlify-deployment)
9. [Email Outreach](#email-outreach)
10. [Batch Processing](#batch-processing)
11. [Dashboard](#dashboard)
12. [Preview Analytics](#preview-analytics)
13. [CLI Commands](#cli-commands)
14. [API Endpoints](#api-endpoints)
15. [Configuration](#configuration)
16. [Database](#database)
17. [Error Handling & Resilience](#error-handling--resilience)

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

Find potential clients via Google Maps business data using Outscraper API or Google Places API.

### Outscraper Integration (Primary)

Uses Outscraper API for comprehensive Google Maps data.

**Features:**
- **Location-Based Search** - Search by business type + city/region
- **Batch Search** - Search multiple locations in one run
- **Industry Search** - Target specific industries across multiple cities
- **Deduplication** - Automatic removal of duplicate websites
- **Rate Limiting** - Built-in delays to respect API limits

**Data Extracted:**
- Business name
- Website URL
- Phone number
- Email address
- Full address (city, state)
- Google rating & review count
- Business category
- Place ID
- Coordinates (lat/lng)

### Google Places API Integration (Alternative)

Direct integration with Google Places Text Search API (`src/googlePlaces.js`).

**Features:**
- **Text Search API** - Search businesses by query + location
- **Batch Search** - Multi-query with rate limiting
- **Industry Search** - Target industries across multiple regions
- **Field Masking** - Request only needed fields to reduce costs

**API Details:**
- Endpoint: `https://places.googleapis.com/v1/places:searchText`
- Auth: `X-Goog-Api-Key` header
- Cost: ~$32 per 1000 requests

**Data Extracted:**
- Business name (displayName)
- Website URL (websiteUri)
- Phone (nationalPhoneNumber)
- Address (formattedAddress)
- Rating & review count
- Business status
- Primary type

---

## Lead Qualification

Automated filtering and prioritization of leads based on multiple criteria (`src/leadQualifier.js`).

### Qualification Checks

1. **Has Website** - Must have a website URL
2. **Valid Website** - Not a social media page (filters Facebook, Instagram, LinkedIn, etc.)
3. **Has Contact** - Email or phone number (configurable)
4. **Target Market** - Optionally filter by geographic market (NL, UK)
5. **Site Score** - Quality score from site scoring

### Target Markets

| Market | Regions |
|--------|---------|
| NL (Netherlands) | Amsterdam, Rotterdam, Den Haag, Utrecht, Eindhoven, Tilburg, Groningen |
| UK (United Kingdom) | London, Manchester, Birmingham, Leeds, Glasgow, Liverpool, Bristol |

### Classifications

| Classification | Score Range | Priority |
|----------------|-------------|----------|
| `prime_target` | 0-40 | 10 (highest) |
| `target` | 40-60 | 7 |
| `weak_target` | 60-80 | 3 |
| `skip` | 80-100 | 0 |

### Social Media Filtering

Automatically excludes websites that are just social profiles:
- facebook.com, fb.com
- instagram.com
- twitter.com, x.com
- linkedin.com
- youtube.com
- tiktok.com
- yelp.com, tripadvisor.com

### Batch Qualification

```javascript
const qualifier = new LeadQualifier({ requireContact: true });
const { qualified, disqualified, stats } = qualifier.qualifyBatch(leads);
// Returns leads sorted by priority (prime targets first)
```

---

## Site Scoring

Evaluate website quality to identify the best targets - sites with low scores are prime candidates for redesign.

### Browser-Based Scoring (Default)

Uses Playwright to analyze sites with these criteria:

| Factor | Weight | What It Measures |
|--------|--------|------------------|
| HTTPS | 15% | Secure connection |
| Speed | 20% | Page load time (<2s = 100%, >10s = 0%) |
| Mobile | 20% | Responsive viewport meta tag |
| Modern Design | 25% | CSS flexbox/grid, modern fonts, no table layouts, framework usage |
| SEO Basics | 20% | Title, meta description, H1, structured data, heading hierarchy |

### PageSpeed Insights Integration (Optional)

Enhanced scoring using Google PageSpeed Insights API (`src/pageSpeedScorer.js`).

**Features:**
- **Lighthouse Scores** - Performance, Accessibility, Best Practices, SEO (0-100 each)
- **Core Web Vitals** - LCP, FID/TBT, CLS, FCP, TTFB
- **Mobile + Desktop** - Analyzes both with weighted average (60/40 mobile priority)
- **Free API** - No cost, optional API key for higher quota

**API Details:**
- Endpoint: `https://www.googleapis.com/pagespeedonline/v5/runPagespeed`
- Categories: performance, accessibility, best-practices, seo
- Fallback: Uses browser-based scoring if API fails

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
- **Target Assessment** - Quick check if a site is worth pursuing

---

## Web Scraping

Serverless content extraction using Firecrawl API and Cheerio HTML parsing.

### Scraper Architecture

Uses **Firecrawl API** for serverless-compatible scraping:
- No Playwright dependency (works on Netlify Functions)
- Returns HTML + Markdown formats
- Fast and reliable

### Identity Extraction

- **Logo** - Multiple selector patterns (header img, .logo, brand classes)
- **Business Name** - OG meta, title parsing, logo text, brand elements
- **Favicon** - Standard icon links

### Content Extraction

- **Headlines** - H1, H2, H3 tags (max 10)
- **Paragraphs** - Body text 50-1000 chars (max 10)
- **Services** - List items from services sections (max 10)
- **Testimonials** - Enhanced multi-strategy extraction (see below)

### Enhanced Testimonial Detection (NEW)

6 detection strategies for comprehensive testimonial extraction:

1. **Container Selectors** - `.testimonial`, `.review`, `.feedback`, `[data-review]`
2. **Blockquotes** - Standard blockquote elements with author detection
3. **Google Reviews Widget** - `[class*="google-review"]`, `[data-google-review]`
4. **Yelp Reviews Widget** - `[class*="yelp-review"]`, `[data-yelp]`
5. **TrustPilot Widget** - `[class*="trustpilot"]`, `[data-trustpilot]`
6. **Section Analysis** - Finds testimonials in sections with review-related headings

**Star Rating Extraction:**
- Aria labels (`aria-label*="rating"`)
- Data attributes (`data-rating`, `data-stars`)
- Icon counting (`.star-filled`, `.fa-star`)
- SVG stars
- Text-based ratings ("4.5/5", "5 stars")

### Schema.org/JSON-LD Extraction (NEW)

Extracts structured data from JSON-LD scripts:

**Supported Schema Types:**
- LocalBusiness, Organization, Restaurant, Store
- ProfessionalService, LegalService, MedicalBusiness
- HomeAndConstructionBusiness, Plumber, Electrician
- RealEstateAgent, Dentist, Attorney, FinancialService

**Extracted Data:**
| Field | Description |
|-------|-------------|
| `rating` | Aggregate rating (1-5 stars) |
| `reviewCount` | Number of reviews |
| `priceRange` | Price indicator ($, $$, $$$) |
| `openingHours` | Formatted business hours |
| `address` | PostalAddress formatted to string |
| `phone` | Telephone number |
| `email` | Contact email |
| `services` | From hasOfferCatalog/makesOffer |
| `reviews` | Individual review texts with ratings |

**Merge Priority:** Schema data fills gaps when scraped data is missing.

### Contact Extraction

- **Phone** - Regex pattern matching for phone numbers
- **Email** - Email regex with spam filtering (excludes example@, wixpress, etc.)
- **Address** - Common address container selectors + Schema.org
- **Social Links** - Facebook, Instagram, Twitter/X, LinkedIn, YouTube
- **Business Hours** - Hour/schedule sections + Schema.org openingHours

### Media Extraction

- **Images** - All images with filtering:
  - Skips tiny images (<50px)
  - Skips tracking pixels, icons, SVGs
  - Includes alt text and section context
  - Max 20 images
- **OG Image** - High-quality social share image (priority for hero)

### Color Extraction

- Extracts hex colors from inline styles and `<style>` tags
- Filters out pure black/white
- Returns top 5 unique brand colors

### Language Detection

Automatic language detection:
1. HTML `lang` attribute (most reliable)
2. Meta tags (`content-language`, `language`)
3. Content analysis (Dutch, German, French, Spanish, Italian indicators)
4. Default: English

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
- **Google Fonts Integration** - Industry-specific font pairings (NEW)
- **Layout Variants** - Visual diversity with different layouts (NEW)

### Google Fonts Integration (NEW)

5 curated font pairings automatically selected by industry:

| Style | Heading Font | Body Font | Industries |
|-------|--------------|-----------|------------|
| Modern | Inter | Inter | General |
| Elegant | Playfair Display | Source Sans Pro | Lawyers |
| Bold | Bebas Neue | Open Sans | Plumbers, Electricians, Home Services |
| Friendly | Nunito | Nunito | Restaurants, Retail |
| Professional | Montserrat | Roboto | Dentists, Real Estate |

### Layout Variants (NEW)

4 distinct visual styles for design variety:

| Variant | Hero Layout | Card Style | Color Intensity | Industries |
|---------|-------------|------------|-----------------|------------|
| Classic | Split (text + image) | Elevated shadows | Normal | Retail, Home Services |
| Minimal | Centered | Flat with borders | Muted | Dentists, Real Estate |
| Bold | Fullwidth with overlay | Solid background | Vibrant | Restaurants, Plumbers, Electricians |
| Elegant | Asymmetric offset | Outlined | Refined | Lawyers |

**Variant Features:**
- **Section Spacing**: Compact (3rem), Normal (5rem), Relaxed (6rem), Luxurious (8rem)
- **Border Radius**: Sharp (0.25rem), Subtle (0.5rem), Rounded (1rem)
- **Hero Background**: Fullwidth variants use hero image as background with gradient overlay

### Industry Configurations

Each industry has a `template.json` defining:
- Keywords for detection
- Slot mappings (source paths + fallbacks)
- AI enhancement preferences
- Custom styling hints

**Supported Industries:**
- `plumber` - Bold variant, bold fonts
- `electrician` - Bold variant, bold fonts
- `restaurant` - Bold variant, friendly fonts
- `lawyer` - Elegant variant, elegant fonts
- `real-estate` - Minimal variant, professional fonts
- `retail` - Classic variant, friendly fonts
- `home-services` - Classic variant, bold fonts
- `dentist` - Minimal variant, professional fonts
- `general` - Classic variant, modern fonts

### Template Structure

```
templates/
├── base/
│   ├── styles.css         # Base CSS with CSS variables
│   └── components/
│       ├── header.html
│       ├── hero.html
│       ├── services-grid.html
│       ├── why-us.html
│       ├── testimonials.html
│       ├── cta-banner.html
│       ├── contact-section.html
│       └── footer.html
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
4. **Content Generation** - Generate missing content when scraped content is weak (NEW)
5. **Testimonial Generation** - Create realistic testimonials when none found (NEW)

### Content Generation (NEW)

When scraped content is "weak", the AI generates missing pieces:

**Weakness Detection** (`needsContentGeneration()`):
- Headline < 20 characters
- Subheadline < 30 characters
- No testimonials found
- No services found
- Triggers when 2+ of these are true

**Generated Content:**
- Headline (punchy, benefit-focused, max 10 words)
- Subheadline (supports headline, max 25 words)
- CTA text (action-oriented, max 4 words)
- Why Us points (4 unique selling points)
- Meta description (SEO-optimized, max 155 chars)
- Testimonials (3 realistic customer reviews)

### Industry Content Database (NEW)

Pre-built content for fallbacks and AI prompting (`src/industryContent.js`):

| Industry | Pain Points | Benefits | USPs | CTA Options |
|----------|-------------|----------|------|-------------|
| Plumber | Emergency leaks, Hidden fees | Same-day service, Upfront pricing | Licensed & Insured, 24/7 Emergency | Get a Free Quote, Call Now |
| Electrician | Fire hazards, Code issues | Code-compliant, Warranty | Fully Licensed, Code Compliant | Schedule Inspection |
| Restaurant | Boring takeout, No fresh options | Fresh ingredients, Family recipes | Fresh Daily, Catering Available | View Menu, Book a Table |
| Lawyer | Confusing legal process | Clear communication, Free consult | Free Consultation, No Win No Fee | Get Legal Help |
| And more... | | | | |

### Testimonial Generation (NEW)

AI-generated testimonials when none are scraped:

- **Contextual**: Mentions actual services and location
- **Varied Length**: One short, one medium, one longer
- **Authentic Tones**: Relieved, grateful, impressed (industry-specific)
- **Realistic Names**: Region-appropriate first names
- **Star Ratings**: Always 5 stars

### Slot-Specific Prompts

| Slot | Guidelines |
|------|------------|
| Headline | Punchy, benefit-driven, max 10 words |
| Subheadline | Supports headline, core value prop, max 25 words |
| Service Description | Benefit-focused, concise, max 20 words |
| CTA Text | Action-oriented, creates urgency, max 4 words |
| About Text | Trust-building, warm, personal, max 60 words |
| Meta Description | SEO-friendly, click-worthy, max 155 chars |

### Multi-Language Support

Generates UI elements in detected language:
- English, Dutch, German, French, Spanish, Italian
- Navigation labels, buttons, form fields, section headings

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
- **Subject Line A/B Testing** - 4 variants randomly selected (NEW)
- **Follow-ups** - 3-stage sequence with different angles
- **HTML Formatting** - Styled email with CTA button
- **Before/After Screenshots** - Visual comparison embedded (NEW)
- **Dynamic Expiry Countdown** - Color-coded urgency display (NEW)

### Subject Line A/B Testing (NEW)

4 subject variants randomly assigned for testing:

| ID | Template |
|----|----------|
| A | "Your new {{businessName}} website" |
| B | "I rebuilt {{businessName}} (free preview)" |
| C | "{{businessName}} - thought you should see this" |
| D | "Quick question about {{businessName}}" |

### Before/After Screenshots (NEW)

Playwright-powered screenshot capture:
- Captures original site and rebuilt preview
- Side-by-side comparison embedded in email
- Mobile-width (375px) screenshots
- "Before" with subtle border, "After" with blue highlight

### Dynamic Expiry Countdown (NEW)

Color-coded urgency based on days remaining:

| Days Left | Color | Weight |
|-----------|-------|--------|
| ≤2 days | Red (#dc2626) | Bold |
| 3-5 days | Orange (#f59e0b) | Semi-bold |
| >5 days | Gray (#6b7280) | Normal |

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

### Email Queue System (NEW)

Emails can be queued for approval before sending:

1. **Queue Email** - `queueEmail(deployment, type, emailData)` creates draft
2. **Review Draft** - View pending emails in dashboard
3. **Approve** - Set status to "approved"
4. **Send** - `sendFromQueue(emailId)` sends approved email
5. **History** - Sent emails moved to history with success/failure status

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

Vue 3 web dashboard for managing leads and tracking conversions.

### Stats Overview

- Total leads
- Emailed count
- Responded count
- Converted count
- Conversion rate
- Total revenue
- Breakdown by industry

### Tabbed Interface (NEW)

3 main tabs for different workflows:

1. **Leads Tab** - Lead management and status tracking
2. **Deployments Tab** - View all deployed previews
3. **Emails Tab** - Email queue, drafts, and history

### Lead Management

- **Status Tracking**: Pending → Emailed → Responded → Converted → Expired
- **Search**: Filter by name, email, or industry
- **Status Filter**: View by status category
- **Preview Links**: Direct links to deployed sites
- **Notes**: Add notes to any deployment
- **Manual Email Send**: Trigger email from dashboard
- **Delete**: Remove deployment (optionally from Netlify too)

### Email Queue Interface (NEW)

- **Pending Drafts**: View emails awaiting approval
- **Email Preview**: See full email before sending
- **Approve/Reject**: One-click approval workflow
- **Sent History**: Track sent emails with delivery status

### New Lead Form

- URL validation
- Skip email option
- Real-time processing status

### Auto-Refresh

Dashboard refreshes data every 30 seconds.

---

## Preview Analytics

Track engagement and measure the effectiveness of generated previews with built-in analytics.

### Event Tracking

Analytics are automatically injected into all preview pages:

| Event Type | What It Tracks |
|------------|----------------|
| `pageview` | Page loads with referrer |
| `scroll` | Scroll depth milestones (25%, 50%, 75%, 100%) |
| `click` | CTA buttons, phone links, email links, navigation |
| `form` | Contact form focus and submission |
| `time` | Time spent on page (captured on exit) |

### Session Tracking

- **Unique Sessions** - Each visitor gets a session ID stored in sessionStorage
- **Session Format** - `sess_{timestamp}_{random}` for anonymity
- **Cross-Visit Tracking** - Sessions persist within browser tab lifetime

### Click Categories

| Category | Triggers |
|----------|----------|
| `phone` | Clicks on `tel:` links |
| `email` | Clicks on `mailto:` links |
| `cta` | Clicks on `.btn-primary`, `.header-cta` buttons |
| `nav` | Clicks on navigation links |

### Analytics Dashboard

The preview view displays real-time analytics:

- **Page Views** - Total page loads
- **Unique Sessions** - Distinct visitor sessions
- **Avg. Time on Page** - Mean engagement duration
- **CTA Clicks** - Primary action button clicks
- **Phone Clicks** - Phone number link clicks
- **Form Submissions** - Contact form completions
- **Scroll Depth** - Visual bars showing milestone completion rates

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/preview/:slug/event` | Record analytics event |
| GET | `/api/preview/:slug/analytics` | Get aggregated analytics |

### Event Payload

```javascript
{
  type: 'pageview' | 'scroll' | 'click' | 'form' | 'time',
  data: {
    // For scroll: { depth: 25 | 50 | 75 | 100 }
    // For click: { target: 'phone' | 'email' | 'cta' | 'nav', href?: string, text?: string }
    // For form: { action: 'focus' | 'submit' }
    // For time: { seconds: number }
    // For pageview: { referrer: string }
  },
  sessionId: 'sess_...'
}
```

### Analytics Aggregation

Returns computed metrics from stored events:

```javascript
{
  pageviews: number,
  uniqueSessions: number,
  avgTimeOnPage: number,       // In seconds
  scrollDepths: {
    '25': number,
    '50': number,
    '75': number,
    '100': number
  },
  clicks: {
    cta: number,
    phone: number,
    email: number,
    nav: number
  },
  formInteractions: {
    focused: number,
    submitted: number
  }
}
```

### Privacy-Conscious Design

- No cookies required
- No personally identifiable information collected
- Session IDs are random and anonymous
- Data stored only for preview duration (7 days default)

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

### Preview Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/preview/:slug/event` | Record analytics event |
| GET | `/api/preview/:slug/analytics` | Get aggregated analytics |

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
| `ANTHROPIC_API_KEY` | For AI | Claude API for AI copy enhancement |
| `NETLIFY_AUTH_TOKEN` | For deploy | Netlify deployment |
| `RESEND_API_KEY` | For email | Email sending via Resend |
| `FROM_EMAIL` | For email | Sender email address |
| `OUTSCRAPER_API_KEY` | For leads | Google Maps lead finding (option 1) |
| `GOOGLE_PLACES_API_KEY` | For leads | Google Places API (option 2) |
| `PAGESPEED_API_KEY` | Optional | PageSpeed Insights (free, key = higher quota) |
| `PORT` | No | Server port (default 3000) |
| `DB_PATH` | No | Database file path |
| `LOG_LEVEL` | No | Logging level (debug, info, warn, error) |

**Note:** The pipeline works with graceful degradation - missing API keys disable that feature but don't crash the system.

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
│   ├── cli.js            # CLI entry point
│   ├── server.js         # Express API server + error handling
│   ├── config.js         # Configuration + feature detection
│   ├── db.js             # Database + error logging
│   ├── logger.js         # Structured logging (pino)
│   ├── utils.js          # Utilities + validation
│   ├── scraper.js        # Playwright web scraping
│   ├── siteScorer.js     # Browser-based site scoring
│   ├── pageSpeedScorer.js # Google PageSpeed API integration
│   ├── leadFinder.js     # Outscraper API integration
│   ├── googlePlaces.js   # Google Places API integration
│   ├── leadQualifier.js  # Lead filtering & prioritization
│   ├── templateBuilder.js # Handlebars template system
│   ├── aiPolish.js       # Claude AI copy enhancement
│   ├── netlifyDeploy.js  # Netlify API integration
│   ├── emailGenerator.js # AI email content generation
│   ├── emailSender.js    # Resend API integration
│   ├── outreach.js       # Email campaign management
│   ├── pipeline.js       # Pipeline orchestration + graceful degradation
│   ├── batch.js          # Batch processing logic
│   └── index.js          # Module exports
├── dashboard/
│   └── src/
│       ├── App.vue       # Vue 3 dashboard
│       ├── api.js        # API client + helpers
│       └── main.js       # Vue app entry
├── netlify/
│   └── functions/
│       └── api.js        # Serverless API wrapper
├── templates/
│   ├── base/components/  # Reusable HTML components
│   └── industries/       # Industry-specific configs
├── tests/
│   ├── db.test.js        # Database tests
│   └── server.test.js    # API route tests
└── deployments.json      # Local database
```

---

## Integrations

| Service | Purpose | Required |
|---------|---------|----------|
| Anthropic Claude | AI copy enhancement & email generation | For AI features |
| Netlify | Preview site hosting | For deployment |
| Resend | Transactional email | For outreach |
| Outscraper | Google Maps lead data | For lead finding (option 1) |
| Google Places | Google Maps lead data | For lead finding (option 2) |
| Google PageSpeed | Lighthouse site scoring | Optional (free, higher quota with key) |
| Playwright | Browser automation | For scraping/scoring |

---

## Error Handling & Resilience

Built-in reliability features to keep the pipeline running smoothly.

### Graceful Degradation

The pipeline continues even when optional services are unavailable:

| Service | Behavior When Unavailable |
|---------|--------------------------|
| AI Polish | Skips enhancement, uses original text |
| Netlify Deploy | Logs error, continues to next lead |
| Email Sending | Skips outreach, deployment still saved |
| PageSpeed API | Falls back to browser-based scoring |

### Pipeline Error Tracking

Errors are logged to the database with full context:

```javascript
{
  id: string,        // Unique error ID
  url: string,       // URL being processed
  error: string,     // Error message
  stack: string,     // Full stack trace
  step: string,      // Pipeline step (scrape, build, polish, deploy, email)
  leadId: string,    // Associated lead ID (if any)
  createdAt: string  // ISO timestamp
}
```

**API Endpoint:** `GET /api/errors?limit=20` - View recent pipeline errors

### Feature Detection

At startup, the system detects available features based on API keys:

```javascript
{
  aiPolish: boolean,    // ANTHROPIC_API_KEY present
  deploy: boolean,      // NETLIFY_AUTH_TOKEN present
  email: boolean,       // RESEND_API_KEY + FROM_EMAIL present
  leadFinder: boolean,  // OUTSCRAPER_API_KEY present
  googlePlaces: boolean, // GOOGLE_PLACES_API_KEY present
  pageSpeed: boolean    // PAGESPEED_API_KEY present (optional)
}
```

### Input Validation

All API inputs are validated before processing:

- **URL Validation** - Protocol check, domain format, rejects localhost/IPs
- **Email Validation** - RFC 5322 compliant regex
- **Lead Data** - Required fields checked before pipeline

### Custom Error Classes

```javascript
ApiError.badRequest('Invalid URL format', 'INVALID_URL')
ApiError.notFound('Deployment not found')
```

### Async Route Handling

All routes use `asyncHandler()` wrapper to catch Promise rejections and forward to error middleware.
