import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R114 业务空列表入口校验", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R114");
});
