import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R141 法院条件重置", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R141");
});
