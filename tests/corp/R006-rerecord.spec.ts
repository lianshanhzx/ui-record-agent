import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R06 新增抽屉初始化与取消", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R06");
});
