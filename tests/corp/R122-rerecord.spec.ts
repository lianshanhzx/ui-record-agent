import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R122 历史修改记录查询及登记信息查看", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R122");
});
