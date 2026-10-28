import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R121 管理团队删除", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R121");
});
