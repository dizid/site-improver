// src/webhooks/resend.js
// Resend webhook handler for email delivery tracking

import crypto from 'crypto';
import logger from '../logger.js';

const log = logger.child('resend-webhooks');

/**
 * Email status enum
 */
export const EMAIL_STATUS = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  BOUNCED: 'bounced',
  COMPLAINED: 'complained',
  OPENED: 'opened',
  CLICKED: 'clicked',
  FAILED: 'failed'
};

/**
 * Resend webhook event types we handle
 */
export const EVENT_TYPES = {
  DELIVERED: 'email.delivered',
  BOUNCED: 'email.bounced',
  COMPLAINED: 'email.complained',
  OPENED: 'email.opened',
  CLICKED: 'email.clicked'
};

/**
 * Verify Resend webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - Resend-Signature header
 * @param {string} secret - Webhook signing secret
 * @returns {boolean} Is valid
 */
export function verifyWebhookSignature(payload, signature, secret) {
  if (!secret) {
    log.warn('No RESEND_WEBHOOK_SECRET configured, skipping signature verification');
    return true; // Allow in dev mode
  }

  if (!signature) {
    log.warn('No signature provided in webhook request');
    return false;
  }

  try {
    // Resend uses HMAC-SHA256 with format: t=timestamp,v1=signature
    const parts = signature.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const signaturePart = parts.find(p => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
      log.warn('Invalid signature format', { signature });
      return false;
    }

    const timestamp = timestampPart.split('=')[1];
    const providedSignature = signaturePart.split('=')[1];

    // Create expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    // Constant-time comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(providedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    // Check timestamp (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const webhookTime = parseInt(timestamp, 10);
    const isRecent = Math.abs(now - webhookTime) < 300;

    if (!isRecent) {
      log.warn('Webhook timestamp too old', { webhookTime, now });
      return false;
    }

    return isValid;
  } catch (error) {
    log.error('Signature verification failed', { error: error.message });
    return false;
  }
}

/**
 * Handle Resend webhook event
 * @param {Object} event - Webhook event payload
 * @param {Object} db - Database module
 * @returns {Object} Processing result
 */
export async function handleResendWebhook(event, db) {
  const { type, data } = event;

  log.info('Processing Resend webhook', {
    type,
    emailId: data?.email_id,
    to: data?.to?.[0]
  });

  // Find the email in our system by Resend's email_id
  const resendEmailId = data?.email_id;
  if (!resendEmailId) {
    log.warn('No email_id in webhook payload', { type });
    return { success: false, reason: 'missing_email_id' };
  }

  // Get the email from history (it should be there after sending)
  let emailRecord = null;
  try {
    // Try to find by resendId in history
    const history = await db.getEmailHistory({ limit: 100 });
    emailRecord = history.find(e => e.resendId === resendEmailId);

    if (!emailRecord) {
      log.warn('Email not found in history', { resendEmailId });
      return { success: false, reason: 'email_not_found' };
    }
  } catch (error) {
    log.error('Error fetching email history', { error: error.message });
    return { success: false, reason: 'db_error' };
  }

  // Process based on event type
  const updates = {
    updatedAt: new Date().toISOString()
  };

  switch (type) {
    case EVENT_TYPES.DELIVERED:
      updates.deliveredAt = data.created_at || new Date().toISOString();
      updates.deliveryStatus = EMAIL_STATUS.DELIVERED;
      log.info('Email delivered', { emailId: emailRecord.id, to: data.to });
      break;

    case EVENT_TYPES.BOUNCED:
      updates.bouncedAt = data.created_at || new Date().toISOString();
      updates.deliveryStatus = EMAIL_STATUS.BOUNCED;
      updates.bounceType = data.bounce?.type || 'unknown';
      updates.bounceReason = data.bounce?.message || null;
      log.warn('Email bounced', {
        emailId: emailRecord.id,
        to: data.to,
        bounceType: updates.bounceType,
        reason: updates.bounceReason
      });
      break;

    case EVENT_TYPES.COMPLAINED:
      updates.complainedAt = data.created_at || new Date().toISOString();
      updates.deliveryStatus = EMAIL_STATUS.COMPLAINED;
      log.warn('Email marked as spam', {
        emailId: emailRecord.id,
        to: data.to
      });
      break;

    case EVENT_TYPES.OPENED:
      updates.openedAt = updates.openedAt || data.created_at || new Date().toISOString();
      updates.openCount = (emailRecord.openCount || 0) + 1;
      updates.lastOpenedAt = data.created_at || new Date().toISOString();
      log.info('Email opened', {
        emailId: emailRecord.id,
        openCount: updates.openCount
      });
      break;

    case EVENT_TYPES.CLICKED:
      updates.clickedAt = updates.clickedAt || data.created_at || new Date().toISOString();
      updates.clickCount = (emailRecord.clickCount || 0) + 1;
      updates.lastClickedAt = data.created_at || new Date().toISOString();
      updates.clickedLinks = [
        ...(emailRecord.clickedLinks || []),
        {
          url: data.click?.link || data.link,
          timestamp: data.created_at || new Date().toISOString()
        }
      ].slice(-10); // Keep last 10 clicks
      log.info('Email link clicked', {
        emailId: emailRecord.id,
        link: data.click?.link || data.link
      });
      break;

    default:
      log.debug('Unhandled webhook event type', { type });
      return { success: true, skipped: true, reason: 'unhandled_event_type' };
  }

  // Update the email record in history
  try {
    await db.updateEmailHistory(emailRecord.id, updates);
    log.info('Email history updated', {
      emailId: emailRecord.id,
      status: updates.deliveryStatus
    });

    return {
      success: true,
      emailId: emailRecord.id,
      status: updates.deliveryStatus,
      eventType: type
    };
  } catch (error) {
    log.error('Failed to update email history', {
      emailId: emailRecord.id,
      error: error.message
    });
    return { success: false, reason: 'update_failed' };
  }
}

