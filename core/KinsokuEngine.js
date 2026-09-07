/**
 * KinsokuEngine.js
 * 工业级 CJK（中日韩）排版与汉字避头尾算法引擎
 * 严格遵循国家标准 GB/T 15834《标点符号用法》
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KinsokuEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // 禁止出现在行首的收尾字符（行头禁则）
  const KINSOKU_HEAD = new Set([
    '，', '。', '！', '？', '、', '；', '：', '）', '》', '】', '』', '」', '〕', '”', '’',
    ',', '.', '!', '?', ';', ':', ')', ']', '}', '>', '·', '…', '—', '～', '℃', '％', '%'
  ]);

  // 禁止出现在行尾的开头字符（行尾禁则）
  const KINSOKU_TAIL = new Set([
    '（', '《', '【', '『', '「', '〔', '“', '‘',
    '(', '[', '{', '<', '￥', '$'
  ]);

  /**
   * 规范化标点符号（将半角混用标点转换为标准全角中文字符）
   */
  function normalizePunctuation(text) {
    if (!text) return '';
    return text
      .replace(/,\s*/g, '，')
      .replace(/:\s*/g, '：')
      .replace(/;\s*/g, '；')
      .replace(/!\s*/g, '！')
      .replace(/\?\s*/g, '？');
  }

  /**
   * 计算单行文本渲染与折行（严格标点悬挂与避头尾）
   * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
   * @param {string} text - 原始文本
   * @param {number} maxWidth - 最大排版宽度
   * @returns {string[]} 折行后的文本数组
   */
  function wrapLines(ctx, text, maxWidth) {
    if (!text) return [];
    const normalized = normalizePunctuation(text);
    const paragraphs = normalized.split('\n');
    const lines = [];

    for (let p of paragraphs) {
      let currentLine = '';
      const chars = Array.from(p);

      for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const testLine = currentLine + char;
        const testWidth = ctx.measureText(testLine).width;

        if (testWidth > maxWidth && currentLine.length > 0) {
          // 避头尾规则 1：如果即将断到下一行的首字符是行头禁则字符，则执行标点悬挂，强行挂在当前行末
          if (KINSOKU_HEAD.has(char)) {
            currentLine += char;
            lines.push(currentLine);
            currentLine = '';
            continue;
          }

          // 避头尾规则 2：如果当前行最后一个字符是行尾禁则字符，则将其推入下一行
          const lastChar = currentLine[currentLine.length - 1];
          if (KINSOKU_TAIL.has(lastChar)) {
            currentLine = currentLine.slice(0, -1);
            lines.push(currentLine);
            currentLine = lastChar + char;
            continue;
          }

          lines.push(currentLine);
          currentLine = char;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
    }

    return lines;
  }

  /**
   * 绘制水平排版文本块
   */
  function renderHorizontalText(ctx, lines, startX, startY, lineHeight, align = 'left') {
    ctx.save();
    ctx.textAlign = align;
    let y = startY;

    for (let line of lines) {
      ctx.fillText(line, startX, y);
      y += lineHeight;
    }

    ctx.restore();
    return y;
  }

  /**
   * 绘制金石竖排文本（带安全高度碰撞检测与多列自动折行）
   */
  function renderVerticalText(ctx, text, startX, startY, maxBottomY, charSize, charSpacing = 10, columnSpacing = 40) {
    if (!text) return;
    const clean = text.replace(/[，,。！？、；：\s]+$/, ''); // 剥离末尾标点
    const chars = Array.from(clean);
    
    // 计算单列最多能容纳的字数
    const availableHeight = maxBottomY - startY;
    const maxCharsPerColumn = Math.max(1, Math.floor(availableHeight / (charSize + charSpacing)));

    // 如果字数超出单列高度，或者字数大于等于6字，执行古典均分双列排版
    let columns = [];
    if (chars.length > maxCharsPerColumn || chars.length >= 6) {
      const mid = Math.ceil(chars.length / 2);
      columns.push(chars.slice(0, mid));
      columns.push(chars.slice(mid));
    } else {
      columns.push(chars);
    }

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // 从右往左排布列
    for (let c = 0; c < columns.length; c++) {
      const colChars = columns[c];
      const colX = startX - (c * columnSpacing);
      let colY = startY;

      for (let i = 0; i < colChars.length; i++) {
        ctx.fillText(colChars[i], colX, colY);
        colY += charSize + charSpacing;
      }
    }

    ctx.restore();
  }

  return {
    normalizePunctuation,
    wrapLines,
    renderHorizontalText,
    renderVerticalText,
    KINSOKU_HEAD,
    KINSOKU_TAIL
  };
}));

