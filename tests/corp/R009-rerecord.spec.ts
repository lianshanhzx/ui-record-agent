import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R09 新增潜客客户", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R09");
});
