# Site Improver - Future Improvements

Comprehensive planning document for future enhancements.

---

## 1. Payment Integration (Stripe)

### Goal
Enable direct payment collection from prospects, auto-mark conversions, and track revenue.

### Implementation Plan

#### 1.1 Setup
- Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to `.env.example`
- Install: `npm install stripe`
- Create `src/stripe.js` client wrapper

#### 1.2 Payment Link Generation
```
File: src/stripe.js
- createPaymentLink(deployment) -> generates Stripe Payment Link
- Include metadata: siteId, businessName, email
- Set success/cancel URLs back to dashboard
```

#### 1.3 Webhook Handler
```
File: src/server.js
POST /api/webhooks/stripe
- Verify webhook signature
- Handle 'checkout.session.completed' event
- Extract siteId from metadata
- Auto-call convert endpoint with amount
- Log payment to database
```

#### 1.4 Email Integration
```
File: src/emailGenerator.js
- Add payment link to outreach email template
- "Pay now and get your new site: [Payment Link]"
- Track click-through via Stripe dashboard
```

#### 1.5 Dashboard Updates
```
File: dashboard/src/App.vue
- Show payment link in lead actions
- Display revenue stats: total earned, avg deal size
- Payment status indicator (pending/paid)
```

#### 1.6 Database Schema
```javascript
// Add to lead/deployment:
{
  paymentLinkId: 'plink_xxx',
  paymentLinkUrl: 'https://buy.stripe.com/xxx',
  paymentStatus: 'pending' | 'paid' | 'failed',
  paymentAmount: 1000,
  paidAt: '2024-01-15T...',
  stripeCustomerId: 'cus_xxx'
}
```

### Files to Create/Modify
- `src/stripe.js` (new)
- `src/server.js` (add webhook endpoint)
- `src/emailGenerator.js` (add payment link)
- `src/db.js` (add payment fields)
- `dashboard/src/App.vue` (revenue stats)
- `.env.example` (add keys)

---

## 2. Automated Follow-up Sequences

### Goal
Automatically send follow-up emails at scheduled intervals to increase conversion.

### Implementation Plan

#### 2.1 Email Sequence Configuration
```javascript
// src/config.js
emailSequence: {
  followUp1: { days: 3, template: 'followup_gentle' },
  followUp2: { days: 7, template: 'followup_value' },
  followUp3: { days: 12, template: 'followup_urgency' },
  expire: { days: 14 }
}
```

#### 2.2 Scheduler Service
```
File: src/scheduler.js
- checkDueFollowUps() - query leads needing follow-up
- For each due lead:
  - Determine which follow-up (1, 2, or 3)
  - Send appropriate email
  - Update status: follow_up_1, follow_up_2, last_chance
- Run on interval (hourly) or via cron
```

#### 2.3 Follow-up Templates
```
File: src/emailTemplates/
- followup_gentle.js: "Just checking in..."
- followup_value.js: "Here's what you're missing..."
- followup_urgency.js: "Preview expires in 48 hours..."
```

#### 2.4 Status Flow
```
deployed -> emailing -> follow_up_1 -> follow_up_2 -> last_chance -> expired
                    \-> converted (at any point)
```

#### 2.5 CLI Command
```bash
npm run followups        # Process all due follow-ups
npm run followups:dry    # Preview what would be sent
```

#### 2.6 Dashboard Indicators
- Show follow-up stage in pipeline view
- "Next follow-up in X days" indicator
- Manual "Send follow-up now" button

### Files to Create/Modify
- `src/scheduler.js` (new)
- `src/emailTemplates/` (new directory)
- `src/config.js` (sequence config)
- `src/cli.js` (add command)
- `package.json` (add script)

---

## 3. Better Email Templates

### Goal
Increase open rates and conversions with personalized, compelling emails.

### Implementation Plan

#### 3.1 Industry-Specific Templates
```
templates/emails/
├── industries/
│   ├── restaurant.js
│   ├── plumber.js
│   ├── dentist.js
│   ├── lawyer.js
│   └── default.js
```

