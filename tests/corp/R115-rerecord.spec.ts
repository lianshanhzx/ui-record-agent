import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R115 本行账户信息获取", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R115");
});
