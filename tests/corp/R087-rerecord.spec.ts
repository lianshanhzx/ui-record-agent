import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R87 与其他客户关联信息修改", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R87");
});
