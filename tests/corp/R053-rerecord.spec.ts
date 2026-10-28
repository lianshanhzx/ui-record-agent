import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R53 客户资质信息查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R53");
});
