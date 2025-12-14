// src/db.js
import fs from 'fs/promises';
import path from 'path';
import logger from './logger.js';
import { CONFIG } from './config.js';

const DB_PATH = process.env.DB_PATH || CONFIG.database.defaultPath;
const log = logger.child('db');

export async function loadDb() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      log.debug('Database file not found, starting fresh');
    } else {
      log.warn('Failed to load database', { error: error.message });
    }
    return [];
  }
}

export async function saveDb(db) {
  try {
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
  } catch (error) {
    log.error('Failed to save database', { error: error.message });
    throw error;
  }
}

export async function saveDeployment(data) {
  const db = await loadDb();

  db.push({
    ...data,
    createdAt: new Date().toISOString(),
    status: 'pending'
  });

  await saveDb(db);
  log.debug('Deployment saved', { siteId: data.siteId });
  return data;
}

export async function getDeployment(siteId) {
  const db = await loadDb();
  return db.find(d => d.siteId === siteId);
}

export async function getDeployments(status = null) {
  const db = await loadDb();
  return status ? db.filter(d => d.status === status) : db;
}

export async function updateDeployment(siteId, updates) {
  const db = await loadDb();
  const index = db.findIndex(d => d.siteId === siteId);

  if (index === -1) {
    log.warn('Deployment not found for update', { siteId });
    throw new Error(`Deployment not found: ${siteId}`);
  }

  db[index] = {
    ...db[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  await saveDb(db);
  log.debug('Deployment updated', { siteId, updates: Object.keys(updates) });
  return db[index];
}

export async function deleteDeployment(siteId) {
  const db = await loadDb();
  const filtered = db.filter(d => d.siteId !== siteId);

  if (filtered.length === db.length) {
    log.warn('Deployment not found for deletion', { siteId });
  } else {
    log.debug('Deployment deleted', { siteId });
  }

  await saveDb(filtered);
}

export default {
  loadDb,
  saveDb,
  saveDeployment,
  getDeployment,
  getDeployments,
  updateDeployment,
  deleteDeployment
};
