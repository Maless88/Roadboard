import { test, expect } from '@playwright/test';


test.describe('Authentication', () => {

  test('redirects unauthenticated user to login', async ({ page }) => {

    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });


  test('login page renders correctly', async ({ page }) => {

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'RoadBoard' })).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });


  test('login with valid credentials navigates to dashboard', async ({ page }) => {

    await page.goto('/login');
    await page.getByLabel('Username').fill('alessio');
    await page.getByLabel('Password').fill('roadboard2025');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { name: 'Progetti' })).toBeVisible();
  });


  test('login with invalid credentials stays on login', async ({ page }) => {

    await page.goto('/login');
    await page.getByLabel('Username').fill('alessio');
    await page.getByLabel('Password').fill('wrong-password');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL('/login');
  });


  test('sign out navigates back to login', async ({ page }) => {

    await page.goto('/login');
    await page.getByLabel('Username').fill('alessio');
    await page.getByLabel('Password').fill('roadboard2025');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL('/dashboard');

    await page.locator('aside button').filter({ hasText: 'alessio' }).click();
    await page.getByRole('button', { name: 'Esci' }).click();
    await expect(page).toHaveURL('/login');
  });
});
