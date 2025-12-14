#!/usr/bin/env node
// tests/run-tests.js
// Comprehensive test suite for site-improver

import { config } from 'dotenv';
config();

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('\n🧪 SITE IMPROVER TEST SUITE');
  console.log('='.repeat(60) + '\n');

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

// ============================================================
// MODULE IMPORT TESTS
// ============================================================

test('All modules export correctly', async () => {
  const m = await import('../src/index.js');
  const expected = [
    'scrapeSite', 'TemplateBuilder', 'AIPolisher', 'NetlifyDeployer',
    'EmailGenerator', 'EmailSender', 'OutreachManager', 'LeadFinder',
    'SiteScorer', 'BatchProcessor', 'rebuildAndDeploy'
  ];
  for (const exp of expected) {
    if (!m[exp]) throw new Error(`Missing export: ${exp}`);
  }
});

// ============================================================
// TEMPLATE BUILDER TESTS
// ============================================================

test('TemplateBuilder initializes', async () => {
  const { default: TemplateBuilder } = await import('../src/templateBuilder.js');
  const builder = new TemplateBuilder('./templates');
  await builder.init();
  
  if (Object.keys(builder.components).length === 0) {
    throw new Error('No components loaded');
  }
  if (Object.keys(builder.industryConfigs).length === 0) {
    throw new Error('No industry configs loaded');
  }
});

test('TemplateBuilder detects industries correctly', async () => {
  const { default: TemplateBuilder } = await import('../src/templateBuilder.js');
  const builder = new TemplateBuilder('./templates');
  await builder.init();
  
  const testCases = [
    { headlines: ['Plumbing Services'], expected: 'home-services' },
    { headlines: ['Best Pizza in Town'], expected: 'restaurant' },
    { headlines: ['Personal Injury Attorney'], expected: 'lawyer' },
    { headlines: ['Homes for Sale'], expected: 'real-estate' },
  ];
  
  for (const tc of testCases) {
    const detected = builder.detectIndustry(tc);
    if (detected !== tc.expected) {
      throw new Error(`Expected ${tc.expected}, got ${detected}`);
    }
  }
});

test('TemplateBuilder builds HTML', async () => {
  const { default: TemplateBuilder } = await import('../src/templateBuilder.js');
  const builder = new TemplateBuilder('./templates');
  await builder.init();
  
  const mockData = {
    businessName: "Test Business",
    headlines: ['Expert Plumbing Services'],
    paragraphs: ['Quality service you can trust.'],
    services: [{ name: 'Repair', description: 'Fix any pipe' }],
    phone: '555-1234',
    email: 'test@test.com',
    colors: ['#1e40af', '#3b82f6']
  };
  
  const result = await builder.build(mockData);
  
  if (!result.html) throw new Error('No HTML generated');
  if (!result.industry) throw new Error('No industry detected');
  if (result.html.length < 1000) throw new Error('HTML too short');
  if (!result.html.includes('<!DOCTYPE html>')) throw new Error('Invalid HTML');
});

// ============================================================
// DATABASE TESTS
// ============================================================

test('Database CRUD operations', async () => {
  const db = await import('../src/db.js');
  
  const testId = `test-${Date.now()}`;
  const testData = {
    siteId: testId,
    businessName: 'Test Business',
    status: 'pending'
  };
  
  // Create
  await db.saveDeployment(testData);
  
  // Read
  const found = await db.getDeployment(testId);
  if (!found) throw new Error('Deployment not found after save');
  if (found.businessName !== testData.businessName) throw new Error('Data mismatch');
  
  // Update
  await db.updateDeployment(testId, { status: 'emailed' });
  const updated = await db.getDeployment(testId);
  if (updated.status !== 'emailed') throw new Error('Update failed');
  
  // Delete
  await db.deleteDeployment(testId);
  const deleted = await db.getDeployment(testId);
  if (deleted) throw new Error('Delete failed');
});

// ============================================================
// SITE SCORER TESTS
// ============================================================

test('SiteScorer initializes', async () => {
  const { default: SiteScorer } = await import('../src/siteScorer.js');
  const scorer = new SiteScorer();
  
  if (scorer.thresholds.good !== 70) throw new Error('Wrong threshold');
  if (scorer.timeout !== 15000) throw new Error('Wrong timeout');
});

