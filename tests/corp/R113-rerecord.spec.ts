import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R113 他行存款删除", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R113");
});
