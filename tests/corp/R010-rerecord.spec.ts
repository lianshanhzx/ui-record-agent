import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R10 潜在客户正式保存", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R10");
});
