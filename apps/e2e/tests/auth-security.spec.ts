import { expect, request, test } from '@playwright/test';
import { uniqueUser } from './helpers';

const API = process.env.API_URL ?? 'http://localhost:4000';

test.describe('Authentication security', () => {
  test('rejects login with wrong password', async () => {
    const ctx = await request.newContext({ baseURL: API });
    const user = uniqueUser();
    await ctx.post('/api/v1/auth/register', { data: user });

    const bad = await ctx.post('/api/v1/auth/login', {
      data: { email: user.email, password: 'totally-wrong-password' },
    });
    expect(bad.status()).toBe(401);
  });

  test('rate-limits a flood of login attempts from the same IP+email', async () => {
    const ctx = await request.newContext({ baseURL: API });
    const user = uniqueUser();
    await ctx.post('/api/v1/auth/register', { data: user });

    let saw429 = false;
    for (let i = 0; i < 12; i++) {
      const r = await ctx.post('/api/v1/auth/login', {
        data: { email: user.email, password: 'wrong' },
      });
      if (r.status() === 429) { saw429 = true; break; }
    }
    expect(saw429).toBe(true);
  });

  test('protects audit chain integrity endpoint behind RBAC', async () => {
    const ctx = await request.newContext({ baseURL: API });
    const r = await ctx.get('/api/v1/audit/verify');
    expect([401, 403]).toContain(r.status());
  });
});
