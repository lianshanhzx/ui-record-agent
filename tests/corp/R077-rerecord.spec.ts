import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R77 受益人信息删除与重新查询验证", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R77");
});
