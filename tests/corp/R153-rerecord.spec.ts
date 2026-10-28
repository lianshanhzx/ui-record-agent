import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R153 股票发行信息查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R153");
});
