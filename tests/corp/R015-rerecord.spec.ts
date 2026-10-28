import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R15 担保客户查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R15");
});
