import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R52 客户资质信息修改", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R52");
});
