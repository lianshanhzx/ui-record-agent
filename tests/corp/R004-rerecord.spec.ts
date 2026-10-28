import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R04 列表分页", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R04");
});
