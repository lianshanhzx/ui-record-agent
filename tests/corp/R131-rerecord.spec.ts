import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R131 联网核查历史条件重置", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R131");
});
