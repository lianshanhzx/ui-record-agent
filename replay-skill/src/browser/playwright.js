// Playwright 入口适配：优先独立包 playwright，回退 @playwright/test
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = await import('@playwright/test'));
}

export { chromium };
