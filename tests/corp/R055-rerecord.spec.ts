import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R55 参与项目情况新增", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R55");
});
