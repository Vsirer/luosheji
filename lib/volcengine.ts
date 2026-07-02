import crypto from 'crypto';

/**
 * Volcengine V4 Signature Implementation
 */
export async function volcSign(
  ak: string,
  sk: string,
  method: string,
  path: string,
  query: Record<string, string>,
  headers: Record<string, string>,
  body: string,
  service: string,
  region: string,
  host: string
) {
  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = timestamp.substring(0, 8);
  
  const normalizedHeaders: Record<string, string> = {};
  for (const k of Object.keys(headers)) {
    normalizedHeaders[k.toLowerCase()] = String(headers[k]).trim();
  }
  
  const signedHeaders: Record<string, string> = {
    ...normalizedHeaders,
    'host': host,
    'x-content-sha256': crypto.createHash('sha256').update(body).digest('hex'),
    'x-date': timestamp,
  };

  const headerKeys = Object.keys(signedHeaders).sort();
  const canonicalHeaders = headerKeys.map(k => `${k}:${signedHeaders[k]}`).join('\n') + '\n';
  const signedHeadersStr = headerKeys.join(';');

  const canonicalQuery = Object.keys(query)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join('&');

  const canonicalRequest = [
    method.toUpperCase(),
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeadersStr,
    signedHeaders['x-content-sha256']
  ].join('\n');

  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const credentialScope = `${date}/${region}/${service}/request`;
  const stringToSign = [
    'HMAC-SHA256',
    timestamp,
    credentialScope,
    hashedCanonicalRequest
  ].join('\n');

  const kDate = hmac(sk, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'request');

  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  signedHeaders['Authorization'] = `HMAC-SHA256 Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;

  return signedHeaders;
}

function hmac(key: string | Buffer, data: string) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

/**
 * Volcengine Fetch Wrapper
 */
export async function volcFetch(options: {
  ak: string,
  sk: string,
  method: string,
  action: string,
  version: string,
  body: any,
  service: string,
  region: string,
  endpoint?: string
}) {
  const { ak, sk, method, action, version, body, service, region, endpoint } = options;
  const baseUrl = endpoint || `https://ark.cn-beijing.volces.com`;
  const urlObj = new URL(baseUrl);
  const host = urlObj.host;
  const path = urlObj.pathname === '/' ? '/' : urlObj.pathname;
  
  const query = {
    Action: action,
    Version: version
  };
  
  const jsonBody = JSON.stringify(body);
  const signedHeaders = await volcSign(ak, sk, method, path, query, {
    'content-type': 'application/json'
  }, jsonBody, service, region, host);

  const url = `${baseUrl}${path}?${new URLSearchParams(query).toString()}`;
  
  return fetch(url, {
    method: method,
    headers: signedHeaders,
    body: jsonBody
  });
}
