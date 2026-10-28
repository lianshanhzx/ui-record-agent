import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R35 保险信息修改", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R35");
});
