import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R43 联系信息修改", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R43");
});
