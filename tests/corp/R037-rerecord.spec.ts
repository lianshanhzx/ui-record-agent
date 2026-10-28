import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R37 保险信息删除", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R37");
});
