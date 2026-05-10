import { request } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

const API = process.env.API_URL ?? 'http://localhost:4000';

export function uniqueUser(prefix = 'patient'): TestUser {
  const id = Math.random().toString(36).slice(2, 10);
  return {
    email: `${prefix}+${id}@kincare.test`,
    password: 'P@ssw0rd!_e2e_kincare',
    firstName: 'Test',
    lastName: prefix,
  };
}

export async function registerAndLogin(user: TestUser): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  const ctx = await request.newContext({ baseURL: API });
  await ctx.post('/api/v1/auth/register', { data: user });
  const res = await ctx.post('/api/v1/auth/login', { data: { email: user.email, password: user.password } });
  if (!res.ok()) throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  const json = await res.json();
  return { accessToken: json.accessToken, refreshToken: json.refreshToken, userId: json.user.id };
}