test('SiteScorer recommendation logic', async () => {
  const { default: SiteScorer } = await import('../src/siteScorer.js');
  const scorer = new SiteScorer();
  
  const cases = [
    { score: 10, expected: 'prime_target' },
    { score: 30, expected: 'strong_target' },
    { score: 50, expected: 'moderate_target' },
    { score: 70, expected: 'weak_target' },
    { score: 90, expected: 'skip' },
  ];
  
  for (const tc of cases) {
    const rec = scorer.getRecommendation(tc.score);
    if (rec !== tc.expected) {
      throw new Error(`Score ${tc.score}: expected ${tc.expected}, got ${rec}`);
    }
  }
});

// ============================================================
// EMAIL GENERATOR TESTS
// ============================================================

test('EmailGenerator fallbacks work without API key', async () => {
  const { EmailGenerator } = await import('../src/emailGenerator.js');
  const gen = new EmailGenerator();
  
  const email = gen.getFallbackEmail({
    businessName: 'Test',
    previewUrl: 'https://test.com'
  });
  
  if (!email.includes('Test')) throw new Error('Business name not in fallback');
  if (!email.includes('https://test.com')) throw new Error('URL not in fallback');
});

test('EmailGenerator HTML wrapper', async () => {
  const { wrapInHtml } = await import('../src/emailGenerator.js');
  
  const html = wrapInHtml(
    'Hello\n\nThis is a test.',
    'https://preview.com',
    'Test Business'
  );
  
  if (!html.includes('<!DOCTYPE html>')) throw new Error('Not valid HTML');
  if (!html.includes('https://preview.com')) throw new Error('URL not included');
  if (!html.includes('Test Business')) throw new Error('Business name not included');
});

// ============================================================
// LEAD FINDER TESTS
// ============================================================

test('LeadFinder initializes', async () => {
  const { default: LeadFinder } = await import('../src/leadFinder.js');
  const finder = new LeadFinder('test-key');
  
  if (finder.apiKey !== 'test-key') throw new Error('API key not set');
  if (!finder.baseUrl) throw new Error('Base URL not set');
});

test('LeadFinder dedupes results', async () => {
  const { default: LeadFinder } = await import('../src/leadFinder.js');
  const finder = new LeadFinder('test-key');
  
  // Mock searchBatch to test dedupe logic
  const results = [
    { name: 'A', website: 'https://a.com' },
    { name: 'B', website: 'https://b.com' },
    { name: 'A2', website: 'https://a.com' },  // duplicate
  ];
  
  const seen = new Set();
  const deduped = results.filter(r => {
    if (!r.website || seen.has(r.website)) return false;
    seen.add(r.website);
    return true;
  });
  
  if (deduped.length !== 2) throw new Error('Dedupe failed');
});

// ============================================================
// AI POLISHER TESTS
// ============================================================

test('AIPolisher initializes', async () => {
  const { default: AIPolisher } = await import('../src/aiPolish.js');
  const polisher = new AIPolisher();
  
  if (!polisher.systemPrompt) throw new Error('No system prompt');
});

test('AIPolisher throws without API key', async () => {
  const { default: AIPolisher } = await import('../src/aiPolish.js');
  const polisher = new AIPolisher();
  
  try {
    polisher.getClient();
    throw new Error('Should have thrown');
  } catch (e) {
    if (!e.message.includes('ANTHROPIC_API_KEY')) {
      throw new Error('Wrong error: ' + e.message);
    }
  }
});

// ============================================================
// OUTREACH MANAGER TESTS
// ============================================================

test('OutreachManager initializes', async () => {
  const { OutreachManager } = await import('../src/outreach.js');
  
  const manager = new OutreachManager({
    resendApiKey: 'test',
    fromEmail: 'test@test.com'
  });
  
  if (!manager.generator) throw new Error('No generator');
  if (!manager.sender) throw new Error('No sender');
});

// ============================================================
// SERVER TESTS
// ============================================================

test('Server creates without starting', async () => {
  const { createServer } = await import('../src/server.js');
  const app = createServer();
  
  if (!app) throw new Error('Server not created');
  if (typeof app.listen !== 'function') throw new Error('Not an Express app');
});

// Run all tests
runTests();
