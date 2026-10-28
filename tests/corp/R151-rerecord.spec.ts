import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R151 上市标志联动与股票发行新增", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R151");
});
