import { test, expect } from '@playwright/test';


test.describe('Projects', () => {

  test.beforeEach(async ({ page }) => {

    await page.goto('/login');
    await page.getByLabel('Username').fill('alessio');
    await page.getByLabel('Password').fill('roadboard2025');
    await page.getByRole('button', { name: 'Accedi' }).click();
    await expect(page).toHaveURL('/projects');
  });


  test('dashboard shows project list', async ({ page }) => {

    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
    await expect(page.locator('header').getByRole('link', { name: 'RoadBoard' })).toBeVisible();
  });


  test('nav shows RoadBoard title and sign out', async ({ page }) => {

    await expect(page.locator('header').getByRole('link', { name: 'RoadBoard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });


  test('clicking a project navigates to detail page', async ({ page }) => {

    const projectLink = page.locator('a[href^="/projects/"]').first();

    const count = await projectLink.count();

    if (count === 0) {
      test.skip();
      return;
    }

    await projectLink.click();
    await expect(page).toHaveURL(/\/projects\/.+/);
    await expect(page.getByText('← Projects')).toBeVisible();
  });
});
