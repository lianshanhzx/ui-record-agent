import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R140 法院信息条件查询", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R140");
});
