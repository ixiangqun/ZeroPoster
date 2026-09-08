import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createMockContext } from './helpers.mjs';

/*
 * CanvasCompositor 需要 window / document 才能构造，这里搭一个最小替身，
 * 以便对几何与缩放锚点这类纯数学逻辑做断言。
 */
const listeners = [];
globalThis.window = {
  addEventListener: (type, fn) => listeners.push({ target: 'window', type, fn }),
  removeEventListener: () => {}
};
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.AbortController = globalThis.AbortController || class {
  constructor() { this.signal = {}; }
  abort() {}
};

const require = createRequire(import.meta.url);
const CanvasCompositor = require('../core/CanvasCompositor.js');

function createCompositor(options = {}) {
  const ctx = createMockContext();
  const canvas = { width: 0, height: 0, getContext: () => ctx, toBlob: null };
  const wrapper = {
    addEventListener: (type, fn) => listeners.push({ target: 'wrapper', type, fn }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 450, height: 800 })
  };
  return new CanvasCompositor(canvas, wrapper, options);
}

test('构造时锁定物理分辨率', () => {
  const compositor = createCompositor();
  assert.equal(compositor.canvas.width, 1152);
  assert.equal(compositor.canvas.height, 2048);
});

test('setTransform 把缩放钳制在合法区间', () => {
  const compositor = createCompositor();

  compositor.setTransform(null, null, 5000);
  assert.equal(compositor.state.zoom, CanvasCompositor.MAX_ZOOM);

  compositor.setTransform(null, null, -100);
  assert.equal(compositor.state.zoom, CanvasCompositor.MIN_ZOOM);
});

test('setTransform 传 null 时保持该项不变', () => {
  const compositor = createCompositor();
  compositor.setTransform(50, 60, 120);
  compositor.setTransform(null, null, 130);

  assert.equal(compositor.state.offsetX, 50);
  assert.equal(compositor.state.offsetY, 60);
  assert.equal(compositor.state.zoom, 130);
});

test('setTransform 忽略 NaN，避免把画布推到不可恢复的位置', () => {
  const compositor = createCompositor();
  compositor.setTransform(40, 40, 100);
  compositor.setTransform(NaN, NaN, NaN);

  assert.equal(compositor.state.offsetX, 40);
  assert.equal(compositor.state.offsetY, 40);
  assert.equal(compositor.state.zoom, 100);
});

test('底图按 cover 模式铺满且居中：方图撑满高度、左右溢出', () => {
  const compositor = createCompositor();
  compositor.state.image = { width: 1000, height: 1000 };

  const geo = compositor._imageGeometry();
  assert.equal(geo.height, 2048, '应撑满画布高度');
  assert.equal(geo.width, 2048);
  assert.equal(geo.x, (1152 - 2048) / 2, '水平方向居中溢出');
  assert.equal(geo.y, 0);
});

test('底图按 cover 模式铺满且居中：细长图撑满宽度、上下溢出', () => {
  const compositor = createCompositor();
  compositor.state.image = { width: 1152, height: 4096 };

  const geo = compositor._imageGeometry();
  assert.equal(geo.width, 1152, '应撑满画布宽度');
  assert.equal(geo.height, 4096);
  assert.equal(geo.x, 0);
  assert.equal(geo.y, (2048 - 4096) / 2, '垂直方向居中溢出');
});

test('cover 模式下画布任一方向都不会露出背景', () => {
  const compositor = createCompositor();
  const shapes = [[1000, 1000], [4000, 1000], [500, 4000], [1152, 2048]];

  for (const [width, height] of shapes) {
    compositor.state.image = { width, height };
    compositor.setTransform(0, 0, 100);
    const geo = compositor._imageGeometry();

    assert.ok(geo.width >= 1152 - 0.001, `${width}x${height} 宽度未铺满`);
    assert.ok(geo.height >= 2048 - 0.001, `${width}x${height} 高度未铺满`);
  }
});

