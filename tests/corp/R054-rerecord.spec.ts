import { test } from '@playwright/test';
import { replayRecordedCase } from './rerecordCase';
test("R54 客户资质信息删除", async () => {
  test.setTimeout(300000);
  await replayRecordedCase("R54");
});
