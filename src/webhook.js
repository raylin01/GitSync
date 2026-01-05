// Webhook handler - receives push events from GitHub/GitLab/Gitea
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify GitHub webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - X-Hub-Signature-256 header value
 * @param {string} secret - Webhook secret
 * @returns {boolean} Whether signature is valid
 */
export function verifyGitHubSignature(payload, signature, secret) {
  if (!signature || !secret) return !secret; // If no secret configured, skip verification
  
  const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
  
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Verify GitLab webhook token
 * @param {string} token - X-Gitlab-Token header value
 * @param {string} secret - Configured secret
 * @returns {boolean} Whether token is valid
 */
export function verifyGitLabToken(token, secret) {
  if (!secret) return true; // If no secret configured, skip verification
  return token === secret;
}

/**
 * Verify Gitea webhook signature (same as GitHub)
 */
export const verifyGiteaSignature = verifyGitHubSignature;

/**
 * Parse GitHub push event
 * @param {Object} body - Webhook payload
 * @returns {Object} Parsed event info
 */
export function parseGitHubPush(body) {
  const ref = body.ref || '';
  const branch = ref.replace('refs/heads/', '');
  
  return {
    provider: 'github',
    event: 'push',
    branch,
    repository: body.repository?.name || null,
    fullName: body.repository?.full_name || null,
    commits: body.commits?.length || 0,
    pusher: body.pusher?.name || null,
    headCommit: body.head_commit?.id || null,
  };
}

/**
 * Parse GitLab push event
 * @param {Object} body - Webhook payload
 * @returns {Object} Parsed event info
 */
export function parseGitLabPush(body) {
  const ref = body.ref || '';
  const branch = ref.replace('refs/heads/', '');
  
  return {
    provider: 'gitlab',
    event: 'push',
    branch,
    repository: body.project?.name || body.repository?.name || null,
    fullName: body.project?.path_with_namespace || null,
    commits: body.total_commits_count || body.commits?.length || 0,
    pusher: body.user_name || null,
    headCommit: body.checkout_sha || body.after || null,
  };
}

/**
 * Parse Gitea push event
 * @param {Object} body - Webhook payload
 * @returns {Object} Parsed event info
 */
export function parseGiteaPush(body) {
  const ref = body.ref || '';
  const branch = ref.replace('refs/heads/', '');
  
  return {
    provider: 'gitea',
    event: 'push',
    branch,
    repository: body.repository?.name || null,
    fullName: body.repository?.full_name || null,
    commits: body.commits?.length || 0,
    pusher: body.pusher?.login || body.pusher?.username || null,
    headCommit: body.after || null,
  };
}

/**
 * Create the webhook HTTP server using Bun.serve
 * @param {Object} config - Full configuration
 * @param {Function} onPush - Callback when a push event is received: (repoConfig, pushInfo) => void
 * @returns {Object} Bun server instance
 */
export function createWebhookServer(config, onPush) {
  const { port, secret } = config.webhook;
  
  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      
      // Health check endpoint
      if (url.pathname === '/health' && req.method === 'GET') {
        return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
      }
      
      // Webhook endpoints
      if (req.method === 'POST' && url.pathname.startsWith('/webhook')) {
        const rawBody = await req.text();
        let body;
        try {
          body = JSON.parse(rawBody);
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 });
        }
        
        let pushInfo;
        let isValid = false;
        
        // Detect provider from headers or path
        const githubEvent = req.headers.get('X-GitHub-Event');
        const gitlabToken = req.headers.get('X-Gitlab-Token');
        const giteaEvent = req.headers.get('X-Gitea-Event');
        
        if (githubEvent || url.pathname === '/webhook/github') {
          // GitHub webhook
          const signature = req.headers.get('X-Hub-Signature-256');
          isValid = verifyGitHubSignature(rawBody, signature, secret);
          if (githubEvent === 'push' || body.ref) {
            pushInfo = parseGitHubPush(body);
          }
        } else if (gitlabToken || url.pathname === '/webhook/gitlab') {
          // GitLab webhook
          isValid = verifyGitLabToken(gitlabToken, secret);
          if (body.object_kind === 'push' || body.ref) {
            pushInfo = parseGitLabPush(body);
          }
        } else if (giteaEvent || url.pathname === '/webhook/gitea') {
          // Gitea webhook
          const signature = req.headers.get('X-Gitea-Signature');
          isValid = verifyGiteaSignature(rawBody, signature, secret);
          if (giteaEvent === 'push' || body.ref) {
            pushInfo = parseGiteaPush(body);
          }
        } else {
          // Generic - try to auto-detect
          isValid = true; // No verification for generic
          if (body.ref) {
            pushInfo = parseGitHubPush(body); // Use GitHub format as default
          }
        }
        
        if (!isValid) {
          console.warn('⚠️  Webhook signature verification failed');
          return Response.json({ error: 'Invalid signature' }, { status: 401 });
        }
        
        if (!pushInfo) {
          return Response.json({ message: 'Event ignored (not a push)' }, { status: 200 });
        }
        
        console.log(`\n📨 Received push from ${pushInfo.provider}: ${pushInfo.fullName || pushInfo.repository} → ${pushInfo.branch}`);
        
        // Find matching repo config
        const matchingRepo = config.repos.find(r => {
          // Match by branch
          if (r.branch !== pushInfo.branch) return false;
          // Match by name (flexible matching)
          if (r.name === pushInfo.repository) return true;
          if (r.name === pushInfo.fullName) return true;
          // Could also match by path if we had repo URL in config
          return false;
        });
        
        if (!matchingRepo) {
          console.log(`⏭️  No matching repo config for ${pushInfo.repository}/${pushInfo.branch}`);
          return Response.json({ message: 'No matching repo configuration' }, { status: 200 });
        }
        
        // Trigger the deployment
        console.log(`🚀 Triggering deployment for ${matchingRepo.name}...`);
        
        // Call the onPush callback (async, don't await to respond quickly)
        onPush(matchingRepo, pushInfo).catch(err => {
          console.error(`❌ Deployment failed: ${err.message}`);
        });
        
        return Response.json({ 
          message: 'Deployment triggered',
          repo: matchingRepo.name,
          branch: pushInfo.branch
        });
      }
      
      // Default 404
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
  });
  
  console.log(`🌐 Webhook server listening on port ${port}`);
  console.log(`   Endpoints: POST /webhook/github, /webhook/gitlab, /webhook/gitea`);
  console.log(`   Health: GET /health`);
  
  return server;
}
