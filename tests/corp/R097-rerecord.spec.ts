import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R97 自然人股东信息删除", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R97");
});
