import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R05 未选记录入口校验", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R05");
});
