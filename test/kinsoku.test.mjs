import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createMockContext, useFont } from './helpers.mjs';

const require = createRequire(import.meta.url);
const Kinsoku = require('../core/KinsokuEngine.js');

/* ------------------------------------------------------------ 标点归一化 */

test('normalizePunctuation：中文语境下半角转全角', () => {
  assert.equal(
    Kinsoku.normalizePunctuation('这是一句话, 然后继续: 结束!'),
    '这是一句话，然后继续：结束！'
  );
});

test('normalizePunctuation：不破坏 URL', () => {
  const input = '访问 https://example.com/x?id=1&y=2 查看详情';
  assert.equal(Kinsoku.normalizePunctuation(input), input);
});

test('normalizePunctuation：URL 后紧跟的中文句读仍会全角化', () => {
  assert.equal(
    Kinsoku.normalizePunctuation('见 https://a.com/x?id=1, 售价九元'),
    '见 https://a.com/x?id=1，售价九元'
  );
});

test('normalizePunctuation：不破坏邮箱', () => {
  const input = '联系 hello@example.com 即可';
  assert.equal(Kinsoku.normalizePunctuation(input), input);
});

test('normalizePunctuation：不破坏千分位与时间', () => {
  assert.equal(
    Kinsoku.normalizePunctuation('售价 1,000 元，时间 3:30 开始'),
    '售价 1,000 元，时间 3:30 开始'
  );
  assert.equal(Kinsoku.normalizePunctuation('画幅 16:9 的比例'), '画幅 16:9 的比例');
});

test('normalizePunctuation：不破坏纯英文句子', () => {
  const input = 'hello, world! is it ok?';
  assert.equal(Kinsoku.normalizePunctuation(input), input);
});

test('normalizePunctuation：回归——原实现会毁掉这一整行', () => {
  // 这是修复前的实测输出：https：//a.com/x？id=1，售价 1，000 元，时间 3：30
  const input = '访问 https://a.com/x?id=1, 售价 1,000 元, 时间 3:30';
  const output = Kinsoku.normalizePunctuation(input);
  assert.ok(output.includes('https://a.com/x?id=1'), 'URL 必须原样保留');
  assert.ok(output.includes('1,000'), '千分位必须原样保留');
  assert.ok(output.includes('3:30'), '时间必须原样保留');
});

test('normalizePunctuation：空值安全', () => {
  assert.equal(Kinsoku.normalizePunctuation(''), '');
  assert.equal(Kinsoku.normalizePunctuation(null), '');
  assert.equal(Kinsoku.normalizePunctuation(undefined), '');
});

/* ---------------------------------------------------------------- 分词 */

test('tokenize：英文单词不被拆散', () => {
  assert.deepEqual(
    Kinsoku.tokenize('用 Canvas 排版'),
    ['用', ' ', 'Canvas', ' ', '排', '版']
  );
});

test('tokenize：URL 作为一个整体', () => {
  const tokens = Kinsoku.tokenize('见 https://example.com/a-b 完');
  assert.ok(tokens.includes('https://example.com/a-b'));
});

/* ---------------------------------------------------------------- 折行 */

test('wrapLines：每行都不超过最大宽度', () => {
  const ctx = createMockContext();
  const size = useFont(ctx, 32);
  const maxWidth = size * 10;
  const text = '让生成式人工智能负责纯净无字的质感摄影，让前端画布负责严格像素级的中日韩避头尾排印，实现零成本的海报交付。';

  const lines = Kinsoku.wrapLines(ctx, text, maxWidth);
  assert.ok(lines.length > 1);

  for (const line of lines) {
    // 悬挂标点允许溢出，但最多不超过两个全角字宽
    assert.ok(
      ctx.measureText(line).width <= maxWidth + size * 2,
      `行超宽：${line}`
    );
  }
});

test('wrapLines：行首禁则标点永远不会出现在行首', () => {
  const ctx = createMockContext();
  useFont(ctx, 32);
  const text = '第一句话到这里，第二句话到这里。第三句话到这里；第四句话结束。';

  for (let width = 200; width <= 700; width += 20) {
    const lines = Kinsoku.wrapLines(ctx, text, width);
    lines.forEach((line, index) => {
      if (index === 0 || line === '') return;
      assert.ok(
        !Kinsoku.HEAD_FORBIDDEN.has(Array.from(line)[0]),
        `宽度 ${width} 下第 ${index + 1} 行以禁则标点开头：${line}`
      );
    });
  }
});