Each template includes:
- Industry-relevant pain points
- Specific benefits for their business type
- Appropriate tone (formal for lawyers, friendly for restaurants)

#### 3.2 Dynamic Content
```javascript
// Variables available in templates:
{
  businessName,
  ownerName,        // If detected from site
  industry,
  currentSiteScore, // PageSpeed score
  previewUrl,
  paymentLink,
  expiryDate,
  competitorCount,  // "47 other {industry} in {city} have modern sites"
}
```

#### 3.3 Subject Line A/B Testing
```javascript
// src/emailGenerator.js
subjectLines: {
  A: "Your new {businessName} website is ready",
  B: "I rebuilt {businessName}'s website (free preview)",
  C: "{ownerName}, your competitors are ahead"
}

// Track which performs best
selectSubject(deployment) {
  // Rotate or use ML-based selection
}
```

#### 3.4 Before/After Screenshots
```
File: src/screenshot.js
- captureScreenshot(url) -> Buffer
- Uses Playwright to capture viewport
- Save to Cloudinary or include as base64

Include in email:
- Original site screenshot (small, faded)
- New site screenshot (larger, vibrant)
- Side-by-side comparison
```

#### 3.5 Tracking Pixels
```javascript
// Track opens
<img src="https://yourserver.com/api/track/open/{emailId}" width="1" height="1" />

// Track clicks
All links go through: /api/track/click/{emailId}?url={actualUrl}
```

### Files to Create/Modify
- `templates/emails/` (new directory structure)
- `src/emailGenerator.js` (templating system)
- `src/screenshot.js` (new)
- `src/server.js` (tracking endpoints)
- `src/db.js` (email tracking fields)

---

## 4. Multi-page Sites

### Goal
Generate complete multi-page websites for higher perceived value and pricing.

### Implementation Plan

#### 4.1 Page Types
```
templates/pages/
├── home.html
├── about.html
├── services.html
├── contact.html
├── gallery.html (for visual businesses)
└── team.html (for professional services)
```

#### 4.2 Page Detection from Scraping
```javascript
// src/scraper.js additions
async scrapeAllPages(url) {
  const mainPage = await this.scrapePage(url);

  // Find internal links
  const internalLinks = mainPage.links.filter(isInternalLink);

  // Scrape key pages (about, services, contact)
  const pages = {
    home: mainPage,
    about: await this.findAndScrape(internalLinks, ['about', 'over-ons']),
    services: await this.findAndScrape(internalLinks, ['services', 'diensten']),
    contact: await this.findAndScrape(internalLinks, ['contact'])
  };

  return pages;
}
```

#### 4.3 Template Builder Updates
```javascript
// src/templateBuilder.js
async buildMultiPage(siteData) {
  const pages = {};

  pages['index.html'] = await this.buildPage('home', siteData);
  pages['about.html'] = await this.buildPage('about', siteData);
  pages['services.html'] = await this.buildPage('services', siteData);
  pages['contact.html'] = await this.buildPage('contact', siteData);

  return pages;
}
```

#### 4.4 Navigation Component
```html
<!-- templates/base/components/navigation.html -->
<nav class="main-nav">
  <a href="/" class="{{#if isHome}}active{{/if}}">Home</a>
  <a href="/about.html" class="{{#if isAbout}}active{{/if}}">About</a>
  <a href="/services.html" class="{{#if isServices}}active{{/if}}">Services</a>
  <a href="/contact.html" class="{{#if isContact}}active{{/if}}">Contact</a>
</nav>
```

#### 4.5 Netlify Deploy Updates
```javascript
// src/netlifyDeploy.js
async deployMultiPage(pages) {
  const files = {};
  for (const [filename, html] of Object.entries(pages)) {
    files[filename] = html;
  }
  return this.deploy(files);
}
```

### Files to Create/Modify
- `templates/pages/` (new directory)
- `src/scraper.js` (multi-page scraping)
- `src/templateBuilder.js` (multi-page building)
- `src/netlifyDeploy.js` (multi-file deploy)
- `src/pipeline.js` (orchestration)

