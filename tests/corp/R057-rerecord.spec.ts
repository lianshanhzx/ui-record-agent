import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R57 参与项目情况查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R57");
});
