import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R117 他行担保信息当前界面检查", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R117");
});
