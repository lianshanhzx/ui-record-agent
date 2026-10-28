import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R32 资产信息查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R32");
});
