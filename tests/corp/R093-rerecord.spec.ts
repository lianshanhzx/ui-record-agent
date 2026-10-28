import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R93 个人股东家族成员删除", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R93");
});
