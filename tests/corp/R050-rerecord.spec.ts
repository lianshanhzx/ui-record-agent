import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R50 经营情况维护", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R50");
});
