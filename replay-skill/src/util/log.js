// 通用日志与延时工具
export function log(...m) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(ts, ...m);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
