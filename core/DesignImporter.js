/**
 * DesignImporter.js
 * 外部设计导入与模板渲染：支持 SVG 语义插槽与 JSON 模板协议。
 *
 * 相较于绝对坐标模板，本模块提供“流式布局”（flow layout）：
 * 文本图层渲染后会把实际底部基线写入布局游标，后续标记了 `flow: true`
 * 的图层据此定位，从而避免长文案压盖下方图层。
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DesignImporter = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** 与 schemas/template.schema.json 保持一致，由 test/schema-sync.test.mjs 断言。 */
  const LAYER_TYPES = ['text', 'gradient', 'line', 'rect'];
  const ALIGNMENTS = ['left', 'center', 'right'];
  const ORIENTATIONS = ['horizontal', 'vertical'];

  /** 模板结构错误：与 JSON 语法错误区分开，便于给出可操作的提示。 */
  function TemplateValidationError(message, path) {
    const err = new Error(path ? message + '（位置：' + path + '）' : message);
    err.name = 'TemplateValidationError';
    err.path = path || '';
    return err;
  }

  function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  class Importer {
    constructor() {
      this.parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;
    }

    /**
     * 解析外部导入的 JSON 模板。
     * @param {File|string|Object} input
     * @returns {Promise<Object>} 校验通过的模板对象
     */
    async loadTemplateJSON(input) {
      let template;

      if (input && typeof input === 'object' && typeof input.text !== 'function') {
        template = input;
      } else {
        const jsonString = typeof input === 'string' ? input : await input.text();
        try {
          template = JSON.parse(jsonString);
        } catch (err) {
          throw new Error('JSON 语法错误，无法解析模板文件：' + err.message);
        }
      }

      this.validateTemplate(template);
      return template;
    }

    /**
     * 结构化校验模板。抛出的错误会指明具体是哪一个图层的哪一个字段有问题。
     * @param {Object} template
     * @returns {true}
     */
    validateTemplate(template) {
      if (!template || typeof template !== 'object' || Array.isArray(template)) {
        throw TemplateValidationError('模板必须是一个 JSON 对象');
      }

      const required = ['name', 'version', 'dimensions', 'layers'];
      for (const key of required) {
        if (template[key] === undefined) {
          throw TemplateValidationError('缺少必填字段 "' + key + '"');
        }
      }

      const dim = template.dimensions;
      if (!dim || typeof dim !== 'object') {
        throw TemplateValidationError('dimensions 必须是一个对象');
      }
      if (!isFiniteNumber(dim.width) || dim.width <= 0 ||
          !isFiniteNumber(dim.height) || dim.height <= 0) {
        throw TemplateValidationError('dimensions 必须包含正数的 width 与 height');
      }

      if (!Array.isArray(template.layers)) {
        throw TemplateValidationError('layers 必须是一个数组');
      }

      template.layers.forEach((layer, index) => {
        const path = 'layers[' + index + ']' + (layer && layer.id ? ' #' + layer.id : '');

        if (!layer || typeof layer !== 'object') {
          throw TemplateValidationError('图层必须是对象', path);
        }
        if (typeof layer.id !== 'string' || layer.id === '') {
          throw TemplateValidationError('图层缺少字符串类型的 id', path);
        }
        if (LAYER_TYPES.indexOf(layer.type) === -1) {
          throw TemplateValidationError(
            '不支持的图层类型 "' + layer.type + '"，可选值：' + LAYER_TYPES.join(' / '), path);
        }
        if (layer.opacity !== undefined &&
            (!isFiniteNumber(layer.opacity) || layer.opacity < 0 || layer.opacity > 1)) {
          throw TemplateValidationError('opacity 必须是 0 ~ 1 之间的数字', path);
        }

        switch (layer.type) {
          case 'gradient':
            if (!Array.isArray(layer.stops) || layer.stops.length < 2) {
              throw TemplateValidationError('gradient 图层至少需要 2 个 stops', path);
            }
            layer.stops.forEach((stop, si) => {
              if (!stop || !isFiniteNumber(stop.offset) || stop.offset < 0 || stop.offset > 1) {
                throw TemplateValidationError(
                  'stops[' + si + '].offset 必须是 0 ~ 1 之间的数字', path);
              }
              if (typeof stop.color !== 'string' || stop.color === '') {
                throw TemplateValidationError('stops[' + si + '].color 必须是颜色字符串', path);
              }
            });
            break;

          case 'text':
            if (layer.binding === undefined && layer.content === undefined) {
              throw TemplateValidationError('text 图层需要 binding 或 content 之一', path);
            }
            if (!layer.flow && !isFiniteNumber(layer.y)) {
              throw TemplateValidationError('非流式 text 图层需要数字类型的 y', path);
            }
            if (!isFiniteNumber(layer.x)) {
              throw TemplateValidationError('text 图层需要数字类型的 x', path);
            }
            if (layer.align !== undefined && ALIGNMENTS.indexOf(layer.align) === -1) {
              throw TemplateValidationError(
                'align 可选值：' + ALIGNMENTS.join(' / '), path);
            }
            if (layer.orientation !== undefined && ORIENTATIONS.indexOf(layer.orientation) === -1) {
              throw TemplateValidationError(
                'orientation 可选值：' + ORIENTATIONS.join(' / '), path);
            }
            break;

          case 'line':
            ['x1', 'y1', 'x2', 'y2'].forEach((key) => {
              // 流式直线的 y1/y2 由布局游标决定，可以缺省
              if (layer.flow && (key === 'y1' || key === 'y2')) return;
              if (!isFiniteNumber(layer[key])) {
                throw TemplateValidationError('line 图层需要数字类型的 ' + key, path);
              }
            });
            break;

          case 'rect':
            if (!isFiniteNumber(layer.x) || !isFiniteNumber(layer.width) ||
                !isFiniteNumber(layer.height)) {
              throw TemplateValidationError('rect 图层需要数字类型的 x / width / height', path);
            }
            if (!layer.flow && !isFiniteNumber(layer.y)) {
              throw TemplateValidationError('非流式 rect 图层需要数字类型的 y', path);
            }
            break;
        }
      });

      return true;
    }

    /** @deprecated 使用 validateTemplate，保留以兼容旧调用。 */
    validateSchema(schema) {
      return this.validateTemplate(schema);
    }

    /**
     * 导入外部 SVG 矢量设计，替换语义插槽后栅格化为 Image。
     * @param {string} svgContent
     * @param {Object} dataSlots  形如 { topic: '核心标题', number: 'No.01' }
     * @returns {Promise<HTMLImageElement>}
     */
    async parseAndRenderSVG(svgContent, dataSlots = {}) {
      if (!this.parser) throw new Error('当前环境不支持 DOMParser');

      const doc = this.parser.parseFromString(String(svgContent || ''), 'image/svg+xml');
      if (doc.querySelector('parsererror')) {
        throw new Error('SVG 语法解析失败，请确认导出的是标准 SVG 文件');
      }

      const svg = doc.documentElement;
      if (!svg || svg.nodeName.toLowerCase() !== 'svg') {
        throw new Error('文件根节点不是 <svg>');
      }

      for (const [key, value] of Object.entries(dataSlots)) {
        const target = doc.getElementById('field_' + key) ||
                       doc.querySelector('[data-field="' + key + '"]');
        if (!target) continue;

        const tag = target.tagName.toLowerCase();
        if (tag === 'text' || tag === 'tspan') {
          // 清掉既有的 tspan 子节点，避免只改到父节点却仍显示旧文案
          while (target.firstChild) target.removeChild(target.firstChild);
          target.textContent = value == null ? '' : String(value);
        } else if (tag === 'image') {
          target.setAttribute('href', value);
          target.setAttribute('xlink:href', value);
        }
      }

      // 部分设计工具导出的 SVG 只有 viewBox 没有 width/height，
      // 这类图片在部分浏览器里 naturalWidth 为 0，drawImage 会画不出来。
      if (!svg.getAttribute('width') || !svg.getAttribute('height')) {
        const viewBox = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/);
        if (viewBox.length === 4) {
          svg.setAttribute('width', viewBox[2]);
          svg.setAttribute('height', viewBox[3]);
        }
      }
      if (!svg.getAttribute('xmlns')) {
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }

      const updatedSvg = new XMLSerializer().serializeToString(doc);

      return new Promise((resolve, reject) => {
        const blob = new Blob([updatedSvg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('SVG 栅格化失败，可能引用了外部资源或字体'));
        };
        img.src = url;
      });
    }

    /**
     * 按模板渲染所有图层。
     *
     * 布局规则：
     *  - 默认使用图层自身的绝对 y 坐标。
     *  - 若图层带有 `flow: true`，则 y = 上一个产生高度的图层底部 + flowGap。
     *  - 文本图层可用 `maxBottomY` 限制占用高度，超出部分自动截断并加省略号。
     *
     * @returns {Array<Object>} 每个可测量图层的实际包围盒，便于调试与测试
     */
    renderTemplateLayers(ctx, template, data, kinsokuEngine) {
      if (!template || !Array.isArray(template.layers)) return [];

      const dim = template.dimensions || { width: 1152, height: 2048 };
      const cursor = { y: 0, initialized: false };
      const boxes = [];

      for (const layer of template.layers) {
        ctx.save();
        if (layer.opacity !== undefined) ctx.globalAlpha = layer.opacity;

        let box = null;
        try {
          switch (layer.type) {
            case 'gradient':
              this._renderGradient(ctx, layer, dim);
              break;
            case 'text':
              box = this._renderTextLayer(ctx, layer, data, kinsokuEngine, cursor);
              break;
            case 'line':
              box = this._renderLine(ctx, layer, cursor);
              break;
            case 'rect':
              box = this._renderRect(ctx, layer, cursor);
              break;
            default:
              break;
          }
        } finally {
          ctx.restore();
        }

        if (box) {
          boxes.push(box);
          cursor.y = box.bottom;
          cursor.initialized = true;
        }
      }

      return boxes;
    }

    /** 解析图层的起始 y：流式图层跟随游标，其余用自身坐标。 */
    _resolveTop(layer, cursor, fallback) {
      const gap = isFiniteNumber(layer.flowGap) ? layer.flowGap : 0;
      if (layer.flow && cursor.initialized) return cursor.y + gap;
      return isFiniteNumber(layer.y) ? layer.y : fallback;
    }

    _renderGradient(ctx, layer, dim) {
      if (!Array.isArray(layer.stops) || layer.stops.length === 0) return;

      let grad;
      if (layer.direction === 'vertical') {
        const startY = isFiniteNumber(layer.y) ? layer.y : 0;
        const endY = isFiniteNumber(layer.height) ? startY + layer.height : dim.height;
        grad = ctx.createLinearGradient(0, startY, 0, endY);
      } else {
        const startX = isFiniteNumber(layer.x) ? layer.x : 0;
        const endX = isFiniteNumber(layer.width) ? startX + layer.width : dim.width;
        grad = ctx.createLinearGradient(startX, 0, endX, 0);
      }

      for (const stop of layer.stops) {
        grad.addColorStop(
          Math.min(1, Math.max(0, Number(stop.offset) || 0)),
          stop.color
        );
      }

      ctx.fillStyle = grad;
      ctx.fillRect(
        isFiniteNumber(layer.x) ? layer.x : 0,
        isFiniteNumber(layer.y) ? layer.y : 0,
        isFiniteNumber(layer.width) ? layer.width : dim.width,
        isFiniteNumber(layer.height) ? layer.height : dim.height
      );
    }

    _renderTextLayer(ctx, layer, data, kinsoku, cursor) {
      const source = data || {};
      const raw = layer.binding !== undefined && source[layer.binding] !== undefined
        ? source[layer.binding]
        : (layer.content !== undefined ? layer.content : '');

      const text = raw == null ? '' : String(raw);
      const top = this._resolveTop(layer, cursor, 0);

      if (text === '') {
        // 空文案不绘制，但仍推进游标，避免后续流式图层跳位
        return { id: layer.id, type: 'text', x: layer.x, y: top, bottom: top, lines: 0, empty: true };
      }

      const fontStyle = layer.fontStyle || 'normal';
      const fontWeight = layer.fontWeight || 'normal';
      const fontSize = isFiniteNumber(layer.fontSize) ? layer.fontSize : 32;
      const fontFamily = layer.fontFamily || '-apple-system, sans-serif';

      ctx.font = fontStyle + ' ' + fontWeight + ' ' + fontSize + 'px ' + fontFamily;
      ctx.fillStyle = layer.color || '#ffffff';

      if (layer.shadow) {
        ctx.shadowColor = layer.shadow.color || 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = isFiniteNumber(layer.shadow.blur) ? layer.shadow.blur : 10;
        ctx.shadowOffsetX = isFiniteNumber(layer.shadow.x) ? layer.shadow.x : 0;
        ctx.shadowOffsetY = isFiniteNumber(layer.shadow.y) ? layer.shadow.y : 0;
      }

      if (layer.orientation === 'vertical') {
        const maxBottomY = isFiniteNumber(layer.maxBottomY) ? layer.maxBottomY : top + 600;
        const layout = kinsoku.renderVerticalText(
          ctx, text, layer.x, top, maxBottomY, fontSize,
          isFiniteNumber(layer.charSpacing) ? layer.charSpacing : 8,
          isFiniteNumber(layer.columnSpacing) ? layer.columnSpacing : 40,
          { columns: layer.columns === undefined ? 'auto' : layer.columns }
        );
        return {
          id: layer.id, type: 'text', orientation: 'vertical',
          x: layer.x, y: top, bottom: layout.bottomY,
          columns: layout.columns.length, truncated: layout.truncated
        };
      }

      const maxWidth = isFiniteNumber(layer.maxWidth) ? layer.maxWidth : 800;
      const lineHeight = isFiniteNumber(layer.lineHeight)
        ? layer.lineHeight
        : Math.round(fontSize * 1.5);

      // 安全区：把 maxBottomY 换算成最大行数，超出即截断
      let maxLines = isFiniteNumber(layer.maxLines) ? layer.maxLines : 0;
      if (!maxLines && isFiniteNumber(layer.maxBottomY)) {
        maxLines = kinsoku.maxLinesForHeight(layer.maxBottomY - top, lineHeight);
      }

      const lines = kinsoku.wrapLines(ctx, text, maxWidth, {
        maxLines: maxLines,
        normalize: layer.normalizePunctuation !== false
      });

      const metrics = kinsoku.renderHorizontalText(
        ctx, lines, layer.x, top, lineHeight, layer.align || 'left'
      );

      return {
        id: layer.id, type: 'text', orientation: 'horizontal',
        x: layer.x, y: top, bottom: metrics.lastBaselineY,
        lines: metrics.lines,
        truncated: maxLines > 0 && lines.length >= maxLines
      };
    }

    _renderLine(ctx, layer, cursor) {
      const gap = isFiniteNumber(layer.flowGap) ? layer.flowGap : 0;
      const y1 = layer.flow && cursor.initialized
        ? cursor.y + gap
        : layer.y1;
      const y2 = layer.flow && cursor.initialized
        ? cursor.y + gap + ((layer.y2 || 0) - (layer.y1 || 0))
        : layer.y2;

      ctx.strokeStyle = layer.color || '#d4af37';
      ctx.lineWidth = isFiniteNumber(layer.lineWidth) ? layer.lineWidth : 1;
      ctx.beginPath();
      ctx.moveTo(layer.x1, y1);
      ctx.lineTo(layer.x2, y2);
      ctx.stroke();

      return {
        id: layer.id, type: 'line',
        x: Math.min(layer.x1, layer.x2), y: Math.min(y1, y2),
        bottom: Math.max(y1, y2)
      };
    }

    _renderRect(ctx, layer, cursor) {
      const top = this._resolveTop(layer, cursor, 0);

      if (layer.fill) {
        ctx.fillStyle = layer.fill;
        ctx.fillRect(layer.x, top, layer.width, layer.height);
      }
      if (layer.stroke) {
        ctx.strokeStyle = layer.stroke;
        ctx.lineWidth = isFiniteNumber(layer.strokeWidth) ? layer.strokeWidth : 1;
        ctx.strokeRect(layer.x, top, layer.width, layer.height);
      }

      return {
        id: layer.id, type: 'rect',
        x: layer.x, y: top, bottom: top + layer.height
      };
    }
  }

  Importer.LAYER_TYPES = LAYER_TYPES;
  Importer.ALIGNMENTS = ALIGNMENTS;
  Importer.ORIENTATIONS = ORIENTATIONS;

  return Importer;
}));
