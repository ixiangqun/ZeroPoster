/**
 * DesignImporter.js
 * 外部设计导入中枢：支持 SVG 语义分层与 JSON 模板规范导入
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

  class Importer {
    constructor() {
      this.parser = new DOMParser();
    }

    /**
     * 解析外部导入的 JSON 模板文件
     * @param {File|string} input - JSON 文本或 File 对象
     * @returns {Promise<Object>} 标准化模板对象
     */
    async loadTemplateJSON(input) {
      let jsonString = '';
      if (typeof input === 'string') {
        jsonString = input;
      } else if (input instanceof File) {
        jsonString = await input.text();
      } else if (typeof input === 'object') {
        return input;
      }

      try {
        const schema = JSON.parse(jsonString);
        this.validateSchema(schema);
        return schema;
      } catch (err) {
        throw new Error('模板 JSON 解析失败: ' + err.message);
      }
    }

    /**
     * 校验模板必要字段
     */
    validateSchema(schema) {
      if (!schema.version || !schema.dimensions || !schema.layers) {
        throw new Error('无效的模板结构，缺少 version, dimensions 或 layers 字段');
      }
      if (!schema.dimensions.width || !schema.dimensions.height) {
        throw new Error('dimensions 必须包含 width 与 height');
      }
      return true;
    }

    /**
     * 导入外部 SVG 矢量设计并根据业务数据动态插槽替换
     * @param {string} svgContent - SVG 原始 XML 字符串
     * @param {Object} dataSlots - 动态数据映射表 { "topic": "核心标题", "number": "No.01" }
     * @returns {Promise<HTMLImageElement>} 栅格化后的 Image 元素（可直接绘制到 Canvas）
     */
    async parseAndRenderSVG(svgContent, dataSlots = {}) {
      const doc = this.parser.parseFromString(svgContent, 'image/svg+xml');
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        throw new Error('SVG 语法解析错误');
      }

      // 遍历插槽并替换对应节点
      for (let [key, value] of Object.entries(dataSlots)) {
        // 查找带有 id="field_xxx" 或 data-field="xxx" 的节点
        const target = doc.getElementById(`field_${key}`) || doc.querySelector(`[data-field="${key}"]`);
        if (target) {
          if (target.tagName.toLowerCase() === 'text' || target.tagName.toLowerCase() === 'tspan') {
            target.textContent = value;
          } else if (target.tagName.toLowerCase() === 'image') {
            target.setAttribute('href', value);
          }
        }
      }

      // 序列化回 XML
      const serializer = new XMLSerializer();
      const updatedSvg = serializer.serializeToString(doc);

      // 生成 Blob URL 并加载为 Image
      return new Promise((resolve, reject) => {
        const blob = new Blob([updatedSvg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(e);
        };
        img.src = url;
      });
    }

    /**
     * 从外部设计图层渲染至目标 Canvas
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {Object} template - 标准模板对象
     * @param {Object} data - 业务数据
     * @param {Object} kinsokuEngine - 汉字避头尾引擎
     */
    renderTemplateLayers(ctx, template, data, kinsokuEngine) {
      if (!template || !template.layers) return;

      for (let layer of template.layers) {
        ctx.save();

        if (layer.opacity !== undefined) {
          ctx.globalAlpha = layer.opacity;
        }

        switch (layer.type) {
          case 'gradient':
            this._renderGradient(ctx, layer, template.dimensions);
            break;

          case 'text':
            this._renderTextLayer(ctx, layer, data, kinsokuEngine);
            break;

          case 'line':
            this._renderLine(ctx, layer);
            break;

          case 'rect':
            this._renderRect(ctx, layer);
            break;
        }

        ctx.restore();
      }
    }

    _renderGradient(ctx, layer, dim) {
      let grad;
      if (layer.direction === 'vertical') {
        const startY = layer.y || 0;
        const endY = layer.y !== undefined && layer.height ? layer.y + layer.height : dim.height;
        grad = ctx.createLinearGradient(0, startY, 0, endY);
      } else {
        grad = ctx.createLinearGradient(0, 0, dim.width, 0);
      }

      for (let stop of layer.stops) {
        grad.addColorStop(stop.offset, stop.color);
      }

      ctx.fillStyle = grad;
      ctx.fillRect(layer.x || 0, layer.y || 0, layer.width || dim.width, layer.height || dim.height);
    }

    _renderTextLayer(ctx, layer, data, kinsoku) {
      // 提取动态数据或默认文本
      const rawText = layer.binding && data[layer.binding] !== undefined
        ? data[layer.binding]
        : (layer.content || '');

      if (!rawText) return;

      const fontStyle = layer.fontStyle || 'normal';
      const fontWeight = layer.fontWeight || 'normal';
      const fontSize = layer.fontSize || 32;
      const fontFamily = layer.fontFamily || '-apple-system, sans-serif';

      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = layer.color || '#ffffff';

      if (layer.shadow) {
        ctx.shadowColor = layer.shadow.color || 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = layer.shadow.blur || 10;
        ctx.shadowOffsetX = layer.shadow.x || 0;
        ctx.shadowOffsetY = layer.shadow.y || 0;
      }

      if (layer.orientation === 'vertical') {
        kinsoku.renderVerticalText(
          ctx,
          rawText,
          layer.x,
          layer.y,
          layer.maxBottomY || (layer.y + 600),
          fontSize,
          layer.charSpacing || 8,
          layer.columnSpacing || 40
        );
      } else {
        const maxWidth = layer.maxWidth || 800;
        const lineHeight = layer.lineHeight || Math.round(fontSize * 1.5);
        const align = layer.align || 'left';
        const lines = kinsoku.wrapLines(ctx, rawText, maxWidth);
        kinsoku.renderHorizontalText(ctx, lines, layer.x, layer.y, lineHeight, align);
      }
    }

    _renderLine(ctx, layer) {
      ctx.strokeStyle = layer.color || '#d4af37';
      ctx.lineWidth = layer.lineWidth || 1;
      ctx.beginPath();
      ctx.moveTo(layer.x1, layer.y1);
      ctx.lineTo(layer.x2, layer.y2);
      ctx.stroke();
    }

    _renderRect(ctx, layer) {
      ctx.fillStyle = layer.fill || 'transparent';
      if (layer.stroke) {
        ctx.strokeStyle = layer.stroke;
        ctx.lineWidth = layer.strokeWidth || 1;
      }
      ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
      if (layer.stroke) {
        ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
      }
    }
  }

  return Importer;
}));