---

## 5. Better Image Handling

### Goal
Improve visual quality of generated sites with better image handling.

### Implementation Plan

#### 5.1 Image Extraction Improvements
```javascript
// src/scraper.js
extractImages(page) {
  return {
    hero: findHeroImage(page),      // Largest above-fold image
    logo: findLogo(page),           // Site logo
    gallery: findGalleryImages(page), // Product/service images
    team: findTeamPhotos(page)      // Staff photos
  };
}
```

#### 5.2 Image Optimization
```javascript
// src/imageOptimizer.js
import sharp from 'sharp';

async optimizeImage(buffer, options = {}) {
  return sharp(buffer)
    .resize(options.width || 1200, options.height || 800, { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();
}
```

#### 5.3 Stock Photo Fallbacks
```javascript
// src/stockPhotos.js
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

async getIndustryPhoto(industry, type = 'hero') {
  const queries = {
    restaurant: 'restaurant interior food',
    plumber: 'plumbing professional tools',
    dentist: 'dental clinic modern',
    // ...
  };

  const response = await fetch(
    `https://api.unsplash.com/photos/random?query=${queries[industry]}`
  );
  return response.json();
}
```

#### 5.4 Image CDN Integration
```javascript
// Upload to Cloudinary for hosting
// src/imageCdn.js
import { v2 as cloudinary } from 'cloudinary';

async uploadImage(buffer, folder) {
  return cloudinary.uploader.upload(buffer, {
    folder: `site-improver/${folder}`,
    transformation: [
      { width: 1200, crop: 'limit' },
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ]
  });
}
```

#### 5.5 Lazy Loading in Templates
```html
<!-- Use native lazy loading -->
<img
  src="{{image.placeholder}}"
  data-src="{{image.full}}"
  loading="lazy"
  alt="{{image.alt}}"
