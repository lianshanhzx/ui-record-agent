import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R150 客户标签当前界面检查", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R150");
});
