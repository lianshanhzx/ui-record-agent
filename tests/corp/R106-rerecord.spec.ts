import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R106 财报OCR入口与取消", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R106");
});
