import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R84 关联人信息-家族成员查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R84");
});
