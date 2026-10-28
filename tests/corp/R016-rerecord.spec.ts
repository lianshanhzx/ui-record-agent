import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R16 正式客户查看与只读校验", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R16");
});
