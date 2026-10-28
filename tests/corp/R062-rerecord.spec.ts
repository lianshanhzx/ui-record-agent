import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R62 企业债券发行情况删除", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R62");
});
