// 平台配置（Profile）：加载 profiles/*.json 并合并默认值，屏蔽字段缺失
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_PROFILE = path.join(SKILL_DIR, 'profiles', 'tansun-credit.json');

const DEFAULTS = {
  homeRoute: '/',
  viewport: { width: 1440, height: 900 },
  login: {
    loggedInUrlShouldNotContain: '/login',
    loginButtonText: '登录',
    captchaValue: '1234',
  },
  pages: [],
  popups: [],
  popupFallbackSelector: '.el-dialog, .el-message-box',
  backButtonText: null,
  tableRowSelector: 'tbody tr',
  tableReadySelector: '',
  selectDropdownItemSelector: '.el-select-dropdown__item',
  errorToastSelector: '.el-message--error, .el-notification--error',
  downloadTriggers: [],
  downloads: { knownEmptyFiles: [] },
  settleAfterClickMs: 1000,
  settleAfterInputMs: 300,
};

function deepMerge(target, source) {
  for (const [k, v] of Object.entries(source || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

export function loadProfile(profilePath) {
  const p = path.resolve(profilePath || DEFAULT_PROFILE);
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const profile = deepMerge(structuredClone(DEFAULTS), raw);
  profile._path = p;
  return profile;
}
