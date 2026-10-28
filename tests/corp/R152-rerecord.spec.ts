import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R152 股票发行信息修改", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R152");
});
