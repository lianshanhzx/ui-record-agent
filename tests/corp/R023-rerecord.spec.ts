import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R23 影像资料页面检查", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R23");
});
