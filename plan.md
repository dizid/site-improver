# Site Improver - Comprehensive Improvement Plan

## Overview
Two-track improvement plan:
- **Track A (Stability)**: Reliability, validation, error handling, code quality
- **Track B (Features)**: Lead discovery with Google Places & PageSpeed scoring

---

# Phased Improvements (2026)

## Phase 1: Foundation ✅ COMPLETE
**Delivered:**
- Mobile-first CSS rewrite (min-width queries, 5 breakpoints)
- Accessibility (lang, skip-link, ARIA, form labels)
- Netlify Forms with honeypot spam protection
- JSON-LD LocalBusiness structured data
- Scroll animations with prefers-reduced-motion
- Mobile hamburger menu with keyboard support
- XSS protection in JSON-LD

## Phase 2: Conversion Power ✅ COMPLETE
**Delivered:**
- Open Graph & Twitter Card meta tags
- Trust signal extraction (years in business, certifications, customer counts)
- Cliché detection and content quality validation
- Enhanced AI prompts with trust signals
- Service area extraction
- Canonical URLs and theme-color meta

## Phase 3: Performance & Polish ✅ COMPLETE
**Delivered:**
- CSS optimization (minification, critical path)
- Responsive images (srcset, lazy loading)
- Font optimization (font-display: swap)
- Modern CSS features (container queries, scroll-snap)
- Lighthouse scores 90+

## Phase 4: Product Intelligence ✅ COMPLETE
**Delivered:**
- Preview analytics tracking (pageviews, scroll depth, clicks, time on page)
- Session-based unique visitor tracking
- CTA click categorization (phone, email, cta, nav)
- Form interaction tracking (focus, submit)
- Analytics dashboard in PreviewView.vue
- API endpoints: POST `/api/preview/:slug/event`, GET `/api/preview/:slug/analytics`
- Privacy-conscious design (no cookies, anonymous session IDs)

### Files Modified (Phase 4):
- `src/db.js` - Added `recordAnalyticsEvent()`, `getPreviewAnalytics()`
- `src/server.js` - Added analytics API endpoints
- `src/templateBuilder.js` - Added `getAnalyticsScript()` injected into previews
- `dashboard/src/views/PreviewView.vue` - Added analytics panel UI

## Phase 5: Scale & Expansion ⏳ PLANNED
**Planned:**
- More industries (SaaS, Healthcare, Fitness, E-commerce, Non-profit)
- More section types (FAQ, pricing tables, timeline, team grid, gallery)
- Webhook integrations (Slack, Zapier, CRM)
- Domain management and custom domain setup

---

# Completed Work (2025-12-25)

## Google API Integration
- **Google Places API**: Fully implemented, wired as alternative lead source with auto-fallback
- **PageSpeed API**: Already implemented, uses hybrid scoring (API + browser fallback)
- **Lead Source Factory**: Created `src/leadSource.js` with auto-selection logic
- Added `source` field to both Outscraper and Google Places lead data

### Files Modified/Created:
- `src/leadSource.js` - NEW: Factory for lead finder selection
- `src/batch.js` - Uses lead source factory
- `src/leadFinder.js` - Added `source: 'outscraper'` field
- `src/config.js` - Added `LEAD_SOURCE` env var
- `tests/leadSource.test.js` - NEW: 13 tests for lead source factory

### Configuration:
```bash
PAGESPEED_API_KEY=AIza...     # Free, 25k/day
GOOGLE_PLACES_API_KEY=AIza... # ~$32/1000
LEAD_SOURCE=auto              # 'outscraper', 'googlePlaces', or 'auto'
```

## Dashboard Improvements
- **Fixed white-on-white text bug** in Process Website section
- **Professional business redesign**: Cleaner colors, no emojis, uppercase section headers
- **Added pipeline progress bar**: Shows Scraping → Building → Deploying → Complete stages
- **Added error logging** to pipeline saveDeployment call

