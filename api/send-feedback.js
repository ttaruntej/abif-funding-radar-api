import nodemailer from 'nodemailer';
import { parseAccessPasswords, requireAccessToken } from './_lib/auth.js';
import { applyCors, handleOptions, rejectDisallowedOrigin } from './_lib/cors.js';
import { fetchRepositoryJson, updateRepositoryJson } from './_lib/github.js';
import { enforceRateLimit } from './_lib/rate-limit.js';

const FEEDBACK_FALLBACK = 'tbimanager@abif.iitkgp.ac.in';

export default async function handler(req, res) {
  const corsState = applyCors(req, res);

  if (handleOptions(req, res)) {
    return;
  }

  if (rejectDisallowedOrigin(req, res, corsState)) {
    return;
  }

  if (req.method === 'GET') {
    const action = req.query?.action;
    if (action === 'fetch_suggestions') {
      const configuredPasswords = parseAccessPasswords();
      if (!requireAccessToken(req, res, configuredPasswords)) {
        return;
      }

      try {
        const { data: suggestions } = await fetchRepositoryJson('public/data/suggestions.json');
        return res.status(200).json(suggestions);
      } catch (error) {
        return res.status(500).json({ error: error.message || 'Failed to fetch suggestions' });
      }
    }
    return res.status(400).json({ error: 'Invalid action' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, { scope: 'send-feedback', limit: 20, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  const configuredPasswords = parseAccessPasswords();
  if (!requireAccessToken(req, res, configuredPasswords)) {
    return;
  }

  const { feedback, userEmail, timestamp } = req.body || {};
  if (typeof feedback !== 'string' || feedback.trim() === '') {
    return res.status(400).json({ error: 'Feedback text is required' });
  }

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
    FEEDBACK_TO,
    ABIF_TEAM_EMAIL
  } = process.env;

  const safeUserEmail = typeof userEmail === 'string' && userEmail.trim() ? userEmail.trim() : 'Anonymous';
  const safeTimestamp = timestamp ? new Date(timestamp) : new Date();

  // 1. Persist to GitHub
  try {
    await updateRepositoryJson(
      'public/data/suggestions.json',
      (current) => {
        const list = Array.isArray(current) ? current : [];
        list.push({
          id: crypto.randomUUID?.() || Date.now().toString(),
          email: safeUserEmail,
          feedback: feedback.trim(),
          timestamp: safeTimestamp.toISOString()
        });
        return list;
      },
      `feat: record ecosystem suggestion from ${safeUserEmail}`
    );
  } catch (err) {
    console.error('Failed to persist suggestion:', err);
    // Continue anyway to send email if possible
  }

  // 2. Send Email
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    // If SMTP is not configured, we just return success after persisting
    return res.status(200).json({ message: 'Feedback recorded' });
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  const recipient = FEEDBACK_TO || ABIF_TEAM_EMAIL || FEEDBACK_FALLBACK;

  try {
    await transporter.sendMail({
      from: `"ABIF Feedback Radar" <${SMTP_FROM}>`,
      to: recipient,
      subject: `[Suggestion] Funding Radar Ecosystem Insight - ${new Date().toLocaleDateString('en-IN')}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; padding: 32px; border-radius: 20px;">
          <h1 style="font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.04em; color: #0f172a; margin-bottom: 20px;">Strategic Feedback Identified</h1>
          <div style="background-color: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0;">
            <p style="font-weight: 700; font-size: 13px; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">Suggestion Content</p>
            <p style="font-size: 16px; line-height: 1.6; color: #1e293b; margin-bottom: 24px;">"${feedback.trim()}"</p>
            <div style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
              <p style="font-size: 12px; color: #475569; margin: 0 0 8px 0;"><strong>Sender:</strong> ${safeUserEmail}</p>
              <p style="font-size: 12px; color: #475569; margin: 0;"><strong>Recorded:</strong> ${safeTimestamp.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
            </div>
          </div>
        </div>
      `
    });

    return res.status(200).json({ message: 'Feedback sent and recorded' });
  } catch (error) {
    // If email fails but persistence succeeded, we might still want to report success to user
    return res.status(200).json({ message: 'Feedback recorded (notification delay)', error: error.message });
  }
}
