// src/outreach.js
import { EmailGenerator, wrapInHtml } from './emailGenerator.js';
import EmailSender from './emailSender.js';
import {
  updateDeployment,
  createEmailDraft,
  getEmailDraft,
  getEmailConfig,
  moveToHistory
} from './db.js';
import logger from './logger.js';
import { CONFIG } from './config.js';

const log = logger.child('outreach');

export class OutreachManager {
  constructor(config) {
    this.generator = new EmailGenerator(config.anthropicApiKey || process.env.ANTHROPIC_API_KEY);
    this.sender = new EmailSender(
      config.resendApiKey,
      config.fromEmail
    );
  }

  /**
   * Queue an email for approval instead of sending immediately
   */
  async queueEmail(deployment, type, emailData) {
    const draft = await createEmailDraft({
      leadId: deployment.leadId || null,
      deploymentId: deployment.siteId,
      type,
      to: deployment.email,
      subject: emailData.subject,
      textBody: emailData.textBody,
      htmlBody: emailData.htmlBody,
      businessName: deployment.businessName
    });

    log.info(`Email queued for approval`, {
      emailId: draft.id,
      to: deployment.email,
      type
    });

    return { queued: true, emailId: draft.id };
  }

  /**
   * Send an email from the queue (after approval)
   */
  async sendFromQueue(emailId) {
    const draft = await getEmailDraft(emailId);

    if (!draft) {
      throw new Error(`Email draft not found: ${emailId}`);
    }

    if (draft.status !== 'approved') {
      throw new Error(`Email not approved: ${emailId} (status: ${draft.status})`);
    }

    try {
      const result = await this.sender.sendWithHtml({
        to: draft.to,
        subject: draft.subject,
        textBody: draft.textBody,
        htmlBody: draft.htmlBody
      });

      // Move to history with success
      await moveToHistory(emailId, {
        success: true,
        id: result.id
      });

      // Update deployment if we have one
      if (draft.deploymentId) {
        const updateData = {
          status: 'emailed',
          emailId: result.id,
          emailSentAt: result.sentAt,
          emailSubject: draft.subject,
          emailBody: draft.textBody
        };

        // Handle follow-up types
        if (draft.type.startsWith('followup-')) {
          const attempt = parseInt(draft.type.split('-')[1]);
          updateData[`followUp${attempt}SentAt`] = result.sentAt;
          delete updateData.status; // Don't change status for follow-ups
        }

        await updateDeployment(draft.deploymentId, updateData);
      }

      log.info(`Email sent from queue`, { emailId, to: draft.to });
      return result;
    } catch (error) {
      // Move to history with failure
      await moveToHistory(emailId, {
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  async sendInitialOutreach(deployment, options = {}) {
    // Skip if no email found
    if (!deployment.email) {
      log.warn(`No email found for ${deployment.businessName}`);
      return null;
    }

    // Check email config
    const emailConfig = await getEmailConfig();
    const shouldQueue = !emailConfig.autoSendEnabled || emailConfig.requireApproval;

    // Generate personalized email
    const emailBody = await this.generator.generateEmail({
      businessName: deployment.businessName,
      industry: deployment.industry,
      originalUrl: deployment.original,
      previewUrl: deployment.preview,
      phone: deployment.phone,
      city: deployment.city
    });

    // Generate subject lines
    const subjects = await this.generator.generateSubjectLines({
      businessName: deployment.businessName,
      industry: deployment.industry
    });

    // Create HTML version
    const htmlBody = wrapInHtml(
      emailBody,
      deployment.preview,
      deployment.businessName
    );

    const emailData = {
      subject: subjects[0],
      textBody: emailBody,
      htmlBody
    };

    // Queue for approval if configured (unless explicitly forcing send)
    if (shouldQueue && !options.forceSend) {
      return await this.queueEmail(deployment, 'initial', emailData);
    }

    // Send immediately
    const result = await this.sender.sendWithHtml({
      to: deployment.email,
      ...emailData
    });

    // Update deployment record
    await updateDeployment(deployment.siteId, {
      status: 'emailed',
      emailId: result.id,
      emailSentAt: result.sentAt,
      emailSubject: subjects[0],
      emailBody
    });

    log.info(`Email sent to ${deployment.email}`);

    return result;
  }

  async sendFollowUp(deployment, attempt, options = {}) {
    if (!deployment.email) {
      return null;
    }

    // Check email config
    const emailConfig = await getEmailConfig();
    const shouldQueue = !emailConfig.autoSendEnabled || emailConfig.requireApproval;

    const followUpBody = await this.generator.generateFollowUp(
      {
        businessName: deployment.businessName,
        previewUrl: deployment.preview,
        industry: deployment.industry
      },
      attempt
    );

    // Use custom subject from options, or fall back to defaults
    const defaultSubjects = {
      1: `Re: ${deployment.emailSubject}`,
      2: `${deployment.businessName} website`,
      3: `Closing the loop`
    };
    const subject = options.subject || defaultSubjects[attempt] || defaultSubjects[1];

    const htmlBody = wrapInHtml(
      followUpBody,
      deployment.preview,
      deployment.businessName
    );

    const emailData = {
      subject,
      textBody: followUpBody,
      htmlBody
    };

    // Queue for approval if configured (unless explicitly forcing send)
    if (shouldQueue && !options.forceSend) {
      return await this.queueEmail(deployment, `followup-${attempt}`, emailData);
    }

    // Send immediately
    const result = await this.sender.sendWithHtml({
      to: deployment.email,
      ...emailData
    });

    await updateDeployment(deployment.siteId, {
      [`followUp${attempt}SentAt`]: result.sentAt
    });

    log.info(`Follow-up #${attempt} sent to ${deployment.email}`);

    return result;
  }
}

export async function runDailySequence(config, tenantId = null) {
  const { getDeployments, updateDeployment, getEmailConfig, getFollowUpSequence } = await import('./db.js');

  // Check if auto-send is enabled
  const emailConfig = await getEmailConfig();
  if (!emailConfig.autoSendEnabled) {
    log.info('Auto-send disabled, skipping daily sequence');
    return { skipped: true, reason: 'autoSendEnabled is false' };
  }

  // Get tenant-specific follow-up sequence (or default)
  const sequence = await getFollowUpSequence(tenantId);
  if (!sequence.enabled) {
    log.info('Follow-up sequence disabled for tenant', { tenantId });
    return { skipped: true, reason: 'sequence disabled' };
  }

  const outreach = new OutreachManager(config);
  const now = new Date();
  const results = { queued: 0, sent: 0, expired: 0 };

  const deployments = await getDeployments();

  for (const d of deployments) {
    // Skip if tenant filtering and deployment doesn't match
    if (tenantId && d.tenantId !== tenantId) continue;
    if (d.status === 'converted' || d.status === 'expired') continue;

    const daysSinceEmail = d.emailSentAt
      ? (now - new Date(d.emailSentAt)) / (1000 * 60 * 60 * 24)
      : null;

    try {
      // Initial email
      if (d.status === 'pending' && !d.emailSentAt) {
        const result = await outreach.sendInitialOutreach(d);
        if (result?.queued) results.queued++;
        else if (result) results.sent++;
        continue;
      }

      // Process follow-up steps from sequence
      let stepTriggered = false;
      for (let i = 0; i < sequence.steps.length; i++) {
        const step = sequence.steps[i];
        const attemptNum = i + 1;
        const sentAtField = `followUp${attemptNum}SentAt`;

        // Check if this step should fire and hasn't been sent
        if (daysSinceEmail >= step.day && !d[sentAtField]) {
          const result = await outreach.sendFollowUp(d, attemptNum, {
            subject: step.subject
              .replace('{initialSubject}', d.emailSubject || 'Your new website')
              .replace('{businessName}', d.businessName || 'Your business')
          });
          if (result?.queued) results.queued++;
          else if (result) results.sent++;
          stepTriggered = true;
          break; // Only send one email per run
        }
      }

      if (stepTriggered) continue;

      // Expire if past expire days
      if (daysSinceEmail >= sequence.expireDays) {
        await updateDeployment(d.siteId, { status: 'expired' });
        results.expired++;
      }
    } catch (error) {
      log.error(`Error processing deployment ${d.siteId}`, { error: error.message });
    }
  }

  log.info('Daily sequence completed', { tenantId, ...results });
  return results;
}

export default OutreachManager;
