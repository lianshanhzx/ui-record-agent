import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R31 资产信息修改", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R31");
});
