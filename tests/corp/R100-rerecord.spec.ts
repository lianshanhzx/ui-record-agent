import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R100 财务信息新增入口", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R100");
});
