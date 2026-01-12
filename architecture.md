# Site Improver - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SITE IMPROVER                                  │
│                                                                          │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│   │   Dashboard  │     │   Express    │     │   Netlify    │            │
│   │   (Vue 3)    │────▶│   Server     │────▶│   Functions  │            │
│   │   :5173      │     │   :3000      │     │   Serverless │            │
│   └──────────────┘     └──────────────┘     └──────────────┘            │
│                               │                                          │
│                               ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                        PIPELINE                                   │   │
│   │                                                                   │   │
│   │   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐         │   │
│   │   │ Scrape  │──▶│  Build  │──▶│ Polish  │──▶│ Deploy  │         │   │
│   │   │Firecrawl│   │Template │   │  AI     │   │ Netlify │         │   │
│   │   └─────────┘   └─────────┘   └─────────┘   └─────────┘         │   │
│   │        │              │             │             │              │   │
│   │        ▼              ▼             ▼             ▼              │   │
│   │   ┌─────────────────────────────────────────────────────────┐   │   │
│   │   │                    DATABASE                              │   │   │
│   │   │         (JSON file or Firebase Firestore)               │   │   │
│   │   └─────────────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
site-improver/
├── src/                          # Core application code
│   ├── pipeline.js               # Main orchestration
│   ├── scraperLite.js            # Firecrawl + Cheerio scraping
│   ├── templateBuilder.js        # Handlebars template system
│   ├── aiPolish.js               # Claude AI enhancement
│   ├── netlifyDeploy.js          # Netlify deployment
│   ├── emailGenerator.js         # Cold email generation
│   ├── emailSender.js            # Resend API integration
│   ├── outreach.js               # Email queue management
│   ├── db.js                     # Database operations
│   ├── server.js                 # Express API server
│   ├── config.js                 # Configuration + feature flags
│   ├── logger.js                 # Pino structured logging
│   ├── utils.js                  # Utility functions
│   ├── imageService.js           # Unsplash/Pexels integration
│   ├── industryContent.js        # Industry-specific content
│   ├── screenshot.js             # Playwright screenshots
│   ├── leadSource.js             # Lead source factory
│   ├── leadFinder.js             # Outscraper integration
│   └── googlePlaces.js           # Google Places API
│
├── templates/                    # HTML templates
│   ├── base/
│   │   ├── styles.css            # Base CSS with variables
│   │   └── components/           # Handlebars partials
│   │       ├── header.html
│   │       ├── hero.html
│   │       ├── services-grid.html
│   │       ├── why-us.html
│   │       ├── testimonials.html
│   │       ├── cta-banner.html
│   │       ├── contact-section.html
│   │       └── footer.html
│   └── industries/               # Industry configs
│       ├── plumber/template.json
│       ├── restaurant/template.json
│       └── .../template.json
│
├── dashboard/                    # Vue 3 frontend
│   └── src/
│       ├── App.vue               # Main dashboard component
│       ├── api.js                # API client
│       └── main.js               # Vue entry point
│
├── netlify/                      # Serverless functions
│   └── functions/
│       └── api.js                # Express adapter
│
├── tests/                        # Vitest test suite
│   ├── db.test.js
│   ├── server.test.js
│   ├── templateBuilder.test.js
│   ├── config.test.js
│   ├── utils.test.js
│   └── leadSource.test.js
│
├── deployments.json              # Local database file
├── netlify.toml                  # Netlify configuration
├── package.json
└── vite.config.js
```

## Component Architecture

### 1. Pipeline Module (`src/pipeline.js`)

Central orchestrator that coordinates all processing steps:

```
rebuildAndDeploy(url, options)
    │
    ├─▶ Step 1: Scrape (scraperLite.js)
    │       └─▶ Firecrawl API → HTML + Markdown
    │       └─▶ Cheerio parsing → structured data
    │       └─▶ Schema.org extraction
    │
    ├─▶ Step 2: Image Selection (imageService.js)
    │       └─▶ Priority: og:image → extracted → stock → gradient
    │
    ├─▶ Step 3: Template Build (templateBuilder.js)
    │       └─▶ Detect industry
    │       └─▶ Map slots from siteData
    │       └─▶ Select fonts + variant
    │       └─▶ Render Handlebars components
    │
    ├─▶ Step 4: AI Polish (aiPolish.js)
    │       └─▶ Check if content is weak
    │       └─▶ Generate missing content
    │       └─▶ Polish all slots
    │
    ├─▶ Step 5: Generate HTML
    │       └─▶ Assemble final HTML with CSS
    │
    └─▶ Step 6: Deploy (netlifyDeploy.js)
            └─▶ Create Netlify site
            └─▶ Upload files
            └─▶ Return preview URL
