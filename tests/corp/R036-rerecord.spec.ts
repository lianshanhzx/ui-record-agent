import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R36 保险信息查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R36");
});
