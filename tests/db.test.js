// tests/db.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Mock the file system
vi.mock('fs/promises');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('db', () => {
  let db;
  const testDbPath = '/tmp/test-deployments.json';
  const mockDeployments = [
    {
      siteId: 'site-1',
      businessName: 'Test Business 1',
      original: 'https://test1.com',
      preview: 'https://preview-test1.netlify.app',
      status: 'pending',
      createdAt: '2024-01-01T00:00:00.000Z'
    },
    {
      siteId: 'site-2',
      businessName: 'Test Business 2',
      original: 'https://test2.com',
      preview: 'https://preview-test2.netlify.app',
      status: 'emailed',
      createdAt: '2024-01-02T00:00:00.000Z'
    }
  ];

  beforeEach(async () => {
    // Reset all mocks before each test
    vi.resetAllMocks();

    // Set up default mock behavior
    fs.readFile.mockResolvedValue(JSON.stringify(mockDeployments));
    fs.writeFile.mockResolvedValue(undefined);

    // Set environment variable for test db path
    process.env.DB_PATH = testDbPath;

    // Import db module fresh for each test
    vi.resetModules();
    db = await import('../src/db.js');
  });

  afterEach(() => {
    delete process.env.DB_PATH;
  });

  describe('getDeployments', () => {
    it('should return all deployments', async () => {
      const deployments = await db.getDeployments();
      expect(deployments).toEqual(mockDeployments);
      expect(fs.readFile).toHaveBeenCalledWith(testDbPath, 'utf-8');
    });

    it('should return empty array when file does not exist', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT'));

      const deployments = await db.getDeployments();
      expect(deployments).toEqual([]);
    });

    it('should return empty array for invalid JSON', async () => {
      fs.readFile.mockResolvedValue('invalid json');

      const deployments = await db.getDeployments();
      expect(deployments).toEqual([]);
    });
  });

  describe('getDeployment', () => {
    it('should return a single deployment by siteId', async () => {
      const deployment = await db.getDeployment('site-1');
      expect(deployment).toEqual(mockDeployments[0]);
    });

    it('should return undefined for non-existent siteId', async () => {
      const deployment = await db.getDeployment('non-existent');
      expect(deployment).toBeUndefined();
    });
  });

  describe('saveDeployment', () => {
    it('should add a new deployment', async () => {
      const newDeployment = {
        siteId: 'site-3',
        businessName: 'New Business',
        original: 'https://new.com',
        preview: 'https://preview-new.netlify.app',
        status: 'pending'
      };

      await db.saveDeployment(newDeployment);

      expect(fs.writeFile).toHaveBeenCalled();
      const writeCall = fs.writeFile.mock.calls[0];
      expect(writeCall[0]).toBe(testDbPath);
      expect(writeCall[1]).toContain('site-3');
    });

    it('should include createdAt timestamp', async () => {
      const newDeployment = {
        siteId: 'site-new',
        businessName: 'Test'
      };

      await db.saveDeployment(newDeployment);

      const writeCall = fs.writeFile.mock.calls[0];
      const savedData = JSON.parse(writeCall[1]);
      const saved = savedData.find(d => d.siteId === 'site-new');

      expect(saved.createdAt).toBeDefined();
    });
  });

  describe('updateDeployment', () => {
    it('should update existing deployment', async () => {
      await db.updateDeployment('site-1', { status: 'converted' });

      const writeCall = fs.writeFile.mock.calls[0];
      const savedData = JSON.parse(writeCall[1]);
      const updated = savedData.find(d => d.siteId === 'site-1');

      expect(updated.status).toBe('converted');
      expect(updated.updatedAt).toBeDefined();
    });

    it('should return updated deployment', async () => {
      const result = await db.updateDeployment('site-1', { notes: 'Test note' });

      expect(result.notes).toBe('Test note');
      expect(result.siteId).toBe('site-1');
    });

    it('should throw for non-existent deployment', async () => {
      await expect(
        db.updateDeployment('non-existent', { status: 'converted' })
      ).rejects.toThrow();
    });
  });

  describe('deleteDeployment', () => {
    it('should remove deployment from database', async () => {
      await db.deleteDeployment('site-1');

      const writeCall = fs.writeFile.mock.calls[0];
      const savedData = JSON.parse(writeCall[1]);

      expect(savedData.find(d => d.siteId === 'site-1')).toBeUndefined();
      expect(savedData.length).toBe(mockDeployments.length - 1);
    });
  });
});