```

### 2. Scraper Module (`src/scraperLite.js`)

Serverless-compatible content extraction:

```
scrapeSiteLite(url)
    │
    ├─▶ Firecrawl API → HTML
    │
    ├─▶ extractIdentity()     → logo, businessName, favicon
    ├─▶ extractContent()      → headlines, paragraphs, services
    ├─▶ extractTestimonials() → 6 detection strategies
    ├─▶ extractContact()      → phone, email, address, social
    ├─▶ extractMedia()        → images with filtering
    ├─▶ extractMeta()         → title, description, og:image
    ├─▶ extractStructuredData() → Schema.org JSON-LD
    ├─▶ extractColorsFromCSS()  → brand colors
    └─▶ detectLanguage()      → en, nl, de, fr, es, it
```

### 3. Template Module (`src/templateBuilder.js`)

Industry-specific site generation:

```
TemplateBuilder
    │
    ├─▶ init()
    │       └─▶ Load Handlebars components
    │       └─▶ Load industry configs
    │
    ├─▶ detectIndustry(siteData)
    │       └─▶ Match keywords to industry configs
    │
    ├─▶ build(siteData)
    │       └─▶ Map slots from siteData
    │       └─▶ Get font pairing
    │       └─▶ Get layout variant
    │       └─▶ Render components
    │
    └─▶ assembleHTML()
            └─▶ Google Fonts link
            └─▶ Base CSS + custom CSS + variant CSS
            └─▶ Rendered sections
```

### 4. AI Module (`src/aiPolish.js`)

Claude-powered content enhancement:

```
AIPolisher
    │
    ├─▶ needsContentGeneration(siteData, slots)
    │       └─▶ Check headline, subheadline, testimonials, services
    │
    ├─▶ generateMissingContent(siteData, slots)
    │       └─▶ Generate: headline, subheadline, cta, why_us, testimonials
    │
    ├─▶ polishAll(slots, siteData)
    │       └─▶ Polish each slot with specific prompts
    │
    └─▶ generateTestimonials(siteData)
            └─▶ Create 3 realistic testimonials
```

### 5. Database Module (`src/db.js`)

Dual-mode storage (JSON file or Firebase):

```
Database Operations
    │
    ├─▶ isFirebaseEnabled() → check credentials
    │
    ├─▶ Deployments
    │       ├─▶ saveDeployment()
    │       ├─▶ getDeployment(siteId)
    │       ├─▶ getDeployments(status?)
    │       ├─▶ updateDeployment(siteId, data)
    │       └─▶ deleteDeployment(siteId)
    │
    ├─▶ Leads
    │       ├─▶ saveLead()
    │       ├─▶ getLead(id)
    │       ├─▶ getLeadByUrl(url)
    │       └─▶ updateLead()
    │
    └─▶ Emails
            ├─▶ createEmailDraft()
            ├─▶ getEmailDraft(id)
            ├─▶ approveEmailDraft()
            └─▶ moveToHistory()
