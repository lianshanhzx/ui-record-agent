import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R88 与其他客户关联信息查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R88");
});
