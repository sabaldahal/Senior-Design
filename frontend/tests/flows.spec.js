import { test, expect } from '@playwright/test';

const onePixelPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBgN5r4gAAAABJRU5ErkJggg==';

test('required flows: login, dashboard, inventory, add item, alerts', async ({ page }) => {
  // 1) Login
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'AI Inventory' })).toBeVisible();
  await page.getByLabel('Username or Email').fill('demo-user');
  await page.getByLabel('Password').fill('demo-pass');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // 2) Dashboard data load
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Total Items')).toBeVisible();
  await expect(page.getByText('Weekly Activity')).toBeVisible();

  // 3) Inventory list + detail
  await page.getByRole('link', { name: 'Inventory' }).click();
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Item' })).toBeVisible();
  await page.getByRole('link', { name: 'Widget A' }).first().click();
  await expect(page.getByRole('heading', { name: 'Widget A' })).toBeVisible();

  // 4) Add item + image upload
  await page.getByRole('link', { name: 'Add Item' }).click();
  await expect(page.getByRole('heading', { name: 'Add Item' })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'test-item.png',
    mimeType: 'image/png',
    buffer: Buffer.from(onePixelPngBase64, 'base64'),
  });
  await page.getByLabel('Item Name *').fill('Playwright Test Item');
  await page.getByLabel('Quantity *').fill('7');
  await page.getByLabel('Category').fill('Testing');
  await page.getByRole('button', { name: 'Add Item' }).click();
  await expect(page.getByText('Item submitted successfully.')).toBeVisible();

  // 5) Alerts list
  await page.getByRole('link', { name: 'Alerts' }).click();
  await expect(page.getByRole('heading', { name: 'Alerts' })).toBeVisible();
  await expect(page.getByText('Low-stock and system notifications')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View Item' }).first()).toBeVisible();
});
