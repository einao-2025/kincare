import { expect, test } from '@playwright/test';
import { registerAndLogin, uniqueUser } from './helpers';

test.describe('Patient onboarding flow', () => {
  test('register → login → land on dashboard', async ({ page }) => {
    const user = uniqueUser();
    await registerAndLogin(user); // bootstraps the account via API

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/password/i).fill(user.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/overview/i)).toBeVisible();
  });

  test('dashboard sidebar exposes patient nav links', async ({ page }) => {
    const user = uniqueUser();
    await registerAndLogin(user);

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/password/i).fill(user.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/);

    for (const label of [/medical history/i, /prescriptions/i, /test results/i,
                         /imaging/i, /family access/i, /notifications/i, /profile/i]) {
      await expect(page.getByRole('link', { name: label })).toBeVisible();
    }
  });
});
