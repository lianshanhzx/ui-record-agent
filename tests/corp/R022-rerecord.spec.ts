import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R22 业务信息页面检查", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R22");
});
