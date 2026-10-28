import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R14 潜客客户查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R14");
});
