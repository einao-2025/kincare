import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { CsrfMiddleware } from '../common/csrf.middleware';

function makeMiddleware() {
  const cfg = { getOrThrow: () => 'csrf-test-secret', get: () => 'development' } as unknown as ConfigService;
  return new CsrfMiddleware(cfg);
}

function makeReq(opts: Partial<{ method: string; url: string; cookies: Record<string,string>; headers: Record<string,string> }>) {
  return {
    method: opts.method ?? 'GET',
    originalUrl: opts.url ?? '/api/v1/patients',
    path: opts.url ?? '/api/v1/patients',
    cookies: opts.cookies ?? {},
    headers: opts.headers ?? {},
    socket: {},
  } as any;
}
function makeRes() {
  const cookies: Record<string, string> = {};
  return {
    cookies,
    cookie: (n: string, v: string) => { cookies[n] = v; },
  } as any;
}

describe('CsrfMiddleware', () => {
  it('issues a csrf_token cookie on safe requests', () => {
    const mw = makeMiddleware();
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    let nextCalled = false;
    mw.use(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res.cookies.csrf_token).toMatch(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });

  it('blocks unsafe requests missing the token', () => {
    const mw = makeMiddleware();
    const req = makeReq({ method: 'POST', cookies: { session: 'abc' } });
    expect(() => mw.use(req, makeRes(), () => {})).toThrow(ForbiddenException);
  });

  it('allows unsafe requests when header matches valid cookie', () => {
    const mw = makeMiddleware();
    // Issue a token first
    const issueReq = makeReq({ method: 'GET' });
    const issueRes = makeRes();
    mw.use(issueReq, issueRes, () => {});
    const token = issueRes.cookies.csrf_token!;

    const req = makeReq({
      method: 'POST',
      cookies: { csrf_token: token },
      headers: { 'x-csrf-token': token },
    });
    let nextCalled = false;
    mw.use(req, makeRes(), () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('allows bearer-only requests with no cookies (mobile / API clients)', () => {
    const mw = makeMiddleware();
    const req = makeReq({ method: 'POST', headers: { authorization: 'Bearer xyz' } });
    let nextCalled = false;
    mw.use(req, makeRes(), () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('skips exempt paths', () => {
    const mw = makeMiddleware();
    const req = makeReq({ method: 'POST', url: '/api/v1/auth/login' });
    let nextCalled = false;
    mw.use(req, makeRes(), () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });
});
