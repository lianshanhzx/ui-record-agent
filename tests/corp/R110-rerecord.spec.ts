import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R110 他行存款新增", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R110");
});
