export function genIdNo(): string {
  const start = Date.UTC(1980, 0, 1);
  const end = Date.UTC(1995, 11, 31);
  const d = new Date(start + Math.floor(Math.random() * (end - start)));
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  const base = '110101' + ymd + seq;
  const w = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const c = '10X98765432';
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += +base[i] * w[i];
  return base + c[sum % 11];
}

export const ts14 = () => new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
