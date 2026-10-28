import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R71 股东信息修改", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R71");
});
