import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R39 税费信息修改", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R39");
});
