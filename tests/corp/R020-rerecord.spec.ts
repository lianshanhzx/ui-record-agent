import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R20 客户综合信息页面检查", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R20");
});
