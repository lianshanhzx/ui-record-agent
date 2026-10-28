import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R86 与其他客户关联信息新增", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R86");
});
