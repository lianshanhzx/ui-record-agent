import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R80 关联人信息-高管查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R80");
});
