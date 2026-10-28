import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R17 股票场景企业草稿初始化", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R17");
});
