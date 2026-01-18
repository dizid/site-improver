# Site Improver - Commercialization TODO

## Phase 0: Security (BLOCKING) - COMPLETED
- [x] Restrict CORS origins in server.js
- [x] Add 30s timeout to pipeline scraping
- [x] Fix fallback clichés in aiContentGenerator.js
- [x] Fix fallback clichés in smartFallbacks.js
- [x] Install auth and rate limiting packages
- [x] Create auth middleware (Clerk integration)
- [x] Add rate limiting middleware (tiered by endpoint)
- [x] Protect API routes with auth
- [x] Create audit logging system

## Phase 1: Monetization (Week 3-5) - BACKEND COMPLETE
- [ ] Set up Stripe account and get API keys
- [x] Create `src/billing/stripe.js` - Stripe SDK wrapper
- [x] Create `src/billing/subscriptions.js` - Subscription lifecycle
- [x] Create `src/billing/usage.js` - Usage tracking & metering
- [x] Create `src/billing/webhooks.js` - Stripe webhook handlers
- [x] Add quota enforcement middleware
- [x] Add billing routes to server.js
- [x] Add quota checks to pipeline endpoint
- [x] Add quota checks to discovery endpoint
- [x] Add quota checks to email endpoints
- [x] Set up spending caps and alerts
- [ ] Add billing section to Vue dashboard

### Pricing Tiers
| Tier | Price | Leads/mo | Pipeline runs | Emails |
|------|-------|----------|---------------|--------|
| Starter | $49 | 50 | 25 | 100 |
| Growth | $149 | 200 | 100 | 500 |
| Agency | $399 | Unlimited | 500 | 2000 |

## Phase 2: Multi-Tenancy (Week 6-8) - BACKEND COMPLETE
- [x] Add `tenantId` field to all database records
- [x] Update all db.js query functions to filter by tenantId
- [x] Create `tenants` collection schema
- [x] Create `users` collection schema
- [x] Create `invitations` collection schema
- [x] Implement user registration flow
- [x] Implement team invitation flow
- [x] Add role-based permissions (owner, admin, member, viewer)
- [ ] Update dashboard for team management

## Phase 3: Quality Improvements (Week 9-11)
- [x] Improve services extraction in scraperLite.js
  - [x] Extract from pricing tables
  - [x] Extract from button/CTA text
  - [x] Extract from bullet point lists
  - [x] Extract from navigation menus
- [x] Stricter preview validation
  - [x] Block previews with clichés in headline
  - [x] Block placeholder business names
  - [x] Add broken image detection
- [x] Image optimization
  - [x] Create `src/imageOptimizer.js`
  - [x] Integrate Cloudinary or Imgix CDN
  - [x] Resize to max 1200px width
  - [x] Convert to WebP
  - [x] Add lazy loading

## Phase 4: Email System Enhancements (Week 12-13)
- [ ] Add email rendering preview modal to dashboard
- [x] Implement Resend webhook endpoint for bounce/delivery tracking
- [ ] Make follow-up sequences customizable (database-driven)
- [x] Add approval audit trail fields (approvedBy, approvedAt, sentBy)
- [x] Track email open rates per subject line variant

## Phase 5: Template Expansion (Week 14-16)
- [ ] Add new layouts
  - [ ] `magazine` - Multi-column, editorial feel
  - [ ] `portfolio` - Gallery-focused
  - [ ] `landing` - Single-page conversion focus
  - [ ] `directory` - Multiple location support
- [ ] Add new sections
  - [ ] `team.hbs` - Team member grid
  - [ ] `gallery.hbs` - Image gallery
  - [ ] `pricing.hbs` - Pricing table
  - [ ] `faq.hbs` - FAQ accordion
  - [ ] `locations.hbs` - Multi-location map
- [ ] Implement section customization (reorder/hide sections)

## Phase 6: Monitoring & Error Reporting (Week 17-18)
- [ ] Integrate Sentry for error tracking
  - [ ] Add to pipeline.js
  - [ ] Add to server.js
  - [ ] Add to Vue dashboard
- [ ] Set up operational monitoring (Prometheus/Grafana or Datadog)
- [ ] Add security tests
  - [ ] `tests/security/auth.test.js`
  - [ ] `tests/security/authorization.test.js`
  - [ ] `tests/security/rateLimit.test.js`
  - [ ] `tests/security/injection.test.js`

---

## Environment Variables Needed

### Already Required
- `ANTHROPIC_API_KEY` - Claude AI
- `NETLIFY_AUTH_TOKEN` - Netlify deploys

### For Security (Phase 0)
- `CLERK_SECRET_KEY` - Clerk authentication
- `CLERK_PUBLISHABLE_KEY` - Clerk frontend
- `CORS_ORIGINS` - Production URLs (comma-separated)

### For Billing (Phase 1)
- `STRIPE_SECRET_KEY` - Stripe API
- `STRIPE_PUBLISHABLE_KEY` - Stripe frontend
- `STRIPE_WEBHOOK_SECRET` - Webhook verification

### For Monitoring (Phase 6)
- `SENTRY_DSN` - Sentry error tracking

---

## Timeline Summary

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 0: Security | 2 weeks | COMPLETED |
| Phase 1: Billing | 3 weeks | BACKEND COMPLETE |
| Phase 2: Multi-tenancy | 3 weeks | BACKEND COMPLETE |
| Phase 3: Quality | 3 weeks | COMPLETED |
| Phase 4: Email | 2 weeks | Not started |
| Phase 5: Templates | 3 weeks | Not started |
| Phase 6: Monitoring | 2 weeks | Not started |

**MVP for first paying customer: Phases 0-2 (8 weeks)**
**Full commercial product: All phases (18 weeks)**
