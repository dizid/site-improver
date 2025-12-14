// src/emailGenerator.js
import Anthropic from '@anthropic-ai/sdk';
import logger from './logger.js';
import { CONFIG } from './config.js';
import { safeParseJsonArray } from './utils.js';

const log = logger.child('emailGenerator');

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
}

export function wrapInHtml(textBody, previewUrl, businessName) {
  const htmlBody = textBody
    .split('\n\n')
    .map(p => `<p style="margin: 0 0 16px 0; line-height: 1.6;">${p}</p>`)
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  
  ${htmlBody}
  
  <div style="margin: 32px 0; padding: 24px; background: #f3f4f6; border-radius: 12px;">
    <p style="margin: 0 0 16px 0; font-weight: 600;">Your new site preview:</p>
    <a href="${previewUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
      View ${businessName} Redesign →
    </a>
    <p style="margin: 16px 0 0 0; font-size: 14px; color: #6b7280;">
      Preview expires in 14 days
    </p>
  </div>
  
  <p style="color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 32px;">
    Not interested? No worries — just ignore this email and the preview will expire automatically.
  </p>
  
</body>
</html>`;
}

export default EmailGenerator;
