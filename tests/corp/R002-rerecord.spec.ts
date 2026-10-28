import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R02 列表无结果查询", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R02");
});
