import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R109 删除本轮财务报表", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R109");
});
