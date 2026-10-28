import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R94 股东信息新增-自然人", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R94");
});
