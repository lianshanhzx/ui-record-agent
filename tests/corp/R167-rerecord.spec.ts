import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R167 本轮测试影像图册查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R167");
});
