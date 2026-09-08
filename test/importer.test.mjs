import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createMockContext } from './helpers.mjs';

const require = createRequire(import.meta.url);
const Kinsoku = require('../core/KinsokuEngine.js');
const DesignImporter = require('../core/DesignImporter.js');
const Presets = require('../core/Presets.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const importer = new DesignImporter();

function readTemplate(file) {
  return JSON.parse(readFileSync(join(ROOT, 'templates', file), 'utf8'));
}

/** 长短不一的文案，用来压测布局。 */
const SAMPLE_DATA = {
  short: {
    number: 'NO.01',
    topic: '短标题',
    content: '很短的一句话。',
    subtext: '简短背书',
    greeting: '早安。',
    signature: 'ZeroPoster'
  },
  normal: {
    number: 'ZEROPOSTER / ISSUE NO.01',
    topic: '分层混合渲染',
    content: '让生成式 AI 负责纯净无字的质感摄影，让前端 Canvas 负责严格像素级的 CJK 避头尾排印，实现零成本、高保真的海报交付。',
    subtext: '纯客户端本地运行 · 零服务器与 API 消耗 · 毫秒级即时导出',
    greeting: '早安，保持思考与创造。',
    signature: 'ZeroPoster · Client Compositor'
  },
  long: {
    number: 'ZEROPOSTER / ISSUE NO.999 / EXTENDED EDITION LONG',
    topic: '一个被刻意写得非常非常长的核心主题用来测试标题溢出',
    content: '让生成式人工智能负责纯净无字的质感摄影，让前端画布负责严格像素级的中日韩避头尾排印，实现零成本与高保真的海报交付。'.repeat(4),
    subtext: '纯客户端本地运行，零服务器与接口消耗，毫秒级即时导出，并且这句副标题也被刻意加长了很多很多。'.repeat(2),
    greeting: '早安，保持思考与创造，愿你今天也有好运气伴随左右。',
    signature: 'ZeroPoster · Client Compositor · Extended Signature'
  }
};

const PRESET_FILES = {
  minimal: 'minimal-editorial.json',
  classic: 'classic-cjk.json',
  dark: 'dark-mode-card.json'
};

/* ------------------------------------------------------------ 模板校验 */

test('validateTemplate：内置模板全部合法', () => {
  for (const [key, file] of Object.entries(PRESET_FILES)) {
    assert.equal(importer.validateTemplate(readTemplate(file)), true, `${key} 校验失败`);
  }
});

test('validateTemplate：缺少必填字段时报错并指明字段名', () => {
  assert.throws(
    () => importer.validateTemplate({ version: '1.0.0', dimensions: {}, layers: [] }),
    /name/
  );
});

test('validateTemplate：错误信息能定位到具体图层', () => {
  assert.throws(
    () => importer.validateTemplate({
      name: 'x', version: '1', dimensions: { width: 10, height: 10 },
      layers: [{ id: 'ok', type: 'rect', x: 0, y: 0, width: 1, height: 1 },
               { id: 'bad', type: 'nope' }]
    }),
    /layers\[1\] #bad/
  );
});

test('validateTemplate：gradient 缺少 stops 会被拦截', () => {
  // 修复前这类模板会在渲染时抛 TypeError，整条管线崩溃
  assert.throws(
    () => importer.validateTemplate({
      name: 'x', version: '1', dimensions: { width: 10, height: 10 },
      layers: [{ id: 'g', type: 'gradient' }]
    }),
    /stops/
  );
});

test('validateTemplate：dimensions 必须为正数', () => {
  assert.throws(
    () => importer.validateTemplate({
      name: 'x', version: '1', dimensions: { width: 0, height: 10 }, layers: []
    }),
    /width/
  );
});

test('loadTemplateJSON：区分 JSON 语法错误与结构错误', async () => {
  await assert.rejects(
    () => importer.loadTemplateJSON('{ not json'),
    /JSON 语法错误/
  );
  await assert.rejects(
    () => importer.loadTemplateJSON('{"name":"x"}'),
    /缺少必填字段/
  );
});

/* -------------------------------------------------------- 流式布局核心 */

test('renderTemplateLayers：流式图层跟随上一图层底部', () => {
  const ctx = createMockContext();
  const template = {
    name: 't', version: '1', dimensions: { width: 1000, height: 2000 },
    layers: [
      { id: 'a', type: 'text', content: '一二三', x: 0, y: 100,
        fontSize: 30, lineHeight: 50, maxWidth: 1000 },
      { id: 'b', type: 'text', content: '四五六', x: 0, y: 999,
        flow: true, flowGap: 70, fontSize: 30, lineHeight: 50, maxWidth: 1000 }
    ]
  };

  const boxes = importer.renderTemplateLayers(ctx, template, {}, Kinsoku);
  assert.equal(boxes[0].bottom, 100);
  // 流式图层忽略自身 y=999，改为 100 + 70
  assert.equal(boxes[1].y, 170);
});

test('renderTemplateLayers：文案变长时流式图层被整体推下去', () => {
  const ctx = createMockContext();
  const template = {
    name: 't', version: '1', dimensions: { width: 1000, height: 2000 },
    layers: [
      { id: 'body', type: 'text', binding: 'content', x: 0, y: 100,
        fontSize: 30, lineHeight: 50, maxWidth: 300 },
      { id: 'next', type: 'text', content: '下一层', x: 0,
        flow: true, flowGap: 60, fontSize: 30, lineHeight: 50, maxWidth: 1000 }
    ]
  };

  const shortBoxes = importer.renderTemplateLayers(ctx, template, { content: '短' }, Kinsoku);
  const longBoxes = importer.renderTemplateLayers(
    ctx, template, { content: '很长的正文'.repeat(10) }, Kinsoku);

  assert.ok(longBoxes[1].y > shortBoxes[1].y, '长文案应把后续图层推下去');
});

test('renderTemplateLayers：maxBottomY 是硬边界', () => {
  const ctx = createMockContext();
  const template = {
    name: 't', version: '1', dimensions: { width: 1000, height: 2000 },
    layers: [
      { id: 'body', type: 'text', binding: 'content', x: 0, y: 100,
        fontSize: 30, lineHeight: 50, maxWidth: 300, maxBottomY: 400 }
    ]
  };

  const boxes = importer.renderTemplateLayers(
    ctx, template, { content: '很长的正文内容'.repeat(30) }, Kinsoku);

  assert.ok(boxes[0].bottom <= 400, `实际底部 ${boxes[0].bottom} 越过了 400`);
  assert.equal(boxes[0].truncated, true);
});

test('renderTemplateLayers：空文案不绘制但仍推进游标', () => {
  const ctx = createMockContext();
  const template = {
    name: 't', version: '1', dimensions: { width: 1000, height: 2000 },
    layers: [
      { id: 'empty', type: 'text', binding: 'missing', x: 0, y: 200,
        fontSize: 30, lineHeight: 50 },
      { id: 'after', type: 'text', content: '之后', x: 0,
        flow: true, flowGap: 40, fontSize: 30, lineHeight: 50 }
    ]
  };

  const boxes = importer.renderTemplateLayers(ctx, template, {}, Kinsoku);
  assert.equal(boxes[0].empty, true);
  assert.equal(boxes[1].y, 240);
  assert.equal(ctx.calls.fillText.length, 1);
});

test('renderTemplateLayers：gradient 缺少 stops 时跳过而不是崩溃', () => {
  const ctx = createMockContext();
  const template = {
    name: 't', version: '1', dimensions: { width: 100, height: 100 },
    layers: [
      { id: 'g', type: 'gradient', direction: 'vertical' },
      { id: 'after', type: 'text', content: '仍然渲染', x: 0, y: 50, fontSize: 20 }
    ]
  };

  assert.doesNotThrow(() => importer.renderTemplateLayers(ctx, template, {}, Kinsoku));
  assert.equal(ctx.calls.fillText.length, 1);
});

/* ------------------------------------------- 内置模板的图层重叠回归测试 */

test('内置模板：任意长度文案都不会出现图层压盖', () => {
  for (const [key, file] of Object.entries(PRESET_FILES)) {
    const template = readTemplate(file);

    for (const [caseName, data] of Object.entries(SAMPLE_DATA)) {
      const ctx = createMockContext();

      // 文本、直线、矩形都要参与纵向顺序检查：
      // 分隔线被正文压过去，和文字互相压盖一样是排版事故。
      const boxes = importer
        .renderTemplateLayers(ctx, template, data, Kinsoku)
        .filter((box) => !box.empty);

      for (let i = 0; i < boxes.length - 1; i++) {
        const current = boxes[i];
        const next = boxes[i + 1];

        // 竖排图层与横排图层分处画面左右两侧，不参与纵向比较
        if (current.orientation === 'vertical' || next.orientation === 'vertical') continue;

        // 完全包含属于刻意的嵌套（例如徽标文字画在徽标底框里），不算压盖；
        // 真正的事故是「部分重叠」——两块内容各露一半糊在一起。
        const nested = next.y >= current.y && next.bottom <= current.bottom;
        if (nested) continue;

        assert.ok(
          next.y > current.bottom,
          `${key}/${caseName}：图层 ${next.id} (y=${next.y}) ` +
          `压在了 ${current.id} (bottom=${current.bottom}) 上`
        );
      }
    }
  }
});

test('内置模板：绝对定位的页脚区块永远不被上方流式内容侵入', () => {
  // 页脚（分隔线 + 寄语 + 落款）是固定锚点，流式正文再长也必须让开
  const template = readTemplate('minimal-editorial.json');
  const divider = template.layers.find((l) => l.id === 'divider_line');

  for (const [caseName, data] of Object.entries(SAMPLE_DATA)) {
    const boxes = importer.renderTemplateLayers(
      createMockContext(), template, data, Kinsoku);
    const sub = boxes.find((b) => b.id === 'sub_endorsement');

    assert.ok(
      sub.bottom < divider.y1,
      `${caseName}：副标题底部 ${sub.bottom} 越过了分隔线 ${divider.y1}`
    );
  }
});

test('内置模板：所有绘制都落在画布范围内', () => {
  for (const [key, file] of Object.entries(PRESET_FILES)) {
    const template = readTemplate(file);
    const { width, height } = template.dimensions;

    for (const [caseName, data] of Object.entries(SAMPLE_DATA)) {
      const ctx = createMockContext();
      importer.renderTemplateLayers(ctx, template, data, Kinsoku);

      for (const call of ctx.calls.fillText) {
        assert.ok(
          call.y > 0 && call.y <= height,
          `${key}/${caseName}：文本基线 y=${call.y} 超出画布高度 ${height}`
        );
        assert.ok(
          call.x >= 0 && call.x <= width,
          `${key}/${caseName}：文本 x=${call.x} 超出画布宽度 ${width}`
        );
      }
    }
  }
});

test('内置模板：回归——minimal 正文 4 行时曾压盖副标题', () => {
  const template = readTemplate('minimal-editorial.json');
  const ctx = createMockContext();
  const boxes = importer.renderTemplateLayers(ctx, template, SAMPLE_DATA.normal, Kinsoku);

  const body = boxes.find((box) => box.id === 'body_text');
  const sub = boxes.find((box) => box.id === 'sub_endorsement');

  assert.ok(body && sub);
  assert.ok(sub.y > body.bottom, `副标题 ${sub.y} 仍压在正文底部 ${body.bottom} 上`);
});

test('内置模板：classic 竖排寄语不越过安全区', () => {
  const template = readTemplate('classic-cjk.json');
  const layer = template.layers.find((l) => l.id === 'vertical_greeting');
  const ctx = createMockContext();

  const boxes = importer.renderTemplateLayers(ctx, template, SAMPLE_DATA.long, Kinsoku);
  const box = boxes.find((b) => b.id === 'vertical_greeting');

  assert.equal(box.orientation, 'vertical');
  assert.ok(box.bottom <= layer.maxBottomY);
});

/* -------------------------------------------------------- Presets 同步 */

test('core/Presets.js 与 templates/*.json 内容一致', () => {
  for (const [key, file] of Object.entries(PRESET_FILES)) {
    assert.deepEqual(Presets[key], readTemplate(file), `预设 ${key} 与源文件不一致`);
  }
});

test('core/Presets.js 暴露 index.html 需要的全部 key', () => {
  assert.deepEqual(Object.keys(Presets).sort(), ['classic', 'dark', 'minimal']);
});
