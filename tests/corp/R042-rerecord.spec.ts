import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R42 联系信息新增", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R42");
});
