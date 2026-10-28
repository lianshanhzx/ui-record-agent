import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R90 关联人信息新增-实际控制人家族成员", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R90");
});
