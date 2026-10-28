import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R75 受益人信息日期修改", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R75");
});
