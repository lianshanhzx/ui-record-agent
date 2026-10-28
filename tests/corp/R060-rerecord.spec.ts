import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R60 企业债券发行情况修改", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R60");
});
