---
name: ty-element-operations
description: 当需要在网页上识别并操作常见表单/交互元素（点击、输入框、下拉选择、树形选择、单选、复选框、日期、范围区间）时使用。按元素类型给出识别特征、标准操作步骤、结果校验与常见坑，适用于 Element UI / 原生 HTML 的管理后台页面。
---

# 网页元素操作 Skill（按元素类型）

按类型组织，每类给出「**识别特征 → 操作步骤 → 结果校验 → 常见坑**」。
适用环境：Vue + Element UI 为主的管理后台，兼顾原生 HTML 控件。

## 0. 通用规则（所有类型先读）

1. **等待可见**：定位元素后确认已连接（`isConnected`）且宽高 > 0、非 `display:none` / `visibility:hidden`；轮询等待（如 100ms 一轮，超时 5s）。
2. **滚动到视野**：`scrollIntoView({ block: 'center', inline: 'nearest' })`，再 `focus()`（若可用）。
3. **清空旧值要重新解析**：清空可能触发框架重渲染并替换节点，清空后必须重新定位，不要复用旧引用。
4. **写值用原生 setter**：直接 `element.value = x` 会被 Vue/React 受控组件还原，必须用 property descriptor 的原生 setter + 派发 `input`/`change` 事件。
5. **浮层面板每次重新找**：下拉/日期/树的面板常 teleport 到 `document.body`，开关一次 DOM 就变，不要缓存面板节点。
6. **校验失败重试一次**：重试前重新解析定位（受控组件可能已替换节点），仍失败才报错并给出「期望值 / 实际值」。

通用工具片段（各类型复用）：

```js
async function waitVisible(locator, timeout = 5000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const el = resolve(locator)                       // 每次重新解析定位
    if (el && el.isConnected) {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      if (r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden') return el
    }
    await wait(100)
  }
  throw new Error('未找到可见元素: ' + locator)
}

function setNativeValue(el, v) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter ? setter.call(el, v) : (el.value = v)
  el.setAttribute('value', v)
  el.dispatchEvent(new Event('input',  { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function readValue(el) {
  if (el.type === 'checkbox' || el.type === 'radio') return !!el.checked
  if (el.tagName === 'SELECT') { const o = el.options[el.selectedIndex]; return o ? (o.value || o.textContent.trim()) : '' }
  const select = el.closest('.el-select')
  if (select) {
    const tags = [...select.querySelectorAll('.el-select__tags-text')].map(t => t.textContent.trim()).filter(Boolean)
    if (tags.length) return tags.join(',')
    const sel = select.querySelector('.el-select__selected-item, .el-select__selection-text')
    if (sel && sel.textContent.trim()) return sel.textContent.trim()
  }
  return el.value == null ? '' : String(el.value)
}
```

---

## 1. 点击（按钮 / 链接 / 页签 / 图标）

**识别特征**：`button`、`a`、`input[type=button|submit|reset]`、`[role="button"]`、`[role="link"]`、`[role="tab"]`、`.el-button`，以及各类图标按钮。

**操作步骤**：
1. 等待可见 → 滚动居中 → focus。
2. `element.click()`。

**结果校验**：点击无「值」可校验，校验**副作用**：弹窗出现、页签激活、列表刷新等。

**常见坑**：
- 组件库常忽略非信任（脚本合成）事件 → 用真实事件语义 `mousedown` → `mouseup` → `click`。
- 按钮被遮罩遮挡 → 先等弹窗动画结束/关闭遮罩再点。
- 点击会改变页面结构（开弹窗、切页签）→ 点击后等待新区域出现，再执行后续操作。

---

## 2. 输入框（单行 / 多行文本）

**识别特征**：`input`（type 为 text/password/number/email/tel/search 等）或 `textarea`；**排除**日期编辑器（`.el-date-editor`、`.tsscdatepicker`）、下拉（`select`、`.el-select`）、单选/复选。

**操作步骤**：
1. 等待可见 → 滚动居中 → focus。
2. （可选）清空已有值并派发 `input`/`change`，清空后**重新定位**。
3. 等待约 220ms 让组件稳定。
4. `setNativeValue(el, value)`（原生 setter + `input`/`change`）。
5. 需要触发失焦校验时，延迟约 50ms 派发 `blur`。
6. 等待约 350ms。

**结果校验**：读值（原生 `value` getter 优先，兼容 Vue/React）与目标值 `trim()` 后比较；失败重试 1 次（重新定位 + focus + 重写）。

**常见坑**：
- 只赋值 `element.value` 不生效 → 必须原生 setter + 事件。
- 受控组件替换节点 → 校验/重试前重新解析定位。
- 输入触发联想/搜索请求 → 等联想框关闭或结果稳定后再校验。

---

## 3. 下拉选择（原生 select / Element UI 下拉）

**识别特征**：
- 原生：`select` 元素。
- Element UI：触发框为 `.el-select` 内的 `input`；选项为 `.el-select-dropdown__item` 或 `[role="option"]`。

**操作步骤**：

