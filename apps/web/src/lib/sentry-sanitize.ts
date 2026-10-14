const sensitiveKey = /^(authorization|cookie|set-cookie|password|current_password|confirmation|code|token|token_hash|access_token|refresh_token)$/i;
const sensitiveQueryKey = /^(code|token|token_hash|access_token|refresh_token)$/i;
const resetPath = /^\/(?:forgot-password|reset-password|auth\/callback)(?:\/|$)/;

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitiveKey.test(key) ? '[Filtered]' : sanitizeValue(item),
    ]),
  );
}

export function sanitizeSentryUrl(value: unknown) {
  if (typeof value !== 'string') return value;

  try {
    const url = new URL(value);
    if (resetPath.test(url.pathname)) {
      return `${url.origin}${url.pathname}`;
    }
    for (const key of [...url.searchParams.keys()]) {
      if (sensitiveQueryKey.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return value;
  }
}

export function sanitizeSentryBreadcrumb<T extends Record<string, unknown>>(breadcrumb: T): T {
  return sanitizeValue(breadcrumb) as T;
}

export function sanitizeSentryEvent<T extends Record<string, unknown>>(event: T): T {
  const sanitized = sanitizeValue(event) as Record<string, unknown>;
  const request = sanitized.request as Record<string, unknown> | undefined;
  if (request) request.url = sanitizeSentryUrl(request.url);
  if (typeof sanitized.transaction === 'string') sanitized.transaction = sanitizeSentryUrl(sanitized.transaction);

  const breadcrumbs = sanitized.breadcrumbs;
  if (Array.isArray(breadcrumbs)) {
    sanitized.breadcrumbs = breadcrumbs.map((breadcrumb) => {
      if (!breadcrumb || typeof breadcrumb !== 'object') return breadcrumb;
      const item = breadcrumb as Record<string, unknown>;
      return {
        ...item,
        ...(typeof item.message === 'string' ? { message: sanitizeSentryUrl(item.message) } : {}),
        ...(item.data && typeof item.data === 'object'
          ? { data: sanitizeValue(item.data) }
          : {}),
      };
    });
  }

  return sanitized as T;
}
