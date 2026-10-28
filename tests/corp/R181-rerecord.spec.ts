import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R181 客户关系图谱全屏与导出", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R181");
});
