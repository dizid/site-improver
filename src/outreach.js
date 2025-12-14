// src/outreach.js
import { EmailGenerator, wrapInHtml } from './emailGenerator.js';
import EmailSender from './emailSender.js';
import { updateDeployment } from './db.js';
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

  async sendInitialOutreach(deployment) {
    // Skip if no email found
    if (!deployment.email) {
      log.warn(`No email found for ${deployment.businessName}`);
      return null;
    }

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

    // Send it
    const result = await this.sender.sendWithHtml({
      to: deployment.email,
      subject: subjects[0],
      textBody: emailBody,
      htmlBody
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

  async sendFollowUp(deployment, attempt) {
    if (!deployment.email) {
      return null;
    }

    const followUpBody = await this.generator.generateFollowUp(
      {
        businessName: deployment.businessName,
        previewUrl: deployment.preview,
        industry: deployment.industry
      },
      attempt
    );

    const subjects = {
      1: `Re: ${deployment.emailSubject}`,
      2: `${deployment.businessName} website`,
      3: `Closing the loop`
    };

    const htmlBody = wrapInHtml(
      followUpBody,
      deployment.preview,
      deployment.businessName
    );

    const result = await this.sender.sendWithHtml({
      to: deployment.email,
      subject: subjects[attempt] || subjects[1],
      textBody: followUpBody,
      htmlBody
    });

    await updateDeployment(deployment.siteId, {
      [`followUp${attempt}SentAt`]: result.sentAt
    });

    log.info(`Follow-up #${attempt} sent to ${deployment.email}`);

    return result;
  }
}

export async function runDailySequence(config) {
  const { emailSequence } = CONFIG;
  const { getDeployments, updateDeployment } = await import('./db.js');
  const outreach = new OutreachManager(config);
  const now = new Date();

  const deployments = await getDeployments();

  for (const d of deployments) {
    if (d.status === 'converted' || d.status === 'expired') continue;

    const daysSinceEmail = d.emailSentAt
      ? (now - new Date(d.emailSentAt)) / (1000 * 60 * 60 * 24)
      : null;

    // Initial email
    if (d.status === 'pending' && !d.emailSentAt) {
      await outreach.sendInitialOutreach(d);
      continue;
    }

    // Follow-up 1 (day 3)
    if (daysSinceEmail >= emailSequence.followUp1 && !d.followUp1SentAt) {
      await outreach.sendFollowUp(d, 1);
      continue;
    }

    // Follow-up 2 (day 7)
    if (daysSinceEmail >= emailSequence.followUp2 && !d.followUp2SentAt) {
      await outreach.sendFollowUp(d, 2);
      continue;
    }

    // Breakup (day 12)
    if (daysSinceEmail >= emailSequence.followUp3 && !d.followUp3SentAt) {
      await outreach.sendFollowUp(d, 3);
      continue;
    }

    // Expire (day 14)
    if (daysSinceEmail >= emailSequence.expire) {
      await updateDeployment(d.siteId, { status: 'expired' });
    }
  }
}

export default OutreachManager;
