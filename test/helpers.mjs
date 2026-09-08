/**
 * 测试辅助：一个不依赖浏览器的 Canvas 2D 上下文替身。
 *
 * KinsokuEngine 只要求 measureText()，DesignImporter 额外需要绘图 API，
 * 这里把所有调用记录下来，便于断言“到底画在了哪里”。
 */

/** 用等宽近似度量：CJK 与全角标点算 1 个字宽，ASCII 算 0.5 个字宽。 */
export function approximateWidth(str, fontSize) {
  let units = 0;
  for (const ch of String(str)) {
    const code = ch.codePointAt(0);
    const isWide =
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe4f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x3000 && code <= 0x303f);
    units += isWide ? 1 : 0.5;
  }
  return units * fontSize;
}

export function createMockContext(fontSize = 32) {
  const calls = {
    fillText: [],
    fillRect: [],
    strokeRect: [],
    moveTo: [],
    lineTo: [],
    gradients: []
  };

  const ctx = {
    _fontSize: fontSize,
    font: `${fontSize}px sans-serif`,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    calls,

    measureText(str) {
      // 从 ctx.font 中解析字号，模拟真实 Canvas 随 font 变化的度量行为
      const match = /(\d+(?:\.\d+)?)px/.exec(this.font);
      const size = match ? parseFloat(match[1]) : this._fontSize;
      return { width: approximateWidth(str, size) };
    },

    save() {},
    restore() {},
    clearRect() {},
    fillText(text, x, y) { calls.fillText.push({ text, x, y }); },
    fillRect(x, y, w, h) { calls.fillRect.push({ x, y, w, h }); },
    strokeRect(x, y, w, h) { calls.strokeRect.push({ x, y, w, h }); },
    beginPath() {},
    moveTo(x, y) { calls.moveTo.push({ x, y }); },
    lineTo(x, y) { calls.lineTo.push({ x, y }); },
    stroke() {},
    drawImage() {},
    createLinearGradient(x0, y0, x1, y1) {
      const stops = [];
      calls.gradients.push({ x0, y0, x1, y1, stops });
      return { addColorStop: (offset, color) => stops.push({ offset, color }) };
    }
  };

  return ctx;
}

/** 把 ctx.font 设成指定字号，返回该字号（方便链式使用）。 */
export function useFont(ctx, size, family = 'sans-serif') {
  ctx.font = `${size}px ${family}`;
  return size;
}
