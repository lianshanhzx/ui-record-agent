import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R101 财务报表头信息修改", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R101");
});