test('wrapLines：行尾禁则标点永远不会出现在行尾', () => {
  const ctx = createMockContext();
  useFont(ctx, 32);
  const text = '他说（这是一个需要换行测试的括号内容）然后离开了现场继续工作。';

  for (let width = 200; width <= 700; width += 20) {
    const lines = Kinsoku.wrapLines(ctx, text, width);
    lines.forEach((line, index) => {
      if (index === lines.length - 1 || line === '') return;
      const chars = Array.from(line);
      assert.ok(
        !Kinsoku.TAIL_FORBIDDEN.has(chars[chars.length - 1]),
        `宽度 ${width} 下第 ${index + 1} 行以禁则标点结尾：${line}`
      );
    });
  }
});

test('wrapLines：不产生意外的空行', () => {
  const ctx = createMockContext();
  useFont(ctx, 32);
  const text = '一二三四五六七八九十一二三四五六七八九十一二三四五（注）';

  for (let width = 120; width <= 400; width += 20) {
    const lines = Kinsoku.wrapLines(ctx, text, width);
    lines.forEach((line, index) => {
      assert.notEqual(line, '', `宽度 ${width} 下第 ${index + 1} 行为空`);
    });
  }
});

test('wrapLines：英文单词不会被从中间断开', () => {
  const ctx = createMockContext();
  const size = useFont(ctx, 32);
  const text = '使用 Canvas 与 JavaScript 完成 Compositor 合成流程';
  const lines = Kinsoku.wrapLines(ctx, text, size * 8);

  const joined = lines.join('\n');
  ['Canvas', 'JavaScript', 'Compositor'].forEach((word) => {
    assert.ok(
      lines.some((line) => line.includes(word)),
      `单词 ${word} 被拆散了：\n${joined}`
    );
  });
});

test('wrapLines：超长单词无法整体放下时才逐字符断开', () => {
  const ctx = createMockContext();
  const size = useFont(ctx, 32);
  const lines = Kinsoku.wrapLines(ctx, 'Supercalifragilisticexpialidocious', size * 4);
  assert.ok(lines.length > 1);
  assert.equal(lines.join(''), 'Supercalifragilisticexpialidocious');
});

test('wrapLines：保留段落换行', () => {
  const ctx = createMockContext();
  useFont(ctx, 32);
  const lines = Kinsoku.wrapLines(ctx, '第一段\n\n第三段', 1000);
  assert.deepEqual(lines, ['第一段', '', '第三段']);
});

test('wrapLines：maxLines 截断并追加省略号', () => {
  const ctx = createMockContext();
  const size = useFont(ctx, 32);
  const maxWidth = size * 8;
  const text = '这是一段被刻意写得很长的正文内容用来验证截断行为是否稳定可靠而且不会溢出边界。';

  const lines = Kinsoku.wrapLines(ctx, text, maxWidth, { maxLines: 3 });
  assert.equal(lines.length, 3);
  assert.ok(lines[2].endsWith('…'));
  assert.ok(ctx.measureText(lines[2]).width <= maxWidth);
});

test('wrapLines：内容够短时 maxLines 不产生省略号', () => {
  const ctx = createMockContext();
  const size = useFont(ctx, 32);
  const lines = Kinsoku.wrapLines(ctx, '很短的一行', size * 10, { maxLines: 3 });
  assert.equal(lines.length, 1);
  assert.ok(!lines[0].endsWith('…'));
});

test('wrapLines：normalize:false 时不改写标点', () => {
  const ctx = createMockContext();
  useFont(ctx, 32);
  const lines = Kinsoku.wrapLines(ctx, '标点保持原样, 不变', 10000, { normalize: false });
  assert.equal(lines[0], '标点保持原样, 不变');
});

test('wrapLines：空输入返回空数组', () => {
  const ctx = createMockContext();
  assert.deepEqual(Kinsoku.wrapLines(ctx, '', 100), []);
  assert.deepEqual(Kinsoku.wrapLines(ctx, null, 100), []);
});

/* -------------------------------------------------------------- 横排渲染 */

test('renderHorizontalText：返回准确的基线信息', () => {
  const ctx = createMockContext();
  const metrics = Kinsoku.renderHorizontalText(ctx, ['一', '二', '三'], 100, 500, 60, 'left');

  assert.equal(metrics.lines, 3);
  assert.equal(metrics.firstBaselineY, 500);
  assert.equal(metrics.lastBaselineY, 620);
  assert.equal(metrics.height, 120);
  assert.equal(ctx.calls.fillText.length, 3);
  assert.deepEqual(ctx.calls.fillText[2], { text: '三', x: 100, y: 620 });
});

