import { test, expect } from '@playwright/test';

test('smoke: record pipeline works', async ({ page }) => {
  await page.setContent('<h1 id="title">hello</h1><button id="btn">click</button>');
  await page.click('#btn');
  await expect(page.locator('#title')).toHaveText('hello');
});
