import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R82 关联人信息新增-法定代表人家族成员", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R82");
});