```

## Data Flow

### Lead Processing Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Outscraper │     │   Pipeline  │     │   Outreach  │
│  / Google   │────▶│   Process   │────▶│   Email     │
│  Places API │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────┐
│                    DATABASE                          │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │  Leads  │    │ Deployments │    │   Emails    │ │
│  │         │    │             │    │             │ │
│  │ new     │    │ pending     │    │ draft       │ │
│  │ process │───▶│ emailed     │───▶│ approved    │ │
│  │ done    │    │ responded   │    │ sent        │ │
│  │ failed  │    │ converted   │    │ failed      │ │
│  └─────────┘    └─────────────┘    └─────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Template Rendering Flow

```
┌───────────────────────────────────────────────────────────────┐
│                      SITE DATA                                 │
│  businessName, headlines, paragraphs, services, testimonials, │
│  phone, email, address, images, colors, industry, language    │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────┐
│                   INDUSTRY DETECTION                           │
│              Match keywords → plumber, lawyer, etc.           │
└───────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  FONT PAIRING   │  │ LAYOUT VARIANT  │  │  SLOT MAPPING   │
│                 │  │                 │  │                 │
│ modern          │  │ classic         │  │ headline        │
│ elegant         │  │ minimal         │  │ subheadline     │
│ bold            │  │ bold            │  │ cta_text        │
│ friendly        │  │ elegant         │  │ services        │
│ professional    │  │                 │  │ testimonials    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ▼
┌───────────────────────────────────────────────────────────────┐
│                    HTML GENERATION                             │
│  Google Fonts + Base CSS + Variant CSS + Rendered Components  │
└───────────────────────────────────────────────────────────────┘
```

## API Endpoints

### Express Server (`src/server.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/deployments` | List deployments (filterable) |
| GET | `/api/deployments/:siteId` | Get single deployment |
| PATCH | `/api/deployments/:siteId` | Update deployment |
| DELETE | `/api/deployments/:siteId` | Delete deployment |
| POST | `/api/pipeline` | Start pipeline for URL |
| POST | `/api/deployments/:siteId/send-email` | Send outreach |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/leads` | List leads |
| POST | `/api/leads` | Create lead |
| GET | `/api/emails/drafts` | List email drafts |
| POST | `/api/emails/:id/send` | Send approved email |
| GET | `/api/errors` | Recent pipeline errors |

## External Services

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                            │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Firecrawl  │  │   Claude    │  │   Netlify   │             │
│  │   (Scrape)  │  │    (AI)     │  │  (Deploy)   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Resend    │  │  Outscraper │  │  Unsplash/  │             │
│  │   (Email)   │  │   (Leads)   │  │   Pexels    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐                              │
│  │   Google    │  │  Firebase   │                              │
│  │   Places    │  │ (Optional)  │                              │
│  └─────────────┘  └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

## Deployment Architecture

### Development

```
┌─────────────┐     ┌─────────────┐
│   Vite      │     │   Express   │
│   :5173     │────▶│   :3000     │
│  (Vue HMR)  │     │  (API)      │
└─────────────┘     └─────────────┘
```

### Production (Netlify)

```
┌─────────────────────────────────────────────┐
│               NETLIFY                        │
│                                              │
│  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Static Build   │  │    Functions    │  │
│  │  (dashboard/)   │  │  /.netlify/     │  │
│  │                 │  │  functions/api  │  │
│  └─────────────────┘  └─────────────────┘  │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │     Preview Sites (Generated)        │    │
│  │  preview-{slug}-{hash}.netlify.app  │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## Error Handling

### Graceful Degradation

```
Feature Detection (config.js)
    │
    ├─▶ aiPolish: ANTHROPIC_API_KEY present?
    │       └─▶ No → Skip polish, use original text
    │
    ├─▶ deploy: NETLIFY_AUTH_TOKEN present?
    │       └─▶ No → Build HTML only
    │
    ├─▶ email: RESEND_API_KEY + FROM_EMAIL present?
    │       └─▶ No → Skip email sending
    │
    └─▶ images: UNSPLASH/PEXELS keys present?
            └─▶ No → Use CSS gradients
```

### Error Tracking

Pipeline errors are logged to database with:
- Error ID
- URL being processed
- Error message + stack
- Pipeline step (scrape, build, polish, deploy, email)
- Associated lead ID
- Timestamp
