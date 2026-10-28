// 网络恢复监视器：每 60s 探测内网域名解析，成功则写 NET-OK.txt 并退出（最多 6h）
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const HOST = 'test.creditv5p2.tansun.com.cn';
const MARK = path.resolve(__dirname, 'NET-OK.txt');
const LOG = path.resolve(__dirname, 'netwatch.log');
const t0 = Date.now();
if (fs.existsSync(MARK)) fs.unlinkSync(MARK);
const log = m => { const line = new Date().toISOString() + ' ' + m + '\n'; fs.appendFileSync(LOG, line); console.log(line.trim()); };
(async () => {
  while (Date.now() - t0 < 6 * 3600 * 1000) {
    try {
      const out = execSync(`nslookup ${HOST} 172.19.76.235`, { timeout: 15000, encoding: 'utf8' });
      const failed = /can't find|timed out|Non-existent|Server failed|找不到|超时/.test(out);
      const m = out.match(/Name:.*?[\r\n]+Addresses?:\s*(\d+\.\d+\.\d+\.\d+)/s) || out.match(/Name:.*?[\r\n]+Address:\s*(\d+\.\d+\.\d+\.\d+)/s);
      const ip = (!failed && m && m[1] !== '172.19.76.235') ? m[1] : null;
      if (ip) { fs.writeFileSync(MARK, `NET_OK ${new Date().toISOString()} ${HOST} -> ${ip}\n`); log('NET_OK ' + ip); return; }
      log('no-ip: ' + out.replace(/\s+/g, ' ').slice(0, 100));
    } catch (e) { log('fail: ' + String(e.message).split('\n')[0].slice(0, 80)); }
    await new Promise(r => setTimeout(r, 60000));
  }
  log('GAVE_UP after 6h');
})();
