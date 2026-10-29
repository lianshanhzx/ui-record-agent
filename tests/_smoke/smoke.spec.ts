import { test, expect } from '@playwright/test';

// 冒烟用例不依赖登录态，因此显式忽略全局 storageState（auth.json 由使用者自备）
test.use({ storageState: undefined });

test('smoke: record pipeline works', async ({ page }) => {
  await page.setContent('<h1 id="title">hello</h1><button id="btn">click</button>');
  await page.click('#btn');
  await expect(page.locator('#title')).toHaveText('hello');
});
