import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R162 财务目录上传本轮测试影像", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R162");
});
