import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R164 下载本轮测试影像", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R164");
});
