import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R96 自然人股东信息查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R96");
});
