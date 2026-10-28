import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R11 新增担保客户", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R11");
});
