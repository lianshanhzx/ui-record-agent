import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R104 财报模板选择与下载", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R104");
});
