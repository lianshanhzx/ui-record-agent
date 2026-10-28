import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R70 股东信息新增", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R70");
});
