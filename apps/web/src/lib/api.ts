import { useAuthStore } from './auth-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const CSRF_COOKIE = 'csrf_token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface ApiOptions extends RequestInit {
  json?: unknown;
  /** When true, do NOT attempt to attach the Authorization header. */
  anonymous?: boolean;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
  }
  return null;
}

let csrfPrimed = false;
async function ensureCsrfCookie(): Promise<void> {
  if (csrfPrimed || readCookie(CSRF_COOKIE)) {
    csrfPrimed = true;
    return;
  }
  // Hit a cheap, non-exempt GET so the middleware mints + sets the cookie.
  try {
    await fetch(`${API_BASE}/api/v1/auth/csrf`, { method: 'GET', credentials: 'include' });
  } catch {
    /* ignore — request will fail downstream with a clearer error */
  }
  csrfPrimed = true;
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { json, anonymous, headers, ...rest } = opts;
  const method = (rest.method ?? 'GET').toUpperCase();
  const token = anonymous ? null : useAuthStore.getState().accessToken;

  if (!SAFE_METHODS.has(method)) {
    await ensureCsrfCookie();
  }
  const csrf = !SAFE_METHODS.has(method) ? readCookie(CSRF_COOKIE) : null;

  // When the body is FormData (file upload) we let the browser set the
  // multipart boundary, so we must not pre-populate Content-Type ourselves.
  const isFormData = typeof FormData !== 'undefined' && rest.body instanceof FormData;

  const init: RequestInit = {
    ...rest,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      ...(headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: 'include',
  };

  const res = await fetch(`${API_BASE}/api/v1${path}`, init);

  if (res.status === 401 && !anonymous) {
    const refreshed = await tryRefresh();
    if (refreshed) return api<T>(path, opts);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function tryRefresh(): Promise<boolean> {
  const rt = useAuthStore.getState().refreshToken;
  if (!rt) return false;
  const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  });
  if (!res.ok) { useAuthStore.getState().clear(); return false; }
  const data = await res.json();
  useAuthStore.setState({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return true;
}