原生 `select`：
```js
const opt = [...el.options].find(o => o.value === v || o.textContent.trim() === v)
if (!opt) throw new Error('未找到下拉选项: ' + v)
el.value = opt.value
el.dispatchEvent(new Event('change', { bubbles: true }))
```

Element UI `.el-select`：
1. 等待触发框可见 → 滚动 → focus；已有清除按钮（`.el-input__clear` / `.el-select__clear`）且需重选时先点清除，清后重新定位。
2. `el.click()` 打开面板。
3. 轮询查找**可见**选项（宽高 > 0、不在 `[aria-hidden="true"]` 内、非 `is-disabled` / `aria-disabled="true"`），按文本精确匹配（或 `data-value` / `value` 属性匹配）。
4. 选中：
```js
opt.scrollIntoView({ block: 'nearest' })
opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }))
opt.click()
```
5. 等待约 350ms。

**结果校验**：用 `readValue` 读取选中值（多选为逗号拼接的标签文本）与目标比较；支持与「选中项文案」比较。

**常见坑**：
- 面板 teleport 到 body，每次重新解析，不缓存面板。
- 页面可能残留**隐藏的旧面板** → 只接受可见候选。
- 选项需滚动才能见 → `scrollIntoView({ block:'nearest' })` 后重查。
- 多选重复点击会取消已选项 → 先读当前值，已包含则跳过。
- 直接改触发框文本不生效 → 必须走「打开面板 → 点选项」。

---

## 4. 树形选择（树选择器 / 树下拉）

**识别特征**：
- 触发框：`input` 位于 `.el-tree-select` / `.tree-select` / `.ant-tree-select` / `.ivu-tree-select` / `.t-tree-select` / `[data-tree-select]` / `[aria-haspopup="tree"]`；或其外层节点 `aria-controls` / `aria-owns` / `aria-describedby` 指向含树的浮层。
- 树容器：`.el-tree` / `[role="tree"]` / `.ant-tree` / `.ivu-tree` / `.t-tree`。
- 树节点：`.el-tree-node__content` / `[role="treeitem"]` / `.ant-tree-node-content-wrapper` / `.ant-tree-title` / `.ivu-tree-title` / `.t-tree__label`。
- 浮层容器：`.el-popover` / `.el-popper` / `.el-dialog` / `.ant-tree-select-dropdown` / `.ant-select-dropdown` / `.t-popup` / `.t-dialog`（内含树）。

**操作步骤**：
1. 等待**触发框**可见 → 滚动 → focus → `click()` 打开树浮层。
2. 在可见树中按文本**逐级**查找目标节点：
   - 非叶子节点 → 点击展开，等待子级出现，继续下一级；
   - 叶子节点 → 点击选中，结束。
3. 选中后等待约 150ms（组件延迟写回入口值）再读取。

**叶子节点判定**（按优先级）：
- 有 `.el-tree-node__expand-icon` → 含 `is-leaf` 即叶子；
- `aria-expanded` 为 `"true"`/`"false"` → 非叶子；
- 有 `.ant-tree-switcher:not(.ant-tree-switcher-noop)` / `.ivu-tree-arrow` / `.t-tree__icon` → 非叶子;
- 无子容器（`.el-tree-node__children` / `.ant-tree-child-tree` / `.ivu-tree-children` / `.t-tree__item`）→ 叶子。

**结果校验**：入口 `input` 的值（或所选节点文本）与目标文本 `trim()` 比较。

**常见坑**：
- 浮层 teleport 到 body，节点脱离原表单层级 → 定位入口用触发框，节点在浮层内按文本 + 可见性查找。
- 非叶子被当叶子点击 → 只展开未选中，务必先做叶子判定。
- 浮层未关闭但已选中叶子 → 叶子命中即视为完成。
- 同屏多个树浮层 → 用 `aria-controls/owns/describedby` 关联到具体浮层。
- 入口值延迟写回 → 读值前等一个事件循环。

---

## 5. 单选（radio）

**识别特征**：`input[type="radio"]`，或 Element UI `.el-radio` 内的 `input[type=radio]`；同组共享 `name` 属性。

**操作步骤**：
1. 等待可见 → 滚动 → focus。
2. （可选）按 `name` 清空同组其它选中（置 `checked=false` 并派发 `change`），清后重新定位。
3. `if (!el.checked) el.click()`。

**结果校验**：`el.checked === true`（布尔比较）。

**常见坑**：
- 已选中再点击可能触发 change → 先判 `checked`，已选则跳过。
- label 与 input 未关联时点文字无效 → 直接操作 `input[type=radio]`。
- 表格内自定义单选只派发组件事件 → 操作外层 `.el-radio` 内的 input。

---

## 6. 复选框（checkbox）

**识别特征**：`input[type="checkbox"]`，或 `.el-checkbox` 内的 input；易与下拉混淆，先看 `type` 属性。

**操作步骤**：
1. 等待可见 → 滚动 → focus。
2. 读取当前态，**与目标态不一致才点击**：
```js
if (el.checked !== expected) el.click()
```

**结果校验**：`el.checked === expected`（布尔比较）。

