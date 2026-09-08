/**
 * KinsokuEngine.js
 * CJK 换行禁则（Kinsoku Shori）与标点排版引擎。
 *
 * 依据说明：
 *  - 换行禁则（行首/行尾不可出现的字符、标点悬挂）参考 W3C《中文排版需求》(CLREQ)
 *    与 JIS X 4051《日本語文書の組版方法》。
 *  - 半角/全角标点归一化参考 GB/T 15834《标点符号用法》，该标准规范标点的“用法”，
 *    并不定义换行算法，故不作为禁则依据。
 *
 * 本模块不依赖 DOM，只要求传入的 ctx 具备 measureText(string) -> {width} 即可，
 * 因此可以在 Node 中直接单元测试。
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
  'use strict';

  /** 不允许出现在行首的字符（行首禁则）。断行时改为悬挂在上一行行尾。 */
  const HEAD_FORBIDDEN = new Set([
    '，', '。', '．', '！', '？', '、', '；', '：', '·', '…', '—', '～',
    '）', '》', '】', '』', '」', '〕', '〉', '｝', '］', '”', '’',
    ',', '.', '!', '?', ';', ':', ')', ']', '}', '>',
    '％', '‰', '℃', '°', '%'
  ]);

  /** 不允许出现在行尾的字符（行尾禁则）。断行时整体推入下一行。 */
  const TAIL_FORBIDDEN = new Set([
    '（', '《', '【', '『', '「', '〔', '〈', '｛', '［', '“', '‘',
    '(', '[', '{', '<', '￥', '＄', '$', '#', '＃'
  ]);

  /** 单次断行最多允许悬挂的标点数量（如 “。」” 两个符号需要一起挂出）。 */
  const MAX_HANGING = 2;

  const IDEOGRAPH_RE = /[㐀-䶿一-鿿豈-﫿぀-ヿㇰ-ㇿ가-힯]/;
  const WIDE_PUNCT_RE = /[　-〿！-｠￠-￦]/;
  const LATIN_RE = /[A-Za-z0-9]/;
  const SPACE_RE = /[ \t ]/;

  /** 词内允许出现的连接符：仅当其两侧都是字母或数字时才不断开。 */
  const INTRA_WORD = "'’.-_/@+&";

  /** URL 与邮箱：整体视为一个不可拆分的排版单元，且不参与标点归一化。 */
  const URI_RE = /(?:[a-z][a-z0-9+.-]{1,31}:\/\/|www\.)[^\s　-〿！-｠]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+/i;
  const URI_RE_G = new RegExp(URI_RE.source, 'gi');
  /** URI 末尾若粘连了句读，应当剥离出来单独处理。 */
  const URI_TRAILING_RE = /[.,;:!?'")\]}]+$/;

  /**
   * 归一化时用来包裹受保护片段（URL / 邮箱）的哨兵字符。
   * 选用 U+0000 是因为它绝不会出现在正常文案里；这里用转义写法而不是直接
   * 嵌入裸控制字符，以免被编辑器、diff 工具或复制粘贴悄悄改坏。
   */
  const SENTINEL = '\u0000';
  const SENTINEL_RE = /\u0000(\d+)\u0000/g;

  const HALF_TO_FULL = {
    ',': '，',
    ':': '：',
    ';': '；',
    '!': '！',
    '?': '？'
  };

  function isWide(ch) {
    return !!ch && (IDEOGRAPH_RE.test(ch) || WIDE_PUNCT_RE.test(ch));
  }

  function isDigit(ch) {
    return !!ch && ch >= '0' && ch <= '9';
  }

  /**
   * 半角标点归一化。
   *
   * 只在“紧邻中日韩文字”时才转换为全角，因此以下内容保持原样：
   *   - URL 与邮箱：https://a.com/x?id=1
   *   - 千分位与小数：1,000
   *   - 时间与比例：3:30、16:9
   *   - 纯西文句子：hello, world
   *
   * @param {string} text
   * @returns {string}
   */
  function normalizePunctuation(text) {
    if (text === null || text === undefined || text === '') return '';

    // 1) 先把 URL / 邮箱替换成占位符，保护其内部标点。
    const protectedRuns = [];
    const masked = String(text).replace(URI_RE_G, function (match) {
      const trailing = match.match(URI_TRAILING_RE);
      const core = trailing ? match.slice(0, -trailing[0].length) : match;
      if (!core) return match;
      protectedRuns.push(core);
      return SENTINEL + (protectedRuns.length - 1) + SENTINEL + (trailing ? trailing[0] : '');
    });

    // 2) 逐字符判断上下文。
    let out = '';
    for (let i = 0; i < masked.length; i++) {
      const ch = masked[i];
      const full = HALF_TO_FULL[ch];
      if (!full) {
        out += ch;
        continue;
      }

      const prev = masked[i - 1] || '';
      const immediateNext = masked[i + 1] || '';

      // 数字内部的分隔符（1,000 / 3:30）必须保持半角。
      if (isDigit(prev) && isDigit(immediateNext)) {
        out += ch;
        continue;
      }

      let j = i + 1;
      while (j < masked.length && SPACE_RE.test(masked[j])) j++;
      const nextNonSpace = masked[j] || '';

      // 只有与中文相邻时才全角化。
      if (isWide(prev) || isWide(nextNonSpace)) {
        out += full;
        i = j - 1; // 全角标点自带西文空格宽度，吞掉其后的空白
        continue;
      }

      out += ch;
    }

    // 3) 还原受保护片段。
    return out.replace(SENTINEL_RE, function (_, index) {
      return protectedRuns[Number(index)];
    });
  }

  /**
   * 将文本切分为排版单元：
   *   - URL / 邮箱     -> 一个整体
   *   - 连续西文单词    -> 一个整体（避免 "Canvas" 被断成 "Canva" + "s"）
   *   - 单个汉字/标点   -> 各自独立
   *   - 连续空白       -> 一个整体
   *
   * @param {string} text
   * @returns {string[]}
   */
  function tokenize(text) {
    const src = String(text || '');
    const tokens = [];
    let i = 0;

    while (i < src.length) {
      const rest = src.slice(i);

      const uri = rest.match(URI_RE);
      if (uri && uri.index === 0) {
        const trailing = uri[0].match(URI_TRAILING_RE);
        const core = trailing ? uri[0].slice(0, -trailing[0].length) : uri[0];
        if (core) {
          tokens.push(core);
          i += core.length;
          continue;
        }
      }

      const ch = src[i];

      if (SPACE_RE.test(ch)) {
        let word = '';
        while (i < src.length && SPACE_RE.test(src[i])) word += src[i++];
        tokens.push(word);
        continue;
      }

      if (LATIN_RE.test(ch)) {
        let word = '';
        while (i < src.length) {
          const c = src[i];
          if (LATIN_RE.test(c)) {
            word += c;
            i++;
            continue;
          }
          if (INTRA_WORD.indexOf(c) !== -1 && LATIN_RE.test(src[i + 1] || '')) {
            word += c;
            i++;
            continue;
          }
          break;
        }
        tokens.push(word);
        continue;
      }

      // 代理对（emoji 等）需要整体取出
      const code = src.codePointAt(i);
      const unit = String.fromCodePoint(code);
      tokens.push(unit);
      i += unit.length;
    }

    return tokens;
  }

  /**
   * 建立带缓存的文本测量器。同一次排版内重复字符只测量一次，把原先的
   * O(n²) 前缀测量降为 O(n)。
   */
  function createMeasurer(ctx) {
    const cache = new Map();
    return function measure(str) {
      if (!str) return 0;
      let width = cache.get(str);
      if (width === undefined) {
        width = ctx.measureText(str).width;
        cache.set(str, width);
      }
      return width;
    };
  }

  /**
   * 折行计算。
   *
   * @param {{measureText: function}} ctx        Canvas 2D 上下文（或任何具备 measureText 的对象）
   * @param {string} text                        原始文本
   * @param {number} maxWidth                    最大排版宽度
   * @param {Object} [options]
   * @param {boolean} [options.normalize=true]   是否执行标点归一化
   * @param {number}  [options.maxLines=0]       最大行数，超出部分截断并追加省略号（0 表示不限制）
   * @param {string}  [options.ellipsis='…']     截断符
   * @returns {string[]} 折行后的文本数组
   */
  function wrapLines(ctx, text, maxWidth, options) {
    const opts = options || {};
    const normalize = opts.normalize !== false;
    const maxLines = Number(opts.maxLines) || 0;
    const ellipsis = opts.ellipsis === undefined ? '…' : opts.ellipsis;

    if (text === null || text === undefined || text === '') return [];

    const source = normalize ? normalizePunctuation(String(text)) : String(text);
    const measure = createMeasurer(ctx);
    const limit = Number(maxWidth) || 0;
    const result = [];

    const paragraphs = source.split('\n');

    for (let p = 0; p < paragraphs.length; p++) {
      const tokens = tokenize(paragraphs[p]);
      let line = [];
      let width = 0;

      const flush = function () {
        while (line.length && SPACE_RE.test(line[line.length - 1])) line.pop();
        result.push(line.join(''));
        line = [];
        width = 0;
      };

      for (let t = 0; t < tokens.length; t++) {
        let token = tokens[t];
        let tokenWidth = measure(token);

        // 单个排版单元本身就超宽（超长英文单词 / URL）：退化为逐字符断开。
        if (limit > 0 && tokenWidth > limit) {
          const parts = Array.from(token);
          if (parts.length > 1) {
            tokens.splice.apply(tokens, [t, 1].concat(parts));
            t--;
            continue;
          }
        }

        // 行首空白直接丢弃
        if (line.length === 0 && SPACE_RE.test(token)) continue;

        if (line.length > 0 && limit > 0 && width + tokenWidth > limit) {
          // 规则一 · 行首禁则：该字符不能起行，悬挂到当前行末（标点悬挂）。
          if (HEAD_FORBIDDEN.has(token)) {
            line.push(token);
            let hung = 1;
            let k = t + 1;
            while (k < tokens.length && hung < MAX_HANGING && HEAD_FORBIDDEN.has(tokens[k])) {
              line.push(tokens[k]);
              k++;
              hung++;
            }
            t = k - 1;
            flush();
            continue;
          }

          // 规则二 · 行尾禁则：当前行末的开引号/开括号不能收尾，整体挪到下一行。
          const carry = [];
          while (line.length > 1 && TAIL_FORBIDDEN.has(line[line.length - 1])) {
            carry.unshift(line.pop());
          }

          flush();

          for (let c = 0; c < carry.length; c++) {
            line.push(carry[c]);
            width += measure(carry[c]);
          }
          line.push(token);
          width += tokenWidth;
          continue;
        }

        line.push(token);
        width += tokenWidth;
      }

      if (line.length > 0) {
        flush();
      } else if (paragraphs[p] === '') {
        result.push(''); // 保留空行
      }
    }

    return maxLines > 0
      ? truncateLines(result, maxLines, measure, limit, ellipsis)
      : result;
  }

  /**
   * 将行数组裁剪到 maxLines，并在最后一行末尾追加省略号（保证仍不超宽）。
   */
  function truncateLines(lines, maxLines, measure, limit, ellipsis) {
    if (!maxLines || lines.length <= maxLines) return lines;

    const kept = lines.slice(0, maxLines);
    const ellipsisWidth = measure(ellipsis);
    let chars = Array.from(kept[maxLines - 1]);

    while (chars.length > 0 && limit > 0 &&
           measure(chars.join('')) + ellipsisWidth > limit) {
      chars.pop();
    }
    // 省略号前不应残留行首禁则标点或空白
    while (chars.length > 0 &&
           (HEAD_FORBIDDEN.has(chars[chars.length - 1]) || SPACE_RE.test(chars[chars.length - 1]))) {
      chars.pop();
    }

    kept[maxLines - 1] = chars.join('') + ellipsis;
    return kept;
  }

  /**
   * 根据可用高度反推最多能排几行。
   */
  function maxLinesForHeight(availableHeight, lineHeight) {
    if (!(lineHeight > 0)) return 0;
    return Math.max(1, Math.floor(availableHeight / lineHeight) + 1);
  }

  /**
   * 绘制横排文本块。
   *
   * @returns {{lines:number, firstBaselineY:number, lastBaselineY:number, height:number, nextY:number}}
   */
  function renderHorizontalText(ctx, lines, startX, startY, lineHeight, align, baseline) {
    ctx.save();
    ctx.textAlign = align || 'left';
    ctx.textBaseline = baseline || 'alphabetic';

    let y = startY;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] !== '') ctx.fillText(lines[i], startX, y);
      y += lineHeight;
    }
    ctx.restore();

    const count = lines.length;
    return {
      lines: count,
      firstBaselineY: startY,
      lastBaselineY: count > 0 ? startY + (count - 1) * lineHeight : startY,
      height: count > 0 ? (count - 1) * lineHeight : 0,
      nextY: y
    };
  }

  /**
   * 竖排文本排版计算（不绘制）。保证结果的 bottomY 不会超过 maxBottomY。
   *
   * @param {string} text
   * @param {Object} options
   * @param {number} options.startY
   * @param {number} options.maxBottomY
   * @param {number} options.charSize
   * @param {number} [options.charSpacing=10]
   * @param {number|'auto'} [options.columns='auto']  列数，'auto' 表示按需最少列
   * @param {number} [options.maxColumns=4]           自动模式下的列数上限
   * @param {boolean} [options.trimTrailingPunctuation=true]
   * @param {string} [options.ellipsis='…']
   * @returns {{columns:string[][], bottomY:number, truncated:boolean, perColumn:number, charStep:number}}
   */
  function layoutVerticalText(text, options) {
    const opts = options || {};
    const startY = Number(opts.startY) || 0;
    const charSize = Number(opts.charSize) || 32;
    const charSpacing = opts.charSpacing === undefined ? 10 : Number(opts.charSpacing);
    const maxBottomY = Number(opts.maxBottomY);
    const maxColumns = Math.max(1, Number(opts.maxColumns) || 4);
    const ellipsis = opts.ellipsis === undefined ? '…' : opts.ellipsis;
    const trimTrailing = opts.trimTrailingPunctuation !== false;

    const empty = {
      columns: [], bottomY: startY, truncated: false,
      perColumn: 0, charStep: charSize + charSpacing
    };

    let clean = String(text === null || text === undefined ? '' : text);
    if (trimTrailing) clean = clean.replace(/[，,。．！!？?、；;：:\s]+$/, '');
    const chars = Array.from(clean);
    if (chars.length === 0) return empty;

    const step = charSize + charSpacing;
    const available = Math.max(0, (isFinite(maxBottomY) ? maxBottomY : Infinity) - startY);

    // n 个字占用高度 = n * charSize + (n - 1) * charSpacing
    const perColumn = isFinite(available)
      ? Math.max(1, Math.floor((available + charSpacing) / step))
      : chars.length;

    let columnCount;
    if (opts.columns === undefined || opts.columns === null || opts.columns === 'auto') {
      columnCount = Math.min(maxColumns, Math.max(1, Math.ceil(chars.length / perColumn)));
    } else {
      columnCount = Math.max(1, Math.min(maxColumns, Math.floor(Number(opts.columns) || 1)));
    }

    // 真正的安全区拦截：容纳不下就截断，而不是画出边界。
    const capacity = columnCount * perColumn;
    let list = chars;
    let truncated = false;
    if (chars.length > capacity) {
      list = chars.slice(0, Math.max(1, capacity - 1));
      if (ellipsis) list.push(ellipsis);
      truncated = true;
    }

    const per = Math.ceil(list.length / columnCount);
    const columns = [];
    for (let i = 0; i < list.length; i += per) {
      columns.push(list.slice(i, i + per));
    }

    let longest = 0;
    for (let i = 0; i < columns.length; i++) {
      if (columns[i].length > longest) longest = columns[i].length;
    }

    return {
      columns: columns,
      bottomY: startY + (longest > 0 ? longest * charSize + (longest - 1) * charSpacing : 0),
      truncated: truncated,
      perColumn: perColumn,
      charStep: step
    };
  }

  /**
   * 绘制金石竖排文本（自右向左布列，带安全区截断）。
   * @returns {Object} layoutVerticalText 的布局结果
   */
  function renderVerticalText(ctx, text, startX, startY, maxBottomY, charSize,
                              charSpacing, columnSpacing, options) {
    const spacing = charSpacing === undefined ? 10 : charSpacing;
    const colSpacing = columnSpacing === undefined ? 40 : columnSpacing;

    const layout = layoutVerticalText(text, Object.assign({}, options, {
      startY: startY,
      maxBottomY: maxBottomY,
      charSize: charSize,
      charSpacing: spacing
    }));

    if (layout.columns.length === 0) return layout;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let c = 0; c < layout.columns.length; c++) {
      const column = layout.columns[c];
      const x = startX - c * colSpacing;
      let y = startY;
      for (let i = 0; i < column.length; i++) {
        ctx.fillText(column[i], x, y);
        y += layout.charStep;
      }
    }

    ctx.restore();
    return layout;
  }

  return {
    normalizePunctuation: normalizePunctuation,
    tokenize: tokenize,
    wrapLines: wrapLines,
    maxLinesForHeight: maxLinesForHeight,
    renderHorizontalText: renderHorizontalText,
    layoutVerticalText: layoutVerticalText,
    renderVerticalText: renderVerticalText,
    HEAD_FORBIDDEN: HEAD_FORBIDDEN,
    TAIL_FORBIDDEN: TAIL_FORBIDDEN,
    // 兼容旧命名
    KINSOKU_HEAD: HEAD_FORBIDDEN,
    KINSOKU_TAIL: TAIL_FORBIDDEN
  };
}));
