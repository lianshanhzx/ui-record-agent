import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R85 关联人信息-家族成员删除", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R85");
});
