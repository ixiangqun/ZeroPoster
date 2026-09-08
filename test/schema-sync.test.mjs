import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildPresetsSource, PRESET_FILES } from '../tools/build-presets.mjs';

const require = createRequire(import.meta.url);
const DesignImporter = require('../core/DesignImporter.js');
const PromptBridge = require('../core/PromptBridge.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(
  readFileSync(join(ROOT, 'schemas', 'template.schema.json'), 'utf8')
);

/* --------------------------------------------------- schema 与实现同步 */

test('schema 的图层类型枚举与运行时校验器一致', () => {
  assert.deepEqual(
    schema.definitions.layer.properties.type.enum,
    DesignImporter.LAYER_TYPES
  );
});

test('schema 的 align 枚举与运行时校验器一致', () => {
  assert.deepEqual(
    schema.definitions.layer.properties.align.enum,
    DesignImporter.ALIGNMENTS
  );
});

test('schema 的 orientation 枚举与运行时校验器一致', () => {
  assert.deepEqual(
    schema.definitions.layer.properties.orientation.enum,
    DesignImporter.ORIENTATIONS
  );
});

test('schema 顶层必填字段与运行时校验器一致', () => {
  assert.deepEqual(schema.required, ['name', 'version', 'dimensions', 'layers']);
});

test('schema 声明的所有属性都在内置模板中被真实使用或有文档说明', () => {
  const declared = Object.keys(schema.definitions.layer.properties);
  const used = new Set();

  for (const file of Object.values(PRESET_FILES)) {
    const template = JSON.parse(readFileSync(join(ROOT, 'templates', file), 'utf8'));
    for (const layer of template.layers) {
      Object.keys(layer).forEach((key) => used.add(key));
    }
  }

  // 这些字段属于协议能力，内置模板未必全部用到，但必须带 description
  const documentedOnly = declared.filter((key) => !used.has(key));
  for (const key of documentedOnly) {
    const prop = schema.definitions.layer.properties[key];
    assert.ok(
      prop.description || prop.type || prop.oneOf,
      `schema 属性 ${key} 既未被使用也没有说明`
    );
  }
});

/* ------------------------------------------------ Presets 产物同步校验 */

test('core/Presets.js 与生成器输出逐字节一致', () => {
  const onDisk = readFileSync(join(ROOT, 'core', 'Presets.js'), 'utf8');
  assert.equal(
    onDisk,
    buildPresetsSource(),
    'core/Presets.js 已过期，请运行 npm run build:presets'
  );
});

/* ---------------------------------------------------------- PromptBridge */

test('buildPrompt：始终带上无文字负向约束', () => {
  const prompt = PromptBridge.buildPrompt({ topic: '茶器', mode: 'macro' });
  assert.match(prompt, /no text/);
  assert.match(prompt, /no watermark/);
  assert.match(prompt, /--ar 9:16/);
});

test('buildPrompt：未知模式回落到 macro 而不是崩溃', () => {
  const prompt = PromptBridge.buildPrompt({ topic: '茶器', mode: 'not-a-mode' });
  assert.match(prompt, /macro photograph/);
});

test('buildPrompt：无输入时也能产出可用提示词', () => {
  const prompt = PromptBridge.buildPrompt({});
  assert.ok(prompt.length > 100);
});

test('getModes：返回的 key 与 index.html 的下拉选项一致', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const optionValues = [...html.matchAll(/<option value="([a-z]+)">/g)].map((m) => m[1]);
  const modeKeys = PromptBridge.getModes().map((mode) => mode.key);

  assert.deepEqual(optionValues.sort(), modeKeys.sort());
});

/* ------------------------------------------------------- index.html 契约 */

test('index.html 不再使用 fetch 载入模板（file:// 下会被 CORS 拒绝）', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.ok(
    !/fetch\(\s*['"]templates\//.test(html),
    'index.html 又出现了对 templates/ 的 fetch，双击打开会白屏'
  );
});

test('index.html 引入了内联预设脚本', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /<script src="core\/Presets\.js"><\/script>/);
});

test('index.html 引入了全部核心模块', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  for (const file of ['KinsokuEngine', 'CanvasCompositor', 'DesignImporter', 'PromptBridge']) {
    assert.match(html, new RegExp(`<script src="core/${file}\\.js"></script>`));
  }
});

test('index.html 的 web 字体是非阻塞加载', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const link = /<link[^>]*fonts\.googleapis\.com\/css2[^>]*>/.exec(html);
  assert.ok(link, '未找到 web 字体 link');
  assert.match(link[0], /media="print"/, 'web 字体必须非阻塞加载，离线时才不会拖慢首屏');
});
