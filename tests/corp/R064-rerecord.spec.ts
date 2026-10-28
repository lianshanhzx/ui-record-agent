import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R64 对外投资信息修改", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R64");
});
