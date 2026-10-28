// 仓储（Repository）：发现并加载 wire 报文
// 目录输入按文件名自然序（T1, T2, T2b, T3…），支持 --only 关键字过滤
import fs from 'node:fs';
import path from 'node:path';
import { WireTransaction } from './WireTransaction.js';

export class WireRepository {
  constructor() {
    this.wireDir = null;
  }

  discover(input, only = '') {
    const abs = path.resolve(input);
    let dir;
    let files;
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      dir = abs;
      files = this.naturalSort(fs.readdirSync(abs).filter((f) => f.toLowerCase().endsWith('.json')))
        .map((f) => path.join(abs, f));
    } else {
      dir = path.dirname(abs);
      files = [abs];
    }
    this.wireDir = dir;

    const out = [];
    for (const f of files) {
      const doc = JSON.parse(fs.readFileSync(f, 'utf8'));
      const stem = path.basename(f, '.json');
      for (const txn of doc.transcationEventTypeList || []) {
        if (only && !stem.includes(only) && !(txn.transcationName || '').includes(only)) continue;
        out.push(new WireTransaction(stem, txn));
      }
    }
    return out;
  }

  naturalSort(names) {
    return names.slice().sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  }
}
