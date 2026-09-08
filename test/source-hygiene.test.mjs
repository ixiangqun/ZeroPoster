import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SOURCE_DIRS = ['.', 'core', 'templates', 'schemas', 'test', 'tools'];
const SOURCE_EXT = new Set(['.js', '.mjs', '.json', '.html', '.svg', '.md']);

function collectSources() {
  const files = [];
  for (const dir of SOURCE_DIRS) {
    const full = join(ROOT, dir);
    for (const entry of readdirSync(full, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (!SOURCE_EXT.has(extname(entry.name))) continue;
      files.push({ path: join(full, entry.name), label: join(dir, entry.name) });
    }
  }
  return files;
}

test('源码中不含裸控制字符', () => {
  // 一个裸 NUL 曾经把导出文件名的正则毁成 /[...|\0-\x1f]/，
  // 浏览器直接抛 SyntaxError，整个页面白屏。控制字符必须写成转义。
  for (const file of collectSources()) {
    const source = readFileSync(file.path, 'utf8');
    const offenders = [];

    for (let i = 0; i < source.length; i++) {
      const code = source.charCodeAt(i);
      const isAllowed = code === 0x0a || code === 0x09 || code === 0x0d;
      if (code < 0x20 && !isAllowed) {
        offenders.push({ index: i, code: '0x' + code.toString(16) });
      }
      if (code === 0x7f) offenders.push({ index: i, code: '0x7f' });
    }

    assert.equal(
      offenders.length, 0,
      `${file.label} 含裸控制字符：${JSON.stringify(offenders.slice(0, 5))}`
    );
  }
});

test('源码中不含未闭合的 BOM 或零宽字符', () => {
  // 用转义写法，否则这个测试文件自己就会命中自己的断言
  const invisible = /[\u200b\u200c\u200d\ufeff]/;
  for (const file of collectSources()) {
    const source = readFileSync(file.path, 'utf8');
    assert.ok(!invisible.test(source), `${file.label} 含零宽字符或 BOM`);
  }
});

test('index.html 中的正则表达式全部可编译', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const scriptBody = html.slice(html.indexOf('<script>'), html.lastIndexOf('</script>'));

  // 粗略抓取字面量正则；目的是拦住语法错误，不求穷尽
  const literals = scriptBody.match(/\/\[[^\n]*?\]\/[gimsuy]*/g) || [];
  assert.ok(literals.length > 0, '未抓到任何正则字面量，检查匹配逻辑');

  for (const literal of literals) {
    const lastSlash = literal.lastIndexOf('/');
    const body = literal.slice(1, lastSlash);
    const flags = literal.slice(lastSlash + 1);
    assert.doesNotThrow(
      () => new RegExp(body, flags),
      `index.html 中的正则无法编译：${literal}`
    );
  }
});

test('所有 JSON 文件都能被解析', () => {
  for (const file of collectSources()) {
    if (extname(file.path) !== '.json') continue;
    assert.doesNotThrow(
      () => JSON.parse(readFileSync(file.path, 'utf8')),
      `${file.label} 不是合法 JSON`
    );
  }
});

test('核心模块在 Node 中可直接 require（保证可被单测覆盖）', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);

  for (const name of ['KinsokuEngine', 'CanvasCompositor', 'DesignImporter', 'PromptBridge', 'Presets']) {
    if (name === 'CanvasCompositor') continue; // 需要 window，见 compositor.test.mjs
    assert.doesNotThrow(() => require(`../core/${name}.js`), `${name} 无法在 Node 中加载`);
  }
});