/**
 * Get email delivery statistics
 * @param {Object} db - Database module
 * @param {string} tenantId - Optional tenant filter
 * @returns {Object} Delivery stats
 */
export async function getEmailDeliveryStats(db, tenantId = null) {
  try {
    const history = await db.getEmailHistory({
      tenantId,
      limit: 1000 // Last 1000 emails
    });

    const stats = {
      total: history.length,
      sent: 0,
      delivered: 0,
      bounced: 0,
      complained: 0,
      opened: 0,
      clicked: 0,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0,
      bySubjectLine: {}
    };

    for (const email of history) {
      stats.sent++;

      if (email.deliveryStatus === EMAIL_STATUS.DELIVERED) {
        stats.delivered++;
      }
      if (email.deliveryStatus === EMAIL_STATUS.BOUNCED) {
        stats.bounced++;
      }
      if (email.deliveryStatus === EMAIL_STATUS.COMPLAINED) {
        stats.complained++;
      }
      if (email.openedAt || email.openCount > 0) {
        stats.opened++;
      }
      if (email.clickedAt || email.clickCount > 0) {
        stats.clicked++;
      }

      // Track by subject line variant
      const subject = email.subject || 'Unknown';
      if (!stats.bySubjectLine[subject]) {
        stats.bySubjectLine[subject] = {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0
        };
      }
      stats.bySubjectLine[subject].sent++;
      if (email.deliveryStatus === EMAIL_STATUS.DELIVERED) {
        stats.bySubjectLine[subject].delivered++;
      }
      if (email.openedAt || email.openCount > 0) {
        stats.bySubjectLine[subject].opened++;
      }
      if (email.clickedAt || email.clickCount > 0) {
        stats.bySubjectLine[subject].clicked++;
      }
    }

    // Calculate rates
    if (stats.sent > 0) {
      stats.deliveryRate = Math.round((stats.delivered / stats.sent) * 100);
      stats.bounceRate = Math.round((stats.bounced / stats.sent) * 100);
    }
    if (stats.delivered > 0) {
      stats.openRate = Math.round((stats.opened / stats.delivered) * 100);
      stats.clickRate = Math.round((stats.clicked / stats.delivered) * 100);
    }

    // Calculate rates for each subject line
    for (const subject of Object.keys(stats.bySubjectLine)) {
      const s = stats.bySubjectLine[subject];
      s.openRate = s.sent > 0 ? Math.round((s.opened / s.sent) * 100) : 0;
      s.clickRate = s.sent > 0 ? Math.round((s.clicked / s.sent) * 100) : 0;
    }

    return stats;
  } catch (error) {
    log.error('Failed to get email delivery stats', { error: error.message });
    return null;
  }
}

export default {
  EMAIL_STATUS,
  EVENT_TYPES,
  verifyWebhookSignature,
  handleResendWebhook,
  getEmailDeliveryStats
};
