import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R34 保险信息新增", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R34");
});
