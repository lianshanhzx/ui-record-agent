import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R56 参与项目情况修改", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R56");
});
