import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R44 联系信息查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R44");
});
