import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R112 他行存款查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R112");
});