### Files Modified:
- `dashboard/src/App.vue` - Progress bar, professional styling
- `dashboard/src/styles.css` - Business theme colors

## Known Issue (TODO)
- Deployments not being saved to local JSON database after pipeline completion
- Added error logging to diagnose - needs further investigation

---

# Track A: Stability & Code Quality

## A1: Foundation - Validation & Configuration

### A1.1 Startup Environment Validation
**Files:** `src/server.js`, `src/config.js`
- Call existing `validateEnv()` at startup (currently unused)
- Add feature flags based on available API keys
- Exit gracefully with clear errors if critical vars missing
- Log warnings for optional missing vars

### A1.2 URL Validation
**Files:** `src/utils.js`, `src/server.js`
- Add `validateUrl()` function (protocol, domain format, optional DNS check)
- Use in POST `/api/pipeline` and POST `/api/leads` routes

### A1.3 Email Validation
**Files:** `src/utils.js`, `src/emailSender.js`, `src/outreach.js`
- Add `validateEmail()` function with robust regex
- Validate before sending to Resend API

---

## A2: Error Handling & Resilience

### A2.1 Background Pipeline Error Tracking
**Files:** `src/server.js`, `src/db.js`, `src/pipeline.js`
- Add `pipelineErrors` collection to database
- Create `db.logPipelineError()` function
- Update lead status to 'error' on failure
- Add step tracking in pipeline.js

### A2.2 Graceful Degradation
**Files:** `src/pipeline.js`, `src/aiPolish.js`
- Wrap optional services (AI polish, Netlify, email) with availability checks
- Continue pipeline when optional services unavailable
- Log warnings instead of crashing

### A2.3 Error Middleware
**Files:** `src/server.js`
- Create `asyncHandler()` wrapper for routes
- Add centralized error middleware
- Create custom error classes with status codes

---

## A3: Input Validation Middleware
**Files:** Create `src/validators.js`, modify `src/server.js`
- Create lightweight validation schemas for each route
- Create `validateBody()` middleware
- Apply to all POST/PATCH routes

---

## A4: Logging Cleanup
**Files:** `src/cli.js` (49), `src/batch.js` (38), `dashboard/src/api.js` (6)
- Import existing logger from `src/logger.js`
- Replace console.log → log.info, console.error → log.error
- Create lightweight frontend logger for dashboard

---

## A5: Vue Component Extraction

### A5.1 StatsGrid Component
**Create:** `dashboard/src/components/StatsGrid.vue`
- Props: `stats` object

### A5.2 PipelineView Component
**Create:** `dashboard/src/components/PipelineView.vue`
- Props: `stages`, Emits: `select-lead`, `refresh`

### A5.3 LeadsTable Component
**Create:** `dashboard/src/components/LeadsTable.vue`
- Props: `leads`, `loading`, `filter`, `search`
- Emits: `status-change`, `send-email`, `delete`, `refresh`

### A5.4 AddLeadForm Component
**Create:** `dashboard/src/components/AddLeadForm.vue`
- Emits: `submit`

---

## A6: Test Coverage Expansion

### A6.1 Pipeline Tests
**Create:** `tests/pipeline.test.js`

### A6.2 API Route Tests
**Modify:** `tests/server.test.js`

### A6.3 Outreach/Email Tests
**Create:** `tests/outreach.test.js`, `tests/emailSender.test.js`

---

## A7: Code Deduplication

### A7.1 Email Configuration Helper
**Create:** `src/emailConfig.js`

### A7.2 Service Layer Extraction
**Create:** `src/services/leadService.js`, `src/services/deploymentService.js`

---

# Track B: Lead Discovery & Site Scoring

