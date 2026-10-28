import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R40 税费信息查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R40");
});
