import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R45 联系信息删除", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R45");
});
