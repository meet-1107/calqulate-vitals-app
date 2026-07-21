/**
 * Firebase Cloud Messaging over HTTP v1, without the firebase-admin SDK.
 *
 * The whole dependency exists to do two things we can do with Node's crypto:
 * mint a service-account JWT and trade it for an OAuth access token. So we do
 * that here and POST straight to the v1 send endpoint.
 */

const crypto = require('crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

/** Error codes meaning the token is dead and should be removed from `devices`. */
const DEAD_TOKEN_CODES = new Set(['UNREGISTERED', 'INVALID_ARGUMENT']);

let cachedToken = null; // { accessToken, expiresAt }

function config() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Service-account PEMs are stored in .env with literal \n escapes.
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

const isConfigured = () => config() !== null;

const b64url = (input) => Buffer.from(input).toString('base64url');

/**
 * Build a RS256 JWT asserting "this service account wants the FCM scope".
 * Google's token endpoint exchanges it (grant_type=jwt-bearer) for a bearer
 * token valid for an hour, which is what the send endpoint actually accepts.
 */
function mintAssertion({ clientEmail, privateKey }) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${claims}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signingInput)
    .sign(privateKey)
    .toString('base64url');
  return `${signingInput}.${signature}`;
}

async function getAccessToken(cfg) {
  // Refresh a minute early so a token never expires mid-batch.
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.accessToken;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: mintAssertion(cfg),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`FCM token exchange failed (${res.status}): ${JSON.stringify(json)}`);

  cachedToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in || 3600) * 1000,
  };
  return cachedToken.accessToken;
}

async function sendOne(cfg, accessToken, token, { title, body, data }) {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/messages:send`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: { token, notification: { title, body }, data: data || undefined },
      }),
    }
  );
  if (res.ok) return { ok: true };

  const json = await res.json().catch(() => ({}));
  const code = json?.error?.details?.find((d) => d.errorCode)?.errorCode || json?.error?.status;
  return { ok: false, dead: DEAD_TOKEN_CODES.has(code), code: code || `HTTP_${res.status}` };
}

/**
 * Send one notification to many device tokens.
 * Returns `{ dryRun, sent, failed, deadTokens }`. When Firebase is not
 * configured this resolves as a dry run instead of throwing, so the panel can
 * still record what *would* have gone out.
 */
async function sendToTokens(tokens, { title, body, data }, { concurrency = 20 } = {}) {
  const cfg = config();
  if (!cfg) return { dryRun: true, sent: 0, failed: 0, deadTokens: [], reason: 'firebase-not-configured' };
  if (tokens.length === 0) return { dryRun: false, sent: 0, failed: 0, deadTokens: [] };

  const accessToken = await getAccessToken(cfg);
  const deadTokens = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < tokens.length; i += concurrency) {
    const batch = tokens.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map((token) =>
        sendOne(cfg, accessToken, token, { title, body, data }).catch((err) => ({
          ok: false,
          dead: false,
          code: err.message,
        }))
      )
    );
    results.forEach((result, idx) => {
      if (result.ok) sent += 1;
      else {
        failed += 1;
        if (result.dead) deadTokens.push(batch[idx]);
      }
    });
  }

  return { dryRun: false, sent, failed, deadTokens };
}

module.exports = { sendToTokens, isConfigured };
