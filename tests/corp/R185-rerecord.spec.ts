import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R185 潜客概况修改与持久化反查", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R185");
});
