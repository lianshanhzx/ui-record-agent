import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R182 征信历史条件查询与重置", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R182");
});
