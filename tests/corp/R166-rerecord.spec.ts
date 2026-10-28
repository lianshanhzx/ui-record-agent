import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R166 批量下载本轮测试影像", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R166");
});