## B1: Google Places Client
**Create:** `src/googlePlaces.js`
```javascript
export class GooglePlacesLeadFinder {
  constructor(apiKey)
  async search(query, location, options)      // Text Search API
  async searchBatch(searches)                  // Multi-query with rate limiting
  async searchIndustry(industry, regions)      // Industry + regions combo
  extractBusinessData(place)                   // Map to lead format
}
```
**API**: `https://places.googleapis.com/v1/places:searchText`
**Auth**: `X-Goog-Api-Key` header

---

## B2: PageSpeed Scorer
**Create:** `src/pageSpeedScorer.js`
```javascript
export class PageSpeedScorer {
  constructor(apiKey)
  async analyze(url, strategy)     // 'mobile' or 'desktop'
  async analyzeAll(url)            // Both strategies
  extractMetrics(result)           // Lighthouse scores + Core Web Vitals
  calculateOverallScore(metrics)   // Weighted average
}
```
**API**: `https://www.googleapis.com/pagespeedonline/v5/runPagespeed`
**Metrics**: Performance, Accessibility, Best Practices, SEO (0-100 each)

---

## B3: Lead Qualifier
**Create:** `src/leadQualifier.js`
```javascript
export class LeadQualifier {
  constructor(options)
  qualify(lead, siteScore)         // Returns qualification result
  qualifyBatch(leads)              // Batch with sorting by priority
  validateBusiness(lead)           // Has website, not social media
  validateContact(lead)            // Has email or phone
  validateMarket(lead)             // Is in NL or UK
}
```
**Classifications**: prime_target (<40), target (<60), weak_target (<80), skip (>=80)

---

## B4: Config Updates
**Modify:** `src/config.js`
```javascript
// Target markets
markets: {
  NL: { regions: ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven'] },
  UK: { regions: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow'] }
},

// Industries (all current templates)
industries: {
  plumber: ['plumber', 'loodgieter'],
  electrician: ['electrician', 'elektricien'],
  // ... etc
},

// Qualification thresholds
qualification: {
  primeTarget: 40, target: 60, weakTarget: 80
}
```

---

## B5: SiteScorer Enhancement
**Modify:** `src/siteScorer.js`
- Add PageSpeed as optional enhancement with fallback to browser-based scoring

---

## B6: Tests for Track B
**Create:** `tests/googlePlaces.test.js`, `tests/pageSpeedScorer.test.js`, `tests/leadQualifier.test.js`

---

# Implementation Order

## Recommended Sequence

| Order | Task | Track | Impact |
|-------|------|-------|--------|
| 1 | A1.1 Startup validation | Stability | Prevents crashes |
| 2 | A1.2 URL validation | Stability | Prevents bad data |
| 3 | A2.1 Pipeline error tracking | Stability | Stops silent failures |
| 4 | A2.2 Graceful degradation | Stability | Resilience |
| 5 | A4 Logging cleanup | Stability | Observability |
| 6 | B1 Google Places | Features | Lead discovery |
| 7 | B2 PageSpeed Scorer | Features | Better scoring |
| 8 | B3 Lead Qualifier | Features | Automation |
| 9 | A5 Vue components | Quality | Maintainability |
| 10 | A6 + B6 Tests | Quality | Confidence |

**Rationale**: Stability first ensures new features work reliably.

---

# Critical Files Summary

| File | Changes |
|------|---------|
| `src/server.js` | Validation, error middleware |
| `src/config.js` | validateEnv(), markets, industries |
| `src/utils.js` | validateUrl(), validateEmail() |
| `src/pipeline.js` | Error tracking, graceful degradation |
| `src/db.js` | Error logging functions |
| `src/siteScorer.js` | PageSpeed integration |
| `dashboard/src/App.vue` | Split into 4 components |

---

# Quick Wins
1. Call existing `validateEnv()` at startup (unused code exists)
2. Replace console.log with existing logger
3. Add URL validation (pattern exists in frontend api.js)

---

# API Costs (Track B)

| API | Cost |
|-----|------|
| Google Places Text Search | $32/1000 requests |
| PageSpeed Insights | Free (with key: higher quota) |
