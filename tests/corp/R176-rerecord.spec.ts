import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R176 上传用于删除验证的财务测试影像", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R176");
});
