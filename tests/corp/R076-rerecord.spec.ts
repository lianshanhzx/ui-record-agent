import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R76 受益人信息查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R76");
});
