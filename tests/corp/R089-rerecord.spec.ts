import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R89 与其他客户关联信息删除", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R89");
});
