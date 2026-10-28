import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R111 他行存款修改", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R111");
});
