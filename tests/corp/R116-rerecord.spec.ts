import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R116 他行贷款信息页面检查", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R116");
});
