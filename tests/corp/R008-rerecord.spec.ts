import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R08 OCR入口与前置校验", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R08");
});