/>
```

### Files to Create/Modify
- `src/imageOptimizer.js` (new)
- `src/stockPhotos.js` (new)
- `src/imageCdn.js` (new)
- `src/scraper.js` (better extraction)
- `templates/base/components/*.html` (lazy loading)
- `.env.example` (UNSPLASH_ACCESS_KEY, CLOUDINARY_*)

---

## 6. More Industry Templates

### Goal
Create specialized templates that resonate with specific industries.

### Implementation Plan

#### 6.1 Restaurant Template
```
templates/industries/restaurant/
├── template.json
├── components/
│   ├── menu-section.html     # Food menu display
│   ├── hours-widget.html     # Opening hours
│   ├── reservation-cta.html  # Book a table button
│   └── gallery-grid.html     # Food photos
```

Features:
- Menu display with categories
- Opening hours prominently displayed
- Reservation CTA (OpenTable, Resy integration)
- Photo gallery of dishes
- Location map

#### 6.2 Medical/Dental Template
```
templates/industries/medical/
├── template.json
├── components/
│   ├── services-accordion.html
│   ├── team-profiles.html
│   ├── appointment-cta.html
│   ├── insurance-logos.html
│   └── testimonials-slider.html
```

Features:
- Professional, trustworthy design
- Doctor/staff profiles with credentials
- Insurance accepted section
- Online appointment booking CTA
- Patient testimonials
- HIPAA compliance notice

#### 6.3 Legal Template
```
templates/industries/legal/
├── template.json
├── components/
│   ├── practice-areas.html
│   ├── attorney-profiles.html
│   ├── case-results.html
│   ├── consultation-cta.html
│   └── credentials-bar.html
```

Features:
- Formal, authoritative design
- Practice areas with descriptions
- Attorney profiles with education/bar admissions
- Case results/verdicts (if available)
- Free consultation CTA
- Awards and recognition

#### 6.4 Home Services Template
```
templates/industries/home-services/
├── template.json
├── components/
│   ├── service-cards.html
│   ├── service-area-map.html
│   ├── pricing-table.html
│   ├── emergency-banner.html
│   └── license-badges.html
```

Features:
- Emergency service banner
- Service area coverage
- Pricing transparency
- License/insurance badges
- Before/after gallery
- Quick quote form

#### 6.5 Template Selection Logic
```javascript
// src/templateBuilder.js
detectIndustry(siteData) {
  const text = getAllText(siteData).toLowerCase();

  const industryKeywords = {
    restaurant: ['menu', 'reservations', 'cuisine', 'dining', 'chef'],
    medical: ['doctor', 'patient', 'health', 'medical', 'clinic', 'dentist'],
    legal: ['attorney', 'lawyer', 'law firm', 'legal', 'practice areas'],
    homeServices: ['plumber', 'electrician', 'hvac', 'repair', 'emergency']
  };

  // Score each industry
  const scores = {};
  for (const [industry, keywords] of Object.entries(industryKeywords)) {
    scores[industry] = keywords.filter(kw => text.includes(kw)).length;
  }

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0][0];
}
```

### Files to Create
- `templates/industries/restaurant/` (full template)
- `templates/industries/medical/` (full template)
- `templates/industries/legal/` (full template)
- `templates/industries/home-services/` (full template)

---

## 7. Batch Processing UI

### Goal
Enable processing multiple leads at once from the dashboard.

### Implementation Plan

#### 7.1 Batch Selection UI
```html
<!-- dashboard/src/App.vue -->
<div class="batch-controls" v-if="selectedLeads.length > 0">
  <span>{{ selectedLeads.length }} selected</span>
  <button @click="batchProcess">Process All</button>
  <button @click="batchDelete">Delete All</button>
  <button @click="clearSelection">Clear</button>
</div>

<!-- Add checkboxes to lead rows -->
<input
  type="checkbox"
  v-model="selectedLeads"
  :value="lead.id"
/>
```

#### 7.2 Batch API Endpoint
```javascript
// src/server.js
POST /api/batch/process
Body: { leadIds: ['id1', 'id2', ...], options: { skipEmail: false } }

- Queue all leads for processing
- Return batch job ID
- Process in background with concurrency limit
```

#### 7.3 Batch Progress Tracking
```javascript
// src/batchProcessor.js
class BatchProcessor {
  async processBatch(leadIds, options) {
    const batchId = generateId();

    // Save batch job
    await db.saveBatchJob({
      id: batchId,
      totalLeads: leadIds.length,
      processed: 0,
      failed: 0,
      status: 'running'
    });

    // Process with concurrency
    const results = await pMap(leadIds, async (leadId) => {
      try {
        await this.processLead(leadId, options);
        await db.incrementBatchProgress(batchId, 'processed');
      } catch (error) {
        await db.incrementBatchProgress(batchId, 'failed');
      }
    }, { concurrency: CONFIG.batch.defaultConcurrency });

    await db.updateBatchJob(batchId, { status: 'complete' });
    return batchId;
  }
}
```

#### 7.4 Progress UI
```html
<div class="batch-progress" v-if="activeBatch">
  <div class="progress-bar">
    <div :style="{ width: batchProgress + '%' }"></div>
  </div>
  <span>{{ activeBatch.processed }} / {{ activeBatch.total }}</span>
  <span v-if="activeBatch.failed > 0" class="failed">
    {{ activeBatch.failed }} failed
  </span>
  <button @click="pauseBatch" v-if="activeBatch.status === 'running'">
    Pause
  </button>
  <button @click="resumeBatch" v-if="activeBatch.status === 'paused'">
    Resume
  </button>
</div>
```

#### 7.5 Pause/Resume Support
```javascript
// Batch job statuses: queued, running, paused, complete, failed

// Check pause flag before each lead
async processLead(leadId) {
  const batch = await db.getBatchJob(this.batchId);
  if (batch.status === 'paused') {
    throw new PausedException();
  }
  // Continue processing...
}
```

### Files to Create/Modify
- `src/batchProcessor.js` (new)
- `src/server.js` (batch endpoints)
- `src/db.js` (batch job storage)
- `dashboard/src/App.vue` (batch UI)

---

## 8. Analytics Dashboard

### Goal
Provide insights into funnel performance and business metrics.

### Implementation Plan

#### 8.1 Metrics to Track
```javascript
const metrics = {
  // Funnel metrics
  leadsDiscovered: 0,
  leadsQualified: 0,
  sitesDeployed: 0,
  emailsSent: 0,
  emailsOpened: 0,
  linksClicked: 0,
  conversions: 0,

  // Revenue metrics
  totalRevenue: 0,
  avgDealSize: 0,
  revenueThisMonth: 0,

  // Performance metrics
  avgBuildTime: 0,
  avgConversionTime: 0, // days from deploy to conversion

  // Quality metrics
  byIndustry: {},
  byLocation: {},
  conversionRateByIndustry: {}
};
```

#### 8.2 Analytics API
```javascript
// src/server.js
GET /api/analytics
Query params: ?from=2024-01-01&to=2024-01-31

Returns:
{
  funnel: {
    discovered: 150,
    qualified: 120,
    deployed: 100,
    emailed: 95,
    opened: 45,
    clicked: 30,
    converted: 12
  },
  revenue: {
    total: 12000,
    thisMonth: 3000,
    avgDeal: 1000
  },
  trends: [
    { date: '2024-01-01', leads: 5, conversions: 1, revenue: 1000 },
    // ...
  ]
}
```

#### 8.3 Dashboard Charts
```html
<!-- Using Chart.js or similar -->
<div class="analytics-grid">
  <div class="chart-card">
    <h3>Conversion Funnel</h3>
    <FunnelChart :data="funnelData" />
  </div>

  <div class="chart-card">
    <h3>Revenue Over Time</h3>
    <LineChart :data="revenueData" />
  </div>

  <div class="chart-card">
    <h3>Leads by Industry</h3>
    <PieChart :data="industryData" />
  </div>

  <div class="chart-card">
    <h3>Email Performance</h3>
    <BarChart :data="emailData" />
  </div>
</div>
```

#### 8.4 Email Tracking Implementation
```javascript
// src/server.js

// Track email opens (1x1 pixel)
GET /api/track/open/:emailId
- Log open event
- Return 1x1 transparent GIF

// Track link clicks
GET /api/track/click/:emailId
Query: ?url=https://preview.netlify.app/xxx
- Log click event
- Redirect to actual URL
```

#### 8.5 Real-time Updates
```javascript
// Use Server-Sent Events for live dashboard
GET /api/analytics/stream

// Push updates when:
// - New lead discovered
// - Site deployed
// - Email sent/opened/clicked
// - Conversion recorded
```

### Files to Create/Modify
- `src/analytics.js` (new - aggregation logic)
- `src/server.js` (analytics + tracking endpoints)
- `src/db.js` (analytics queries)
- `dashboard/src/components/Analytics.vue` (new)
- `dashboard/src/App.vue` (add analytics tab)

---

## Implementation Priority

| Priority | Feature | Impact | Effort | Revenue Impact |
|----------|---------|--------|--------|----------------|
| 1 | Automated Follow-ups | High | Medium | Direct |
| 2 | Payment Integration | High | Medium | Direct |
| 3 | Better Email Templates | High | Low | Direct |
| 4 | Batch Processing UI | Medium | Low | Indirect |
| 5 | Multi-page Sites | High | High | Pricing |
| 6 | Industry Templates | Medium | Medium | Conversion |
| 7 | Analytics Dashboard | Medium | Medium | Insights |
| 8 | Better Image Handling | Medium | Medium | Quality |

---

## Quick Wins (< 1 day each)

1. **Add subject line rotation** - A/B test in emailGenerator.js
2. **Screenshot in email** - Playwright capture, inline as base64
3. **Batch select UI** - Checkboxes + bulk actions
4. **Email open tracking** - 1x1 pixel + endpoint
5. **Expiry countdown** - Show "expires in X days" in emails

---

## Environment Variables Needed

```bash
# For Payment Integration
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# For Better Images
UNSPLASH_ACCESS_KEY=xxx
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

# For Analytics
# (No additional keys needed - uses existing data)
```
