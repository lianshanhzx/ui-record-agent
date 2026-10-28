import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R165 移动本轮测试影像", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R165");
});
