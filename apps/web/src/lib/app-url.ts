type AppUrlEnvironment = {
  appUrl?: string;
  nodeEnv?: string;
};

const authCallbackPaths = new Set(['/account', '/reset-password']);

function invalidAppUrl(): never {
  throw new Error('NEXT_PUBLIC_APP_URL harus berupa URL HTTPS tanpa path, query, atau fragment.');
}

export function getConfiguredAppUrl(environment: AppUrlEnvironment = {}) {
  const appUrl = environment.appUrl ?? process.env.NEXT_PUBLIC_APP_URL;
  const nodeEnv = environment.nodeEnv ?? process.env.NODE_ENV;
  if (!appUrl) invalidAppUrl();

  let url: URL | null = null;
  try {
    url = new URL(appUrl);
  } catch {
    invalidAppUrl();
  }

  if (
    !url ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    (nodeEnv === 'production' && url.protocol !== 'https:')
  ) {
    invalidAppUrl();
  }

  return url;
}

export function buildConfiguredAppUrl(path: string, environment: AppUrlEnvironment = {}) {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('Path redirect internal tidak valid.');
  }
  return new URL(path, getConfiguredAppUrl(environment)).toString();
}

export function getAllowedAuthCallbackPath(requestedPath: string | null) {
  return requestedPath && authCallbackPaths.has(requestedPath)
    ? requestedPath
    : '/reset-password';
}
