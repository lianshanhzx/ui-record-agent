import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R95 自然人股东信息修改", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R95");
});
