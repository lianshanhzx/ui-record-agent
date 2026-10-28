import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { inspectImages, loadVisionConfig } from './inspect-images.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==', 'base64');

async function fixture(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'qwen-vision-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const configPath = join(dir, 'opencode.json');
  const images = [join(dir, '图1.png'), join(dir, '图2.png')];
  await Promise.all(images.map(path => writeFile(path, png)));
  const config = { provider: { local: {
    options: { baseURL: 'http://127.0.0.1:1/v1/', apiKey: 'fixture-secret', ...options },
    models: { 'Qwen3.8-27B': { id: 'Qwen3.8-27B', modalities: { input: ['text', 'image'] } } },
  } } };
  await writeFile(configPath, JSON.stringify(config));
  return { dir, configPath, images, config, prompt: '按图1、图2识别提示。' };
}

test('HTTP 调用发送配置模型、认证和有序多图，并返回文字与用量', async t => {
  let received;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received = { path: req.url, authorization: req.headers.authorization, body: JSON.parse(Buffer.concat(chunks).toString()) };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: '图1和图2均为空白测试图。' }, finish_reason: 'stop' }], usage: { total_tokens: 42 } }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const input = await fixture(t, { baseURL: `http://127.0.0.1:${server.address().port}/v1/` });
  const result = await inspectImages(input);
  assert.equal(received.path, '/v1/chat/completions');
  assert.equal(received.authorization, 'Bearer fixture-secret');
  assert.equal(received.body.model, 'Qwen3.8-27B');
  assert.equal(received.body.stream, false);
  const content = received.body.messages[1].content;
  assert.deepEqual(content.filter(part => part.type === 'text').map(part => part.text), [input.prompt, '图 1', '图 2']);
  assert.equal(content.filter(part => part.type === 'image_url').length, 2);
  assert.equal(content[2].image_url.url, `data:image/png;base64,${png.toString('base64')}`);
  assert.equal(result.analysis, '图1和图2均为空白测试图。');
  assert.equal(result.usage.total_tokens, 42);
  assert.ok(!JSON.stringify(result).includes('fixture-secret'));
});

test('读取环境变量和相对密钥文件，不把凭据放入结果', async t => {
  const envName = `QWEN_VISION_FIXTURE_${process.pid}`;
  process.env[envName] = 'http://127.0.0.1:1/v1';
  t.after(() => { delete process.env[envName]; });
  const input = await fixture(t, { baseURL: `{env:${envName}}`, apiKey: '{file:key.txt}' });
  await writeFile(join(input.dir, 'key.txt'), 'file-secret\n');
  const config = await loadVisionConfig(input.configPath);
  assert.equal(config.headers.get('authorization'), 'Bearer file-secret');
  assert.equal(config.endpoint, 'http://127.0.0.1:1/v1/chat/completions');
});

test('缺失模型、重复模型和无图片输入均在请求前失败', async t => {
  const input = await fixture(t);
  let calls = 0;
  const dependencies = { fetchImpl: async () => { calls++; throw new Error('should not call'); } };
  const provider = input.config.provider.local;
  for (const [providers, message] of [
    [{ other: { options: provider.options, models: { 'GLM-5': {} } } }, /实际找到 0 个/],
    [{ a: provider, b: provider }, /实际找到 2 个/],
    [{ local: { ...provider, models: { 'Qwen3.8-27B': { modalities: { input: ['text'] } } } } }, /未声明/],
  ]) {
    await writeFile(input.configPath, JSON.stringify({ provider: providers }));
    await assert.rejects(inspectImages(input, dependencies), message);
  }
  assert.equal(calls, 0);
});

test('图片无效或缺失时，不发送请求', async t => {
  const input = await fixture(t);
  let calls = 0;
  const dependencies = { fetchImpl: async () => { calls++; } };
  await writeFile(input.images[0], 'not an image');
  await assert.rejects(inspectImages(input, dependencies), /不支持的图片格式/);
  await assert.rejects(inspectImages({ ...input, images: [join(input.dir, 'missing.png')] }, dependencies), /无法读取图片/);
  assert.equal(calls, 0);
});

test('HTTP 错误、空内容和网络错误均无模型回退或凭据回显', async t => {
  const input = await fixture(t);
  for (const response of [
    () => new Response('fixture-secret', { status: 401 }),
    () => Response.json({ choices: [{ message: { content: '' } }] }),
    () => { throw new Error('network failure with fixture-secret'); },
    () => Response.json({ choices: [{ message: { content: 'partial' }, finish_reason: 'length' }] }),
  ]) {
    let calls = 0;
    await assert.rejects(inspectImages(input, { fetchImpl: async () => { calls++; return response(); } }), error => {
      assert.match(error.message, /Qwen 图片查看失败/);
      assert.match(error.message, /未切换其他模型/);
      assert.ok(!error.message.includes('fixture-secret'));
      return true;
    });
    assert.equal(calls, 1);
  }
});

test('超时中断请求并明确报告', async t => {
  const input = await fixture(t);
  await assert.rejects(inspectImages({ ...input, timeoutMs: 10 }, {
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('test timeout')), 1000);
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
    }),
  }), /请求超时/);
});
