import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R130 联网核查窗口与历史查询", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R130");
});
