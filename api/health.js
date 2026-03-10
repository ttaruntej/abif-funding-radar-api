import { applyCors, handleOptions } from './_lib/cors.js';
import { getGitHubToken, getRepoConfig } from './_lib/github.js';

export default async function handler(req, res) {
  const { allowedOrigins, selectedOrigin } = applyCors(req, res);

  if (handleOptions(req, res)) {
    return;
  }

  const repo = getRepoConfig();

  res.status(200).json({
    ok: true,
    service: 'abif-funding-radar-api',
    timestamp: new Date().toISOString(),
    githubTokenConfigured: Boolean(getGitHubToken()),
    allowedOrigins,
    selectedOrigin,
    repo: {
      owner: repo.repoOwner,
      name: repo.repoName,
      ref: repo.ref
    },
    workflows: {
      email: repo.emailWorkflowId,
      sync: repo.syncWorkflowId
    }
  });
}
