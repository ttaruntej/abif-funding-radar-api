import { applyCors, handleOptions } from './_lib/cors.js';
import { dispatchWorkflow, fetchLatestWorkflowRun, getGitHubToken, getRepoConfig } from './_lib/github.js';

export default async function handler(req, res) {
  applyCors(req, res);

  if (handleOptions(req, res)) {
    return;
  }

  if (!getGitHubToken()) {
    return res.status(500).json({ error: 'GitHub token not configured' });
  }

  const { syncWorkflowId } = getRepoConfig();

  if (req.method === 'POST') {
    try {
      const result = await dispatchWorkflow(syncWorkflowId);
      if (!result.ok) {
        return res.status(result.status || 500).json({ error: result.error || 'Failed to trigger sync workflow' });
      }

      return res.status(200).json({ message: 'Verified source sync triggered' });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Failed to trigger sync workflow' });
    }
  }

  if (req.method === 'GET') {
    try {
      const lastRun = await fetchLatestWorkflowRun(syncWorkflowId);

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
      return res.status(500).json({ error: error.message || 'Failed to fetch sync status' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
