import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R61 企业债券发行情况查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R61");
});
