import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R66 对外投资信息删除", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R66");
});