**常见坑**：
- 半选态（indeterminate）视觉已选但 `checked` 为 false → 以目标态为准执行点击后再校验。
- 「全选」联动影响多项 → 按顺序执行，不要把全选拆成逐项。
- 重复点击会翻转状态 → 严格按目标态判断后再点击。

---

## 7. 日期 / 日期时间选择器（单值）

**识别特征**：元素位于 `.el-date-editor` / `.tsscdatepicker` 内；面板为 `.el-picker-panel` / `.el-date-picker` / `.el-time-panel`；日历表格 `.el-date-table`，表头 `.el-date-picker__header`。

**操作步骤**（先直接赋值，失败再点日历）：

1. **原生赋值 + 同步组件 model**：
```js
setNativeValue(el, value)            // 原生 setter + input/change
// 提高成功率：同步 Vue model
const formItem = el.closest('.el-form-item')
const prop = formItem?.getAttribute('prop') || ''
const formEl = el.closest('.el-form')
const vm = formEl?.__vue__
if (vm && prop) {
  const model = vm.model || vm.$props?.model
  if (model && prop in model) { model[prop] = value; vm.validateField?.(prop) }
}
```
2. **兜底：打开面板点选日期**（步骤 1 未生效时）：
   - 对 `input` / `.el-icon-date` / `.el-input__inner` / 编辑器容器依次派发 `mousedown` → `mouseup` → `click` → `focus`，最多 3 轮；每轮后面板轮询（每 300ms，最多 5 次）。
   - 可见面板判定：`display!=='none' && visibility!=='hidden' && offsetParent!==null && 内含 .el-date-table`。
   - 翻年月：解析 `YYYY-MM-DD`；用表头两个 `.el-date-picker__header-label` 读当前年月，`.el-icon-d-arrow-left/right` 逐年、`.el-icon-arrow-left/right` 逐月调整（带安全上限）。
   - 点日：遍历 `.el-date-table td`，取文本等于目标日且**不含** `prev-month` / `next-month` / `disabled` 的单元格 `click()`。
3. 仍未生效时，延迟 50ms 派发 `blur`。

**结果校验**：优先读组件 model（`__vue__` 的 `value` / `$data.value` / `modelValue` / `$props.value`），回退 `input.value`；`trim()` 后比较。失败重试 1 次（重新定位）。

**常见坑**：
- 只设 `value` 组件不认 → 必须派发 `input`/`change` 并同步 model。
- 面板未打开就找日期 → 多轮点击 + 轮询面板。
- 目标日期不在当前月 → 先翻年再翻月，再点日。
- `prev-month` / `next-month` 单元格干扰 → 明确排除。
- 点选后 DOM 值滞后 → 校验时优先读 `__vue__` model。

---

## 8. 范围 / 区间（日期区间、数值区间、滑块区间）

**识别特征**：
- 日期区间：同一 `.el-date-editor` / `.tsscdatepicker` 容器内**两个** `input`，或存在 `.el-date-range-picker` 面板（左右两张 `.el-date-table`）。
- 数值/金额区间：同一 `.el-form-item` 内成对出现的 `input`，文案常含「范围 / 区间 / 起始-截止」。
- 滑块区间：`.el-slider` 双滑块（两个 `.el-slider__button`）或成对 `[role="slider"]`。

**操作步骤**：

日期区间：
1. 定位区间容器，取两个 `input`（`querySelectorAll('input')` 或 `[1]` / `[2]` 序号区分）。
2. 打开面板后：**左表点开始日、右表点结束日**（必要时先翻年月）；或使用面板快捷选项。
3. 若实现为两个独立输入框：分别对两个 input 走第 7 节的「原生赋值 + 同步 model」流程。

数值区间：
```js
setNativeValue(minEl, String(min))
setNativeValue(maxEl, String(max))
```
（若为单输入框要求 `min-max` 格式，则写整串。）

滑块区间：优先走组件 model 赋值；无 model 时模拟拖拽/键盘调整两个滑块。

**结果校验**：开始与结束（或 min / max）**分别**读取并比较；组件把区间写入单一 model（数组或 `start,end`）时以该 model 为准。

**常见坑**：
- 区间日历需要两次点击 → 只点左表会漏结束日期。
- 两个 input 定位相同 → 用容器内序号区分。
- 值分隔符多样（`,` / `~` / ` - `）→ 拆分时兼容。
- 开始 > 结束 → 按给定的开始/结束值写入，不要自动交换。
- 滑块无输入框 → 走 model 或模拟拖拽。

---

## 9. 快速选择决策表

| 页面上看到 | 用哪节 |
| --- | --- |
| 按钮 / 链接 / 页签 / 图标 | 1 |
| 文本、数字输入框（非日期/下拉/勾选） | 2 |
| 点击后弹出「选项列表」的面板 | 3 |
| 点击后弹出「树形层级」的面板 | 4 |
| 圆点单选组，选中一个其余取消 | 5 |
| 方框可勾选/取消，可多项 | 6 |
| 点击弹出日历，选**一个**日期 | 7 |
| 一处控件同时表达**开始与结束**（日期/数值/滑块） | 8 |
