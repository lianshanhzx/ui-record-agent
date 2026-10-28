import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R73 股东信息删除", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R73");
});
