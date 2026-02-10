// tests/contentValidator.enhanced.test.js
// Stress test cliché detection and content quality assessment
import { describe, it, expect } from 'vitest';
import {
  validateContent,
  validateHeadline,
  assessContentQuality,
  hasCliche,
  scoreCTAEffectiveness,
  checkEmotionalResonance,
  checkContentTemperature,
  calculateReadability
} from '../src/contentValidator.js';

describe('Content Validator - Enhanced Tests', () => {
  describe('Direct clichés caught', () => {
    it('catches "quality service"', () => {
      const result = validateContent('We offer quality service to all our customers');
      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.type === 'cliche' && i.text === 'quality service')).toBe(true);
    });

    it('catches "go above and beyond"', () => {
      const result = validateContent('We go above and beyond for every client');
      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.type === 'cliche' && i.text === 'go above and beyond')).toBe(true);
    });

    it('catches "second to none"', () => {
      const result = validateContent('Our quality is second to none in the industry');
      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.type === 'cliche' && i.text === 'second to none')).toBe(true);
    });

    it('catches "one-stop shop"', () => {
      const result = validateContent('Your one-stop shop for all plumbing needs');
      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.type === 'cliche' && i.text === 'one-stop shop')).toBe(true);
    });

    it('catches "pride ourselves"', () => {
      const result = validateContent('We pride ourselves on excellent customer service');
      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.type === 'cliche')).toBe(true);
    });
  });

  describe('Rephrased clichés caught', () => {
    it('catches pride variations', () => {
      const result = validateContent('We take pride in delivering exceptional results');
      expect(result.issues.some(i => i.type === 'cliche' || i.type === 'generic')).toBe(true);
    });

    it('catches generic quality claims', () => {
      const result = validateContent('Professional quality services you can trust');
      expect(result.issues.some(i => i.type === 'generic' || i.type === 'cliche')).toBe(true);
    });
  });

  describe('Pattern categories', () => {
    it('catches expertise claims', () => {
      const result = validateContent('Industry experts with unparalleled service');
      expect(result.issues.some(i => i.type === 'cliche' && i.text === 'industry experts')).toBe(true);
      expect(result.issues.some(i => i.type === 'cliche' && i.text === 'unparalleled service')).toBe(true);
    });

    it('catches quality claims', () => {
      const result = validateContent('World-class quality and top-notch service');
      expect(result.issues.some(i => i.type === 'cliche' && i.text === 'world-class')).toBe(true);
      expect(result.issues.some(i => i.type === 'cliche' && i.text === 'top-notch')).toBe(true);
    });

    it('catches customer focus clichés', () => {
      const result = validateContent('Customer satisfaction is our priority and we treat you like family');
      expect(result.issues.some(i => i.type === 'cliche')).toBe(true);
    });

    it('catches urgency clichés', () => {
      const result = validateContent('Act now! Limited time offer! Don\'t miss out!');
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('catches superlatives', () => {
      const result = validateContent('Simply the best, unmatched quality, best of the best');
      expect(result.issues.some(i => i.type === 'cliche')).toBe(true);
    });
  });

  describe('False positive test', () => {
    it('honest business descriptions should NOT be flagged', () => {
      const result = validateContent(
        'Denver Plumbing - We fix leaky faucets and broken pipes in the Denver metro area. Licensed plumbers available 24/7.',
        { businessName: 'Denver Plumbing', city: 'Denver' }
      );

      const highSeverityIssues = result.issues.filter(i => i.severity === 'high' || i.severity === 'critical');
      expect(highSeverityIssues.length).toBe(0);
      expect(result.score).toBeGreaterThan(70);
    });

    it('specific value propositions pass validation', () => {
      const result = validateContent(
        '15+ years serving Denver. Licensed & insured. Same-day emergency service. 500+ customers trust us.',
        { businessName: 'Test Plumbing', city: 'Denver' }
      );

      expect(result.score).toBeGreaterThan(80);
    });
  });

  describe('Catch rate test', () => {
    it('feeds 20+ known clichés through, verifies > 80% caught', () => {
      const knownCliches = [
        'quality service',
        'trusted partner',
        'one-stop shop',
        'second to none',
        'industry-leading',
        'world-class',
        'top-notch',
        'cutting-edge',
        'go above and beyond',
        'customer satisfaction guaranteed',
        'treat you like family',
        'exceed expectations',
        'hassle-free',
        'pride ourselves',
        'commitment to excellence',
        'dedicated team',
        'years of combined experience',
        'unparalleled service',
        'best in class',
        'you can count on us',
        'look no further',
        'next level'
      ];

      let caughtCount = 0;
      knownCliches.forEach(cliche => {
        const result = hasCliche(cliche);
        if (result) caughtCount++;
      });

      const catchRate = (caughtCount / knownCliches.length) * 100;
      expect(catchRate).toBeGreaterThan(80);
    });
  });

  describe('assessContentQuality scoring', () => {
    it('headline with clichés scores lower than clean headline', () => {
      const badContent = {
        headline: 'Quality service you can trust - second to none',
        subheadline: 'We pride ourselves on excellence',
        ctaPrimary: 'Contact us'
      };

      const goodContent = {
        headline: 'Denver Plumbing - 15+ Years, Licensed & Insured',
        subheadline: 'Same-day emergency service for Denver metro',
        ctaPrimary: 'Get Free Quote'
      };

      const badScore = assessContentQuality(badContent, { city: 'Denver' });
      const goodScore = assessContentQuality(goodContent, { city: 'Denver' });

      expect(goodScore.overallScore).toBeGreaterThan(badScore.overallScore);
    });

    it('good content scores > 75', () => {
      const content = {
        headline: 'Denver Emergency Plumbing - Licensed 24/7 Service',
        subheadline: '500+ Denver homes fixed. Same-day service guaranteed.',
        ctaPrimary: 'Call Now',
        aboutSnippet: 'Serving Denver for 15 years with certified, licensed plumbers. Emergency repairs available 24/7.'
      };

      const result = assessContentQuality(content, { city: 'Denver', businessName: 'Denver Emergency Plumbing' }, 'plumber');

      expect(result.overallScore).toBeGreaterThan(75);
      expect(result.grade).toMatch(/[AB]/);
    });

    it('terrible cliché-filled content scores < 50', () => {
      const content = {
        headline: 'Quality service - your trusted partner',
        subheadline: 'We pride ourselves on going above and beyond',
        ctaPrimary: 'Contact',
        aboutSnippet: 'Industry-leading professionals with world-class quality.'
      };

      const result = assessContentQuality(content);

      expect(result.overallScore).toBeLessThan(50);
      expect(result.grade).toMatch(/[DF]/);
    });
  });

  describe('Edge cases', () => {
    it('handles empty string', () => {
      const result = validateContent('');
      expect(result.isValid).toBe(false);
      expect(result.score).toBe(0);
    });

    it('handles null', () => {
      const result = validateContent(null);
      expect(result.isValid).toBe(false);
      expect(result.score).toBe(0);
    });

    it('handles very long content', () => {
      const longContent = 'Denver Plumbing provides fast, reliable service. '.repeat(100);
      const result = validateContent(longContent, { city: 'Denver' });
      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThan(0);
    });

    it('handles content with only numbers', () => {
      const result = validateContent('123 456 7890');
      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('Mixed content', () => {
    it('some clichés + some genuine content - moderate score', () => {
      const content = {
        headline: 'Denver Plumbing - quality service since 2008',
        subheadline: 'Licensed plumbers available 24/7',
        ctaPrimary: 'Get Free Quote',
        aboutSnippet: 'Serving Denver with professional plumbing repairs.'
      };

      const result = assessContentQuality(content, { city: 'Denver' });

      expect(result.overallScore).toBeGreaterThan(40);
      expect(result.overallScore).toBeLessThan(80);
    });
  });

  describe('Headline scoring', () => {
    it('short, specific headlines score higher than long generic ones', () => {
      const shortSpecific = validateHeadline('Denver Plumbing - 24/7 Emergency Service', { city: 'Denver' });
      const longGeneric = validateHeadline('Welcome to our website where we provide quality plumbing services to all customers in the area');

      expect(shortSpecific.score).toBeGreaterThan(longGeneric.score);
    });
  });

  describe('CTA detection', () => {
    it('content with clear CTA scores higher in CTA dimension', () => {
      const strongCTA = scoreCTAEffectiveness('Get Free Quote');
      const weakCTA = scoreCTAEffectiveness('Learn More');

      expect(strongCTA.score).toBeGreaterThan(weakCTA.score);
      expect(strongCTA.score).toBeGreaterThan(60);
    });

    it('action verb CTAs score well', () => {
      const ctas = ['Book Now', 'Schedule Free Estimate', 'Call Today', 'Get Your Quote'];

      ctas.forEach(cta => {
        const result = scoreCTAEffectiveness(cta);
        expect(result.score).toBeGreaterThan(60);
      });
    });
  });

  describe('Temperature/tone', () => {
    it('measured professional content vs hyperbolic salesy content', () => {
      const professional = checkContentTemperature(
        'Denver Plumbing. Licensed plumbers. 15 years experience. Emergency service available.',
        { city: 'Denver' }
      );

      const salesy = checkContentTemperature(
        'AMAZING!!! BEST DEAL EVER!!! ACT NOW!!! LIMITED TIME!!!',
        {}
      );

      expect(professional.temperature).toMatch(/neutral|cool/);
      expect(salesy.temperature).toMatch(/hot|warm/);
    });
  });

  describe('Emotional resonance', () => {
    it('detects pain avoidance triggers', () => {
      const result = checkEmotionalResonance('Stop leaks before they cause damage to your home', 'plumber');
      expect(result.triggers.some(t => t.name === 'painAvoidance')).toBe(true);
    });

    it('detects social proof triggers', () => {
      const result = checkEmotionalResonance('Trusted by 500+ Denver families. 4.9★ rated.', 'plumber');
      expect(result.triggers.some(t => t.name === 'socialProof')).toBe(true);
    });

    it('detects authority triggers', () => {
      const result = checkEmotionalResonance('Licensed, certified, and EPA compliant professionals', 'plumber');
      expect(result.triggers.some(t => t.name === 'authority')).toBe(true);
    });

    it('detects urgency triggers', () => {
      const result = checkEmotionalResonance('24/7 emergency service. Call now for same-day repairs.', 'plumber');
      expect(result.triggers.some(t => t.name === 'urgency')).toBe(true);
    });

    it('detects local connection triggers', () => {
      const result = checkEmotionalResonance('Family-owned business serving Denver since 2005', 'plumber');
      expect(result.triggers.some(t => t.name === 'local')).toBe(true);
    });
  });

  describe('Readability', () => {
    it('calculates Flesch-Kincaid readability score', () => {
      const simpleText = 'We fix pipes. Call us now. Fast service.';
      const complexText = 'Utilizing sophisticated methodologies and state-of-the-art technological implementations, our organization facilitates comprehensive solutions.';

      const simpleResult = calculateReadability(simpleText);
      const complexResult = calculateReadability(complexText);

      expect(simpleResult.score).toBeGreaterThan(complexResult.score);
    });

    it('ideal readability is 55-75', () => {
      const result = calculateReadability('Denver Plumbing provides fast, reliable service for your home. Licensed plumbers available 24/7.');
      expect(result.isIdeal).toBe(true);
      expect(result.score).toBeGreaterThan(55);
      expect(result.score).toBeLessThan(75);
    });
  });

  describe('Excessive "we" usage', () => {
    it('flags content with too many "we" references', () => {
      const result = validateContent('We offer services. We provide solutions. We are experts. We deliver results. We guarantee satisfaction.');
      expect(result.issues.some(i => i.type === 'excessive_we')).toBe(true);
    });

    it('passes content with customer-focused language', () => {
      const result = validateContent('You get fast service. Your home stays protected. Denver families trust our work.');
      expect(result.issues.some(i => i.type === 'excessive_we')).toBe(false);
    });
  });

  describe('Generic superlatives without specifics', () => {
    it('flags "the best" without proof', () => {
      const result = validateContent('We are the best in the business');
      expect(result.issues.some(i => i.type === 'generic_superlative')).toBe(true);
    });

    it('passes "top-rated" with specific proof', () => {
      const result = validateContent('Top-rated (4.9★, 200+ reviews) plumbing service');
      expect(result.issues.some(i => i.type === 'generic_superlative')).toBe(false);
    });
  });

  describe('Empty value propositions', () => {
    it('flags "quality service" as empty', () => {
      const result = validateContent('Quality service for all your needs');
      expect(result.issues.some(i => i.type === 'empty_value_prop' || i.type === 'cliche')).toBe(true);
    });

    it('flags "professional team" as empty', () => {
      const result = validateContent('Our professional team is here to help');
      expect(result.issues.some(i => i.type === 'empty_value_prop' || i.type === 'cliche')).toBe(true);
    });

    it('passes concrete proof', () => {
      const result = validateContent('15+ years, licensed & insured, 500+ customers', { city: 'Denver' });
      expect(result.issues.filter(i => i.severity === 'high').length).toBe(0);
    });
  });

  describe('Additional cliché detection', () => {
    it('catches "state-of-the-art"', () => {
      const result = hasCliche('We use state-of-the-art technology');
      expect(result).toBe(true);
    });

    it('catches "next level"', () => {
      const result = hasCliche('Take your business to the next level');
      expect(result).toBe(true);
    });

    it('catches "unparalleled"', () => {
      const result = hasCliche('Unparalleled expertise in the field');
      expect(result).toBe(true);
    });

    it('catches "best of the best"', () => {
      const result = hasCliche('Our team is the best of the best');
      expect(result).toBe(true);
    });

    it('passes clean content', () => {
      const result = hasCliche('Denver plumbers available 24/7. Licensed and insured.');
      expect(result).toBe(false);
    });
  });
});
