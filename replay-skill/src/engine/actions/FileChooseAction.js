// 文件选择动作：点击触发系统文件框的元素，filechooser 中填入 node.value（文件绝对路径），
// 用于「上传」类交易（平台隐藏 input[type=file]，无自定义弹窗，选完即自动上传）
import fs from 'node:fs';
import { PageHelpers } from '../../web/PageHelpers.js';
import { ElementAction } from './ElementAction.js';

export class FileChooseAction extends ElementAction {
  async execute(ctx, node) {
    const page = ctx.page;
    const filePath = node.value;
    if (!filePath || !fs.existsSync(filePath)) throw new Error(`文件不存在：${filePath}`);
    const loc = await PageHelpers.byXpathVisible(page, node.xpath, ctx.stepTimeout, node.name);
    const fcPromise = page.waitForEvent('filechooser', { timeout: 15000 });
    await loc.click();
    const fc = await fcPromise;
    await fc.setFiles(filePath);
    await PageHelpers.settle(page, ctx.profile.settleAfterClickMs);
    return `点击「${node.name}」并选择文件 ${filePath.split('/').pop()}`;
  }
}
