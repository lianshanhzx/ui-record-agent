import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R65 对外投资信息查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R65");
});