test('renderHorizontalText：空行不调用 fillText 但仍占位', () => {
  const ctx = createMockContext();
  const metrics = Kinsoku.renderHorizontalText(ctx, ['一', '', '三'], 0, 0, 50, 'left');
  assert.equal(ctx.calls.fillText.length, 2);
  assert.equal(metrics.lastBaselineY, 100);
});

/* -------------------------------------------------------------- 竖排排版 */

test('layoutVerticalText：绝不越过安全区下边界', () => {
  const startY = 280;
  const maxBottomY = 1200;

  for (let length = 1; length <= 400; length += 7) {
    const layout = Kinsoku.layoutVerticalText('字'.repeat(length), {
      startY,
      maxBottomY,
      charSize: 34,
      charSpacing: 14
    });
    assert.ok(
      layout.bottomY <= maxBottomY,
      `${length} 字时 bottomY=${layout.bottomY} 越过了 ${maxBottomY}`
    );
  }
});

test('layoutVerticalText：回归——41 字曾经越界到 1288', () => {
  const layout = Kinsoku.layoutVerticalText(
    '这是一段很长的结尾寄语用于测试竖排是否会超出安全底部边界完全不做截断处理',
    { startY: 280, maxBottomY: 1200, charSize: 34, charSpacing: 14 }
  );
  assert.ok(layout.bottomY <= 1200);
});

test('layoutVerticalText：容纳不下时截断并标记', () => {
  const layout = Kinsoku.layoutVerticalText('字'.repeat(500), {
    startY: 0,
    maxBottomY: 300,
    charSize: 30,
    charSpacing: 10,
    maxColumns: 2
  });

  assert.equal(layout.truncated, true);
  const flat = layout.columns.flat();
  assert.equal(flat[flat.length - 1], '…');
  assert.ok(flat.length <= 2 * layout.perColumn);
});

test('layoutVerticalText：短句不再被强行拆成两列', () => {
  // 旧实现里 chars.length >= 6 就无条件双列，"早安保持思考与创造" 会被劈开
  const layout = Kinsoku.layoutVerticalText('早安保持思考与创造', {
    startY: 0,
    maxBottomY: 2000,
    charSize: 34,
    charSpacing: 14
  });
  assert.equal(layout.columns.length, 1);
});

test('layoutVerticalText：单列放不下时才增列', () => {
  const layout = Kinsoku.layoutVerticalText('字'.repeat(30), {
    startY: 0,
    maxBottomY: 480,
    charSize: 30,
    charSpacing: 10
  });
  assert.ok(layout.columns.length >= 2);
  assert.ok(layout.bottomY <= 480);
});

test('layoutVerticalText：columns 可显式指定', () => {
  const layout = Kinsoku.layoutVerticalText('字'.repeat(20), {
    startY: 0,
    maxBottomY: 2000,
    charSize: 30,
    charSpacing: 10,
    columns: 2
  });
  assert.equal(layout.columns.length, 2);
});

test('layoutVerticalText：剥离结尾标点', () => {
  const layout = Kinsoku.layoutVerticalText('早安，保持思考与创造。', {
    startY: 0, maxBottomY: 2000, charSize: 30, charSpacing: 10
  });
  const flat = layout.columns.flat().join('');
  assert.ok(!flat.endsWith('。'));
});

test('layoutVerticalText：空文本返回空布局', () => {
  const layout = Kinsoku.layoutVerticalText('', {
    startY: 100, maxBottomY: 500, charSize: 30
  });
  assert.deepEqual(layout.columns, []);
  assert.equal(layout.bottomY, 100);
});

test('renderVerticalText：自右向左布列，绘制点全部在安全区内', () => {
  const ctx = createMockContext();
  const layout = Kinsoku.renderVerticalText(
    ctx, '字'.repeat(40), 1050, 280, 1200, 34, 14, 45
  );

  assert.ok(ctx.calls.fillText.length > 0);
  for (const call of ctx.calls.fillText) {
    assert.ok(call.y + 34 <= 1200 + 0.001, `绘制点 y=${call.y} 越界`);
    assert.ok(call.x <= 1050, '列应当自右向左排布');
  }
  assert.ok(layout.columns.length >= 1);
});

/* -------------------------------------------------------------- 行数换算 */

test('maxLinesForHeight：按可用高度换算最大行数', () => {
  assert.equal(Kinsoku.maxLinesForHeight(0, 60), 1);
  assert.equal(Kinsoku.maxLinesForHeight(60, 60), 2);
  assert.equal(Kinsoku.maxLinesForHeight(320, 60), 6);
  assert.equal(Kinsoku.maxLinesForHeight(100, 0), 0);
});
