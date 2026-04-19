import { test, expect } from '@playwright/test';


test.describe('Project Detail', () => {

  let projectUrl: string;

  test.beforeEach(async ({ page }) => {

    await page.goto('/login');
    await page.getByLabel('Username').fill('alessio');
    await page.getByLabel('Password').fill('roadboard2025');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('/dashboard');
    await page.goto('/projects');

    const projectLink = page.locator('a[href^="/projects/"]').first();
    const count = await projectLink.count();

    if (count === 0) {
      test.skip();
      return;
    }

    projectUrl = (await projectLink.getAttribute('href')) ?? '';
    await projectLink.click();
    await expect(page).toHaveURL(/\/projects\/.+/);
  });


  test('shows project header with back link and status badge', async ({ page }) => {

    await expect(page.getByText('← Progetti')).toBeVisible();
    await expect(page.locator('main h1')).toBeVisible();
  });


  test('tab navigation renders all 5 tabs', async ({ page }) => {

    await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tasks' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Fasi' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Decisioni' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Memory' })).toBeVisible();
  });


  test('overview tab is active by default and shows stats', async ({ page }) => {

    const overviewLink = page.getByRole('link', { name: 'Overview' });
    await expect(overviewLink).toHaveClass(/border-indigo-500/);
  });


  test('tasks tab shows task list and create button', async ({ page }) => {

    await page.getByRole('link', { name: 'Tasks' }).click();
    await expect(page).toHaveURL(/\?tab=tasks/);
    await expect(page.getByText('+ Nuovo task')).toBeVisible();
  });


  test('tasks tab: create task form works', async ({ page }) => {

    await page.getByRole('link', { name: 'Tasks' }).click();
    await expect(page).toHaveURL(/\?tab=tasks/);

    await page.getByText('+ Nuovo task').click();
    await page.getByPlaceholder('Titolo task').fill('E2E test task');
    await page.getByRole('button', { name: 'Crea' }).click();

    await expect(page.getByText('E2E test task').first()).toBeVisible();
  });


  test('phases tab shows phases and create button', async ({ page }) => {

    await page.getByRole('link', { name: 'Fasi' }).click();
    await expect(page).toHaveURL(/\?tab=phases/);
    await expect(page.getByText('+ Nuova fase')).toBeVisible();
  });


  test('phases tab: create phase form works', async ({ page }) => {

    await page.getByRole('link', { name: 'Fasi' }).click();

    await page.getByText('+ Nuova fase').click();
    await page.getByPlaceholder('Titolo fase').fill('E2E test phase');
    await page.getByRole('button', { name: 'Crea' }).click();

    await expect(page.getByText('E2E test phase').first()).toBeVisible();
  });


  test('decisions tab shows create button', async ({ page }) => {

    await page.getByRole('link', { name: 'Decisioni' }).click();
    await expect(page).toHaveURL(/\?tab=decisions/);
    await expect(page.getByText('+ Nuova decisione')).toBeVisible();
  });


  test('decisions tab: create decision form works', async ({ page }) => {

    await page.getByRole('link', { name: 'Decisioni' }).click();

    await page.getByText('+ Nuova decisione').click();
    await page.getByPlaceholder('Titolo decisione').fill('E2E decision');
    await page.getByPlaceholder('Sommario *').fill('Decisione presa durante il test e2e');
    await page.getByRole('button', { name: 'Crea' }).click();

    await expect(page.getByText('E2E decision').first()).toBeVisible();
  });


  test('memory tab shows create button', async ({ page }) => {

    await page.getByRole('link', { name: 'Memory' }).click();
    await expect(page).toHaveURL(/\?tab=memory/);
    await expect(page.getByText('+ Nuova entry')).toBeVisible();
  });


  test('memory tab: create memory entry works', async ({ page }) => {

    await page.getByRole('link', { name: 'Memory' }).click();

    await page.getByText('+ Nuova entry').click();
    await page.getByPlaceholder('Titolo').fill('E2E memory entry');
    await page.getByRole('button', { name: 'Crea' }).click();

    await page.waitForLoadState('networkidle');
    await expect(page.getByText('E2E memory entry').first()).toBeVisible({ timeout: 10000 });
  });
});
