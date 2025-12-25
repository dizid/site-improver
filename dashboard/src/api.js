// Simple frontend logger with debug toggle
const DEBUG = localStorage.getItem('debug') === 'true' || import.meta.env.DEV;

const log = {
  debug: (...args) => DEBUG && console.log('[API]', ...args),
  error: (...args) => console.error('[API]', ...args)
};

// API helper with configurable logging
export const api = {
  async get(url) {
    log.debug('GET', url);
    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      log.error('GET', url, 'failed:', res.status, errText);
      throw new Error(errText);
    }
    const data = await res.json();
    log.debug('GET', url, 'response:', data);
    return data;
  },

  async post(url, data) {
    log.debug('POST', url, data);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const errText = await res.text();
      log.error('POST', url, 'failed:', res.status, errText);
      throw new Error(errText);
    }
    const responseData = await res.json();
    log.debug('POST', url, 'response:', responseData);
    return responseData;
  },

  async patch(url, data) {
    log.debug('PATCH', url, data);
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const errText = await res.text();
      log.error('PATCH', url, 'failed:', res.status, errText);
      throw new Error(errText);
    }
    return res.json();
  },

  async delete(url) {
    log.debug('DELETE', url);
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      const errText = await res.text();
      log.error('DELETE', url, 'failed:', res.status, errText);
      throw new Error(errText);
    }
    return res.json();
  }
};

// Pipeline status configuration
export const PIPELINE_STATUS = {
  DISCOVERED: 'discovered',
  SCORING: 'scoring',
  QUALIFIED: 'qualified',
  DISQUALIFIED: 'disqualified',
  QUEUED: 'queued',
  SCRAPING: 'scraping',
  SCRAPED: 'scraped',
  BUILDING: 'building',
  DEPLOYING: 'deploying',
  DEPLOYED: 'deployed',
  EMAILING: 'emailing',
  FOLLOW_UP_1: 'follow_up_1',
  FOLLOW_UP_2: 'follow_up_2',
  LAST_CHANCE: 'last_chance',
  CONVERTED: 'converted',
  EXPIRED: 'expired',
  DELETED: 'deleted',
  ERROR: 'error'
};

export const STATUS_INFO = {
  [PIPELINE_STATUS.DISCOVERED]: { label: 'Discovered', color: 'blue', stage: 1 },
  [PIPELINE_STATUS.SCORING]: { label: 'Scoring', color: 'blue', stage: 1 },
  [PIPELINE_STATUS.QUALIFIED]: { label: 'Qualified', color: 'blue', stage: 1 },
  [PIPELINE_STATUS.DISQUALIFIED]: { label: 'Disqualified', color: 'gray', stage: 1 },
  [PIPELINE_STATUS.QUEUED]: { label: 'Queued', color: 'yellow', stage: 2 },
  [PIPELINE_STATUS.SCRAPING]: { label: 'Scraping', color: 'yellow', stage: 2 },
  [PIPELINE_STATUS.SCRAPED]: { label: 'Scraped', color: 'yellow', stage: 2 },
  [PIPELINE_STATUS.BUILDING]: { label: 'Building', color: 'yellow', stage: 3 },
  [PIPELINE_STATUS.DEPLOYING]: { label: 'Deploying', color: 'yellow', stage: 3 },
  [PIPELINE_STATUS.DEPLOYED]: { label: 'Deployed', color: 'green', stage: 4 },
  [PIPELINE_STATUS.EMAILING]: { label: 'Emailing', color: 'green', stage: 5 },
  [PIPELINE_STATUS.FOLLOW_UP_1]: { label: 'Follow-up 1', color: 'green', stage: 5 },
  [PIPELINE_STATUS.FOLLOW_UP_2]: { label: 'Follow-up 2', color: 'green', stage: 5 },
  [PIPELINE_STATUS.LAST_CHANCE]: { label: 'Last Chance', color: 'orange', stage: 6 },
  [PIPELINE_STATUS.CONVERTED]: { label: 'Converted', color: 'purple', stage: 7 },
  [PIPELINE_STATUS.EXPIRED]: { label: 'Expired', color: 'red', stage: 7 },
  [PIPELINE_STATUS.DELETED]: { label: 'Deleted', color: 'gray', stage: 7 },
  [PIPELINE_STATUS.ERROR]: { label: 'Error', color: 'red', stage: 0 },
  // Legacy status mappings for backwards compatibility
  pending: { label: 'Pending', color: 'gray', stage: 1 },
  emailed: { label: 'Emailed', color: 'blue', stage: 5 },
  responded: { label: 'Responded', color: 'yellow', stage: 6 },
  converted: { label: 'Converted', color: 'green', stage: 7 },
  expired: { label: 'Expired', color: 'red', stage: 7 }
};

export const TOTAL_STAGES = 7;

// Time ago helper
export function timeAgo(date) {
  if (!date) return 'N/A';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// URL validation
export function validateUrl(value) {
  if (!value) {
    return 'URL is required';
  }
  try {
    const urlObj = new URL(value);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return 'URL must start with http:// or https://';
    }
    if (!urlObj.hostname.includes('.')) {
      return 'Please enter a valid domain';
    }
  } catch {
    return 'Please enter a valid URL';
  }
  return '';
}

export default api;
