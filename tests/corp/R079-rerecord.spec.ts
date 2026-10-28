import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R79 关联人信息-高管修改", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R79");
});
