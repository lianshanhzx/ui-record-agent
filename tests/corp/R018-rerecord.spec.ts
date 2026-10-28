import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R18 新增依赖客户", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R18");
});
