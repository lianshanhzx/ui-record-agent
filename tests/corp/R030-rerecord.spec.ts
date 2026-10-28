import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R30 资产信息新增", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R30");
});
