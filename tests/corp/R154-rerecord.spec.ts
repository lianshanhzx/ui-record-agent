import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R154 股票发行信息删除", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R154");
});
