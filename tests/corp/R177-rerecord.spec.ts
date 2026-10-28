import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R177 删除本轮财务测试影像", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R177");
});
