import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R58 参与项目情况删除", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R58");
});
