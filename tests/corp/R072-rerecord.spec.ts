import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R72 股东信息查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R72");
});
