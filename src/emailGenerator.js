// src/emailGenerator.js
import Anthropic from '@anthropic-ai/sdk';
import logger from './logger.js';
import { CONFIG } from './config.js';
import { safeParseJsonArray } from './utils.js';
import { captureBeforeAfter } from './screenshot.js';

const log = logger.child('emailGenerator');

// Subject line variants for A/B testing
const SUBJECT_VARIANTS = [
  { id: 'A', template: 'Your new {{businessName}} website' },
  { id: 'B', template: 'I rebuilt {{businessName}} (free preview)' },
  { id: 'C', template: '{{businessName}} - thought you should see this' },
  { id: 'D', template: 'Quick question about {{businessName}}' }
];

export class EmailGenerator {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY;
    this.client = null;
    this.systemPrompt = `You write cold outreach emails for a web design service.

Style:
- Casual, friendly, human — not salesy or corporate
- Short paragraphs, scannable
- No fluff or filler words
- Confident but not arrogant
- Create curiosity and urgency without being pushy

Structure:
- Hook (1 line) — pattern interrupt, reference their business
- The offer (2-3 lines) — what you did, link to preview
- Value prop (1-2 lines) — why it matters
- CTA (1 line) — simple next step
- Sign off

Return ONLY the email body, no subject line unless asked.`;
  }

  getClient() {
    if (!this.client) {
      if (!this.apiKey) {
        throw new Error('ANTHROPIC_API_KEY not set');
      }
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async generateEmail(data) {
    const prompt = `Write a cold email to the owner of "${data.businessName}" (${data.industry}).

Context:
- Their current site: ${data.originalUrl}
- Preview of redesign: ${data.previewUrl}
- Their phone: ${data.phone || 'unknown'}
- Their location: ${data.city || 'their area'}

Key points to hit:
- I rebuilt their site as a free preview
- Modern, mobile-friendly, faster
- $1000 to make it live (includes domain transfer, hosting setup, 30 days support)
- No obligation, preview expires in 14 days
- Can hop on a quick call or they can just reply

Keep it under 120 words.`;

    try {
      const response = await this.getClient().messages.create({
        model: CONFIG.ai.model,
        max_tokens: 400,
        system: this.systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      });

      return response.content[0].text.trim();
    } catch (error) {
      log.warn('Failed to generate email', { error: error.message });
      return this.getFallbackEmail(data);
    }
  }

  async generateSubjectLines(data, count = 3) {
    const prompt = `Generate ${count} subject lines for a cold email to "${data.businessName}" (${data.industry}).

Context: I rebuilt their website and want them to see the preview.

Requirements:
- Short (under 50 chars)
- Curiosity-driven or personalized
- No spam triggers (FREE, ACT NOW, etc.)
- No emojis

Return as JSON array: ["subject1", "subject2", "subject3"]`;

    try {
      const response = await this.getClient().messages.create({
        model: CONFIG.ai.model,
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0].text;
      return safeParseJsonArray(text, [this.getFallbackSubject(data)]);
    } catch (error) {
      log.warn('Failed to generate subject lines', { error: error.message });
      return [this.getFallbackSubject(data)];
    }
  }

  async generateFollowUp(data, attempt = 1) {
    const templates = {
      1: `Write a follow-up email (first follow-up, 3 days after initial).
- Reference the preview again
- Add social proof or urgency
- Keep it even shorter than original
- Different angle/hook`,

      2: `Write a second follow-up email (7 days after initial).
- "Floating this to the top"
- Mention preview expiring soon
- Offer to walk through it on a call
- Very short, casual`,

      3: `Write a final follow-up email (breakup email, 12 days after initial).
- Let them know you're moving on
- Preview expires in 2 days
- No hard feelings, door open
- Creates FOMO`
    };

    const prompt = `${templates[attempt] || templates[1]}

Business: ${data.businessName}
Preview: ${data.previewUrl}
Industry: ${data.industry}

Under 80 words.`;

    try {
      const response = await this.getClient().messages.create({
        model: CONFIG.ai.model,
        max_tokens: 300,
        system: this.systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      });

      return response.content[0].text.trim();
    } catch (error) {
      log.warn('Failed to generate follow-up', { error: error.message, attempt });
      return this.getFallbackFollowUp(data, attempt);
    }
  }

  getFallbackEmail(data) {
    return `Hey there,

I came across ${data.businessName} and thought your website could use a refresh.

So I built you a new one: ${data.previewUrl}

It's mobile-friendly, loads faster, and designed to convert visitors into customers.

If you'd like to make it live, it's $1000 — that covers everything including domain transfer, hosting setup, and 30 days of support.

No pressure though. The preview will be up for 14 days if you want to take a look.

Worth a quick peek?

Best,
Marc`;
  }

  getFallbackSubject(data) {
    return `Quick question about ${data.businessName}`;
  }

  getFallbackFollowUp(data, attempt) {
    const followUps = {
      1: `Hey — just floating this back up. Built a redesign preview for ${data.businessName}: ${data.previewUrl}

Take a look when you get a chance. Happy to walk through it if you're interested.`,

      2: `Hi — wanted to give you a heads up that the preview site I built for you expires in a few days: ${data.previewUrl}

If you want to hop on a quick call to see it, just let me know.`,

      3: `Hey — closing the loop on this. The preview I built for ${data.businessName} comes down in 2 days.

No worries if it's not a fit. Door's always open if you change your mind down the road.`
    };

    return followUps[attempt] || followUps[1];
  }

  /**
   * Select a subject line variant for A/B testing
   * Returns the variant ID and the rendered subject line
   */
  selectSubjectVariant(data) {
    // Random selection for A/B testing
    const variant = SUBJECT_VARIANTS[Math.floor(Math.random() * SUBJECT_VARIANTS.length)];
    const subject = variant.template.replace('{{businessName}}', data.businessName);

    log.debug('Selected subject variant', { variantId: variant.id, subject });

    return {
      variantId: variant.id,
      subject
    };
  }

  /**
   * Capture before/after screenshots for email
   */
  async captureScreenshots(originalUrl, previewUrl) {
    try {
      log.info('Capturing before/after screenshots for email');
      const screenshots = await captureBeforeAfter(originalUrl, previewUrl);
      return screenshots;
    } catch (error) {
      log.warn('Failed to capture screenshots', { error: error.message });
      return null;
    }
  }
}

/**
 * Calculate days remaining until expiry
 */
export function calculateDaysRemaining(expiryDate) {
  if (!expiryDate) {
    return 14; // Default expiry
  }
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Get expiry display text and styling
 */
function getExpiryDisplay(daysRemaining) {
  if (daysRemaining <= 2) {
    return {
      text: `Preview expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
      color: '#dc2626',
      fontWeight: 'bold'
    };
  } else if (daysRemaining <= 5) {
    return {
      text: `Preview expires in ${daysRemaining} days`,
      color: '#f59e0b',
      fontWeight: '600'
    };
  }
  return {
    text: `Preview expires in ${daysRemaining} days`,
    color: '#6b7280',
    fontWeight: 'normal'
  };
}

/**
 * Wrap email body in HTML with optional screenshots and dynamic expiry
 */
export function wrapInHtml(textBody, previewUrl, businessName, options = {}) {
  const {
    expiryDate = null,
    screenshots = null,
    originalUrl = null
  } = options;

  const daysRemaining = calculateDaysRemaining(expiryDate);
  const expiryDisplay = getExpiryDisplay(daysRemaining);

  const htmlBody = textBody
    .split('\n\n')
    .map(p => `<p style="margin: 0 0 16px 0; line-height: 1.6;">${p}</p>`)
    .join('');

  // Build screenshot comparison section if available
  let screenshotSection = '';
  if (screenshots && screenshots.beforeBase64 && screenshots.afterBase64) {
    screenshotSection = `
  <div style="margin: 32px 0; padding: 24px; background: #f8fafc; border-radius: 12px;">
    <p style="margin: 0 0 16px 0; font-weight: 600; text-align: center; color: #1f2937;">See the transformation:</p>
    <table style="width: 100%; border-spacing: 0; border-collapse: collapse;">
      <tr>
        <td style="width: 48%; text-align: center; vertical-align: top;">
          <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Before</p>
          <img src="${screenshots.beforeBase64}" alt="Current website" style="width: 100%; max-width: 260px; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 2px 4px rgba(0,0,0,0.05);" />
        </td>
        <td style="width: 4%; text-align: center; vertical-align: middle;">
          <span style="font-size: 24px; color: #9ca3af;">→</span>
        </td>
        <td style="width: 48%; text-align: center; vertical-align: top;">
          <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; color: #2563eb; text-transform: uppercase; letter-spacing: 0.05em;">After</p>
          <img src="${screenshots.afterBase64}" alt="New website preview" style="width: 100%; max-width: 260px; border-radius: 8px; border: 2px solid #2563eb; box-shadow: 0 4px 6px rgba(37,99,235,0.15);" />
        </td>
      </tr>
    </table>
  </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">

  ${htmlBody}
  ${screenshotSection}
  <div style="margin: 32px 0; padding: 24px; background: #f3f4f6; border-radius: 12px; text-align: center;">
    <p style="margin: 0 0 16px 0; font-weight: 600;">Your new site preview:</p>
    <a href="${previewUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
      View ${businessName} Redesign →
    </a>
    <p style="margin: 16px 0 0 0; font-size: 14px; color: ${expiryDisplay.color}; font-weight: ${expiryDisplay.fontWeight};">
      ${expiryDisplay.text}
    </p>
  </div>

  <p style="color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 32px;">
    Not interested? No worries — just ignore this email and the preview will expire automatically.
  </p>

</body>
</html>`;
}

export default EmailGenerator;
