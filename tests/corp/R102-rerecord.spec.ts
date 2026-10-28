import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R102 财报四表指标编辑、校验及保存", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R102");
});
