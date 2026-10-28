import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R160 影像资料目录和文件查询", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R160");
});
