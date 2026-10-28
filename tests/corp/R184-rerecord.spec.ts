import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R184 新增对私潜客子入口与取消", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R184");
});
