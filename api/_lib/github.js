const API_BASE = 'https://api.github.com';

export const getRepoConfig = () => ({
  repoOwner: process.env.GH_REPO_OWNER || 'ttaruntej',
  repoName: process.env.GH_REPO_NAME || 'abif-funding-radar',
  ref: process.env.GH_REF || 'main',
  emailWorkflowId: process.env.EMAIL_WORKFLOW_ID || 'send-email.yml',
  syncWorkflowId: process.env.SYNC_WORKFLOW_ID || 'source-sync.yml'
});

export const getGitHubToken = () => process.env.GH_TOKEN || process.env.GH_PAT || '';

const buildHeaders = () => {
  const token = getGitHubToken();
  if (!token) {
    throw new Error('GitHub token not configured');
  }

  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'ABIF-Funding-Radar-API',
    'X-GitHub-Api-Version': '2022-11-28'
  };
};

const parseError = async (response) => {
  try {
    const payload = await response.json();
    return payload.message || 'GitHub API request failed';
  } catch (error) {
    const payload = await response.text();
    return payload || 'GitHub API request failed';
  }
};

const githubFetch = async (path, init = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...buildHeaders(),
      ...(init.headers || {})
    }
  });

  return response;
};

export const dispatchWorkflow = async (workflowId, inputs = undefined) => {
  const { repoOwner, repoName, ref } = getRepoConfig();
  const response = await githubFetch(`/repos/${repoOwner}/${repoName}/actions/workflows/${workflowId}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({
      ref,
      ...(inputs ? { inputs } : {})
    })
  });

  if (response.status === 204) {
    return { ok: true };
  }

  return {
    ok: false,
    status: response.status,
    error: await parseError(response)
  };
};

export const fetchLatestWorkflowRun = async (workflowId) => {
  const { repoOwner, repoName } = getRepoConfig();
  const response = await githubFetch(`/repos/${repoOwner}/${repoName}/actions/workflows/${workflowId}/runs?per_page=1`);

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const payload = await response.json();
  return payload.workflow_runs?.[0] || null;
};

export const fetchRepositoryJson = async (repoPath) => {
  const { repoOwner, repoName } = getRepoConfig();
  const response = await githubFetch(`/repos/${repoOwner}/${repoName}/contents/${repoPath}`);

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const payload = await response.json();
  const content = Buffer.from(payload.content, 'base64').toString('utf-8');
  return {
    data: JSON.parse(content),
    sha: payload.sha
  };
};

export const updateRepositoryJson = async (repoPath, updateFn, message = 'Update JSON data') => {
  const { repoOwner, repoName, ref } = getRepoConfig();

  // 1. Fetch current content and SHA
  let currentData = null;
  let sha = null;

  try {
    const { data: fetchedData, sha: fetchedSha } = await fetchRepositoryJson(repoPath);
    currentData = fetchedData;
    sha = fetchedSha;
  } catch (error) {
    // If file doesn't exist, we start with null/empty depending on use case
    // For suggestions, we expect it to exist or we can default to empty array
    currentData = [];
  }

  // 2. Apply update
  const updatedData = updateFn(currentData);

  // 3. Push back to GitHub
  const response = await githubFetch(`/repos/${repoOwner}/${repoName}/contents/${repoPath}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: Buffer.from(JSON.stringify(updatedData, null, 2)).toString('base64'),
      sha, // only required if updating
      branch: ref
    })
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return { ok: true };
};
