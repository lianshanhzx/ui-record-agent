import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R03 列表八条件重置", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R03");
});
