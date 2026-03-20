import { parseAccessPasswords, requireAccessToken } from './_lib/auth.js';
import { applyCors, handleOptions, rejectDisallowedOrigin } from './_lib/cors.js';
import { dispatchWorkflow, fetchLatestWorkflowRun, fetchRepositoryJson, getGitHubToken, getRepoConfig } from './_lib/github.js';
import { enforceRateLimit } from './_lib/rate-limit.js';

const sanitizeRecipients = (rawRecipients) => {
  if (typeof rawRecipients !== 'string' || rawRecipients.trim() === '') {
    return '';
  }

  return rawRecipients
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    .slice(0, 10)
    .join(',');
};

export default async function handler(req, res) {
  const corsState = applyCors(req, res);

  if (handleOptions(req, res)) {
    return;
  }

  if (rejectDisallowedOrigin(req, res, corsState)) {
    return;
  }

  if (!enforceRateLimit(req, res, { scope: 'trigger-email', limit: 60, windowMs: 10 * 60 * 1000 })) {
    return;
  }

  const configuredPasswords = parseAccessPasswords();
  if (!requireAccessToken(req, res, configuredPasswords)) {
    return;
  }

  if (!getGitHubToken()) {
    return res.status(500).json({ error: 'GitHub token not configured' });
  }

  const { emailWorkflowId } = getRepoConfig();

  if (req.method === 'POST') {
    const { target_emails, mode, filters } = req.body || {};
    const sanitizedRecipients = sanitizeRecipients(target_emails);

    if (typeof target_emails !== 'string' || target_emails.trim() === '') {
      return res.status(400).json({ error: 'At least one email recipient is required' });
    }

    if (!sanitizedRecipients) {
      return res.status(400).json({ error: 'No valid email recipients found in the provided list' });
    }

    try {
      const result = await dispatchWorkflow(emailWorkflowId, {
        target_emails: sanitizedRecipients,
        mode: mode || 'standard',
        filters: JSON.stringify(filters || {})
      });

      if (!result.ok) {
        return res.status(result.status || 500).json({ error: result.error || 'Failed to trigger email workflow' });
      }

      return res.status(200).json({ message: 'Email action triggered' });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Failed to trigger email workflow' });
    }
  }

  if (req.method === 'GET') {
    const action = req.query?.action;

    if (action === 'fetch_meta') {
      try {
        const { data: meta } = await fetchRepositoryJson('public/data/last_dispatch_meta.json');
        return res.status(200).json(meta);
      } catch (error) {
        return res.status(500).json({ error: error.message || 'Failed to fetch dispatch metadata' });
      }
    }

    try {
      const lastRun = await fetchLatestWorkflowRun(emailWorkflowId);

      if (!lastRun) {
        return res.status(200).json({ status: 'unknown' });
      }

      return res.status(200).json({
        status: lastRun.status,
        conclusion: lastRun.conclusion,
        updated_at: lastRun.updated_at,
        run_id: lastRun.id
      });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Failed to fetch email workflow status' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
