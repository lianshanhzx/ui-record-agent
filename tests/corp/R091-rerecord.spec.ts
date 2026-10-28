import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R91 实际控制人家族成员删除", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R91");
});