test('zoomAt 保持锚点位置不动', () => {
  const compositor = createCompositor();
  compositor.state.image = { width: 1152, height: 2048 };

  const anchorX = 300;
  const anchorY = 700;

  const before = compositor._imageGeometry();
  const ratioX = (anchorX - before.x) / before.width;
  const ratioY = (anchorY - before.y) / before.height;

  compositor.zoomAt(180, anchorX, anchorY);

  const after = compositor._imageGeometry();
  const pointX = after.x + ratioX * after.width;
  const pointY = after.y + ratioY * after.height;

  // offset 会取整，允许 1px 误差
  assert.ok(Math.abs(pointX - anchorX) <= 1, `锚点 x 漂移 ${pointX - anchorX}`);
  assert.ok(Math.abs(pointY - anchorY) <= 1, `锚点 y 漂移 ${pointY - anchorY}`);
});

test('zoomAt 无底图时只改缩放值', () => {
  const compositor = createCompositor();
  compositor.zoomAt(150, 0, 0);
  assert.equal(compositor.state.zoom, 150);
  assert.equal(compositor.state.offsetX, 0);
});

test('loadImageFromFile 拒绝非图片文件并给出可读错误', async () => {
  const compositor = createCompositor();
  await assert.rejects(
    () => compositor.loadImageFromFile({ type: 'application/pdf' }),
    /请选择图片文件/
  );
  await assert.rejects(() => compositor.loadImageFromFile(null), /请选择图片文件/);
});

test('export 在 toBlob 返回 null 时 reject，而不是永远挂起', async () => {
  const compositor = createCompositor();
  compositor.canvas.toBlob = (cb) => cb(null);

  await assert.rejects(() => compositor.export('x.jpg'), /画布导出失败/);
});

test('export 把 toBlob 抛出的 SecurityError 透传出来', async () => {
  const compositor = createCompositor();
  compositor.canvas.toBlob = () => { throw new Error('SecurityError'); };

  await assert.rejects(() => compositor.export('x.jpg'), /SecurityError/);
});

test('页面不可见时 requestRender 退回 setTimeout，不会静默丢帧', async () => {
  // 后台标签页里 rAF 不触发；若不做降级，隐藏期间的所有更新都会丢失
  globalThis.document = { hidden: true };
  globalThis.requestAnimationFrame = () => {
    throw new Error('页面隐藏时不应使用 requestAnimationFrame');
  };

  try {
    const compositor = createCompositor();
    let rendered = 0;
    compositor.setRenderPipeline(() => { rendered++; });

    compositor.requestRender();
    await new Promise((resolve) => setTimeout(resolve, 60));

    assert.equal(rendered, 1, '隐藏状态下仍应完成一次重绘');
  } finally {
    delete globalThis.document;
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  }
});

test('requestRender 合并同一帧内的多次请求', async () => {
  const compositor = createCompositor();
  let rendered = 0;
  compositor.setRenderPipeline(() => { rendered++; });

  compositor.requestRender();
  compositor.requestRender();
  compositor.requestRender();
  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.equal(rendered, 1, '三次请求应合并为一次重绘');
});

test('export 前会取消挂起的重绘并同步渲染最新状态', async () => {
  // 导出会走 <a download> 触发下载，这里给出最小的 document 替身
  const anchor = { click() {}, style: {} };
  globalThis.document = {
    hidden: false,
    createElement: () => anchor,
    body: { appendChild() {}, removeChild() {} }
  };

  try {
    const compositor = createCompositor();
    let rendered = 0;
    compositor.setRenderPipeline(() => { rendered++; });
    compositor.canvas.toBlob = (cb) => cb(new Blob(['x']));

    compositor.requestRender();
    await compositor.export('x.jpg');

    const afterExport = rendered;
    await new Promise((resolve) => setTimeout(resolve, 60));

    assert.ok(afterExport >= 1, '导出前必须同步渲染一次');
    assert.equal(rendered, afterExport, '挂起的重绘应已被取消，不该再触发');
  } finally {
    delete globalThis.document;
  }
});

test('destroy 不抛错且可重复调用', () => {
  const compositor = createCompositor();
  assert.doesNotThrow(() => compositor.destroy());
  assert.doesNotThrow(() => compositor.destroy());
});

test('渲染管线回调会被调用并拿到画布尺寸', () => {
  const compositor = createCompositor();
  let received = null;
  compositor.setRenderPipeline((ctx, width, height) => {
    received = { width, height };
  });
  compositor.render();
  assert.deepEqual(received, { width: 1152, height: 2048 });
});
