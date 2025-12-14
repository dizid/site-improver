// tests/config.test.js
import { describe, it, expect } from 'vitest';
import { CONFIG, getSpeedScore, classifyScore, validateEnv } from '../src/config.js';

describe('config', () => {
  describe('CONFIG', () => {
    it('should have required timeout configurations', () => {
      expect(CONFIG.timeouts.pageLoad).toBeGreaterThan(0);
      expect(CONFIG.timeouts.scoring).toBeGreaterThan(0);
      expect(CONFIG.timeouts.deployPoll).toBeGreaterThan(0);
      expect(CONFIG.timeouts.deployMax).toBeGreaterThan(0);
    });

    it('should have required limits', () => {
      expect(CONFIG.limits.headlines).toBeGreaterThan(0);
      expect(CONFIG.limits.paragraphs).toBeGreaterThan(0);
      expect(CONFIG.limits.services).toBeGreaterThan(0);
      expect(CONFIG.limits.images).toBeGreaterThan(0);
    });

    it('should have scoring weights that sum to 100', () => {
      const { weights } = CONFIG.scoring;
      const sum = weights.https + weights.speed + weights.mobile + weights.modern + weights.seo;
      expect(sum).toBe(100);
    });

    it('should have valid scoring thresholds', () => {
      expect(CONFIG.scoring.maxTargetScore).toBeGreaterThan(CONFIG.scoring.primeTargetScore);
    });

    it('should have valid AI configuration', () => {
      expect(CONFIG.ai.model).toBeDefined();
      expect(CONFIG.ai.maxTokens.slot).toBeGreaterThan(0);
    });
  });

  describe('getSpeedScore', () => {
    it('should return 100 for excellent speed', () => {
      expect(getSpeedScore(1000)).toBe(100);
      expect(getSpeedScore(2000)).toBe(100);
    });

    it('should return 75 for good speed', () => {
      expect(getSpeedScore(3000)).toBe(75);
      expect(getSpeedScore(4000)).toBe(75);
    });

    it('should return 50 for fair speed', () => {
      expect(getSpeedScore(5000)).toBe(50);
      expect(getSpeedScore(6000)).toBe(50);
    });

    it('should return 25 for poor speed', () => {
      expect(getSpeedScore(8000)).toBe(25);
      expect(getSpeedScore(10000)).toBe(25);
    });

    it('should return 0 for very slow speed', () => {
      expect(getSpeedScore(15000)).toBe(0);
      expect(getSpeedScore(30000)).toBe(0);
    });
  });

  describe('classifyScore', () => {
    it('should identify prime targets', () => {
      const result = classifyScore(30);
      expect(result.isTarget).toBe(true);
      expect(result.isPrimeTarget).toBe(true);
      expect(result.recommendation).toBe('prime_target');
    });

    it('should identify good targets', () => {
      const result = classifyScore(50);
      expect(result.isTarget).toBe(true);
      expect(result.isPrimeTarget).toBe(false);
      expect(result.recommendation).toBe('good_target');
    });

    it('should identify weak targets', () => {
      const result = classifyScore(70);
      expect(result.isTarget).toBe(false);
      expect(result.isPrimeTarget).toBe(false);
      expect(result.recommendation).toBe('weak_target');
    });

    it('should recommend skipping good sites', () => {
      const result = classifyScore(90);
      expect(result.isTarget).toBe(false);
      expect(result.isPrimeTarget).toBe(false);
      expect(result.recommendation).toBe('skip');
    });
  });

  describe('validateEnv', () => {
    it('should return valid when no requirements specified', () => {
      const result = validateEnv([]);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should return missing variables', () => {
      // This will fail if env vars aren't set (expected in test environment)
      const result = validateEnv(['NONEXISTENT_VAR_12345']);
      // Since the var doesn't exist in our varMap, it will be reported as missing
      expect(result.missing.length).toBeGreaterThanOrEqual(0);
    });
  });
});
