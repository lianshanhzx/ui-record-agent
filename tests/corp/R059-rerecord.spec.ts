import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R59 企业债券发行情况新增", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R59");
});
