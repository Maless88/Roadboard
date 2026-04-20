import { test, expect } from '@playwright/test';


test.describe('Projects', () => {

  test.beforeEach(async ({ page }) => {

    await page.goto('/login');
    await page.getByLabel('Username').fill('alessio');
    await page.getByLabel('Password').fill('roadboard2025');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('/dashboard');
  });


  test('dashboard shows project list', async ({ page }) => {

    await expect(page.getByRole('heading', { name: 'Progetti' })).toBeVisible();
    await expect(page.locator('aside').getByText('RoadBoard')).toBeVisible();
  });


  test('nav shows RoadBoard title and sign out', async ({ page }) => {

    await expect(page.locator('aside').getByText('RoadBoard')).toBeVisible();
    await page.locator('aside button').filter({ hasText: 'alessio' }).click();
    await expect(page.getByRole('button', { name: 'Esci' })).toBeVisible();
  });


  test('clicking a project navigates to detail page', async ({ page }) => {

    const card = page.locator('[data-testid="project-card"]').first();

    const count = await card.count();

    if (count === 0) {
      test.skip();
      return;
    }

    const href = await card.getAttribute('data-project-href');
    await card.click();
    await expect(page).toHaveURL(new RegExp(`${href}(\\?|$)`));
    await expect(page.getByText('← Progetti')).toBeVisible();
  });
});
