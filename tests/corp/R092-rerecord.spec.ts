import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R92 关联人信息新增-个人股东家族成员", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R92");
});
