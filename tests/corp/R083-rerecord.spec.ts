import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R83 关联人信息-家族成员修改", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R83");
});
