import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R07 新增保存校验", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R07");
});
