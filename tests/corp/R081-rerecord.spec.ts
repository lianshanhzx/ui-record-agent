import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R81 关联人信息-高管删除", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R81");
});
