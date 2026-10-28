import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R01 列表八条件查询", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R01");
});
