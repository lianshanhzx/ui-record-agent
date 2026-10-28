import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R183 手机号验证历史清单检查", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R183");
});
