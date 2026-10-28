import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R78 关联人信息新增-高管", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R78");
});
