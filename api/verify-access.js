export default async function handler(req, res) {
    // Enable CORS
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { password } = req.body || {};
    const REPO_OWNER = 'ttaruntej';
    const REPO_NAME = 'abif-funding-radar';
    const GH_TOKEN = process.env.GH_TOKEN || process.env.GH_PAT;

    if (!GH_TOKEN) {
        console.error('❌ GH_TOKEN missing in Environment Variables');
        return res.status(500).json({ error: 'Relay misconfigured: Token missing' });
    }

    try {
        console.log(`🔐 [Auth Relay] Sending verification request to GitHub for repo: ${REPO_OWNER}/${REPO_NAME}`);

        // 1. Trigger GitHub Action
        const trigger = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/auth-verify.yml/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GH_TOKEN}`,
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'ABIF-Vercel-Relay'
            },
            body: JSON.stringify({ ref: 'main', inputs: { password } })
        });

        if (trigger.status !== 204) {
            const errText = await trigger.text();
            console.error('GitHub trigger failed:', trigger.status, errText);
            throw new Error('GitHub trigger failed');
        }

        // 2. Poll for Result (max ~25s)
        let attempts = 0;
        while (attempts < 15) {
            attempts++;
            await new Promise(r => setTimeout(r, 1500));

            const runsRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/auth-verify.yml/runs?per_page=1`, {
                headers: {
                    'Authorization': `Bearer ${GH_TOKEN}`,
                    'Accept': 'application/vnd.github+json',
                    'User-Agent': 'ABIF-Vercel-Relay'
                }
            });

            const runs = await runsRes.json();
            const lastRun = runs.workflow_runs?.[0];

            // Run must be recent (within last 2 mins) and completed
            if (lastRun && (new Date() - new Date(lastRun.created_at)) < 120000 && lastRun.status === 'completed') {
                if (lastRun.conclusion === 'success') {
                    console.log('✅ Access Granted by GitHub');
                    return res.status(200).json({ success: true });
                } else {
                    console.log('❌ Access Denied by GitHub');
                    return res.status(401).json({ success: false });
                }
            }
        }

        console.warn('⚠️ Verification timed out after polling GitHub');
        return res.status(504).json({ success: false, error: 'Verification timed out' });

    } catch (err) {
        console.error('Relay error:', err);
        return res.status(500).json({ success: false, error: 'Relay failure' });
    }
}
