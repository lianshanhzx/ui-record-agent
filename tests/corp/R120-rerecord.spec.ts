import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R120 管理团队新增", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R120");
});
