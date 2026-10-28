import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R74 受益人信息新增", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R74");
});
