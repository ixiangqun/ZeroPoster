/**
 * Presets.js —— 由 tools/build-presets.mjs 从 templates/*.json 自动生成，请勿手动编辑。
 *
 * 修改模板请编辑 templates/ 下的 JSON 源文件，然后运行：
 *   npm run build:presets
 *
 * 内联而非 fetch 的原因：浏览器会以 CORS 错误拒绝 file:// 协议下的 fetch()，
 * 而本项目承诺双击 index.html 即可运行。
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ZeroPosterPresets = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    minimal: {
      "name": "极简大片版 (Editorial Minimal)",
      "version": "1.1.0",
      "description": "无界全屏通透大片版，适合小红书、杂志风与现代生活方式分享。正文与副标题采用流式布局，长文案不会压盖页脚。",
      "dimensions": {
        "width": 1152,
        "height": 2048
      },
      "layers": [
        {
          "id": "top_shadow",
          "type": "gradient",
          "direction": "vertical",
          "y": 0,
          "height": 450,
          "stops": [
            {
              "offset": 0,
              "color": "rgba(0, 0, 0, 0.75)"
            },
            {
              "offset": 1,
              "color": "rgba(0, 0, 0, 0)"
            }
          ]
        },
        {
          "id": "bottom_shadow",
          "type": "gradient",
          "direction": "vertical",
          "y": 850,
          "height": 1198,
          "stops": [
            {
              "offset": 0,
              "color": "rgba(0, 0, 0, 0)"
            },
            {
              "offset": 0.35,
              "color": "rgba(10, 14, 18, 0.78)"
            },
            {
              "offset": 0.7,
              "color": "rgba(10, 14, 18, 0.94)"
            },
            {
              "offset": 1,
              "color": "rgba(10, 14, 18, 0.98)"
            }
          ]
        },
        {
          "id": "eyebrow",
          "type": "text",
          "binding": "number",
          "x": 576,
          "y": 950,
          "fontSize": 24,
          "fontFamily": "system-ui, sans-serif",
          "fontWeight": "600",
          "color": "rgba(220, 192, 126, 0.9)",
          "align": "center",
          "maxWidth": 900,
          "maxLines": 1
        },
        {
          "id": "main_title",
          "type": "text",
          "binding": "topic",
          "x": 576,
          "y": 1080,
          "fontSize": 90,
          "fontFamily": "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', serif",
          "fontWeight": "900",
          "color": "#ffffff",
          "align": "center",
          "maxWidth": 940,
          "lineHeight": 118,
          "maxBottomY": 1198,
          "shadow": {
            "color": "rgba(0,0,0,0.8)",
            "blur": 16,
            "y": 6
          }
        },
        {
          "id": "body_text",
          "type": "text",
          "binding": "content",
          "flow": true,
          "flowGap": 108,
          "x": 576,
          "y": 1306,
          "fontSize": 33,
          "fontFamily": "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', serif",
          "fontWeight": "500",
          "color": "#f1f5f9",
          "align": "center",
          "maxWidth": 860,
          "lineHeight": 60,
          "maxBottomY": 1560,
          "shadow": {
            "color": "rgba(0,0,0,0.6)",
            "blur": 8,
            "y": 2
          }
        },
        {
          "id": "sub_endorsement",
          "type": "text",
          "binding": "subtext",
          "flow": true,
          "flowGap": 92,
          "x": 576,
          "y": 1460,
          "fontSize": 28,
          "fontFamily": "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', serif",
          "fontWeight": "600",
          "color": "#dcc07e",
          "align": "center",
          "maxWidth": 860,
          "lineHeight": 54,
          "maxBottomY": 1700
        },
        {
          "id": "divider_line",
          "type": "line",
          "x1": 400,
          "y1": 1750,
          "x2": 752,
          "y2": 1750,
          "lineWidth": 1.5,
          "color": "rgba(212, 175, 55, 0.45)"
        },
        {
          "id": "footer_greeting",
          "type": "text",
          "binding": "greeting",
          "x": 576,
          "y": 1835,
          "fontSize": 38,
          "fontFamily": "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', serif",
          "fontWeight": "600",
          "color": "#ffffff",
          "align": "center",
          "maxWidth": 940,
          "maxLines": 1
        },
        {
          "id": "footer_signature",
          "type": "text",
          "binding": "signature",
          "x": 576,
          "y": 1915,
          "fontSize": 32,
          "fontFamily": "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', serif",
          "fontWeight": "700",
          "color": "#dcc07e",
          "align": "center",
          "maxWidth": 940,
          "maxLines": 1
        }
      ]
    },
    classic: {
      "name": "金石宋韵竖排版 (Classical CJK)",
      "version": "1.1.0",
      "description": "传统宣纸金石风骨，右侧古典竖排与左下大标题，适合文创与非遗。竖排文本受安全区约束，超出自动截断。",
      "dimensions": {
        "width": 1152,
        "height": 2048
      },
      "layers": [
        {
          "id": "full_vignette",
          "type": "gradient",
          "direction": "vertical",
          "y": 0,
          "height": 2048,
          "stops": [
            {
              "offset": 0,
              "color": "rgba(10, 15, 12, 0.45)"
            },
            {
              "offset": 0.45,
              "color": "rgba(10, 15, 12, 0.7)"
            },
            {
              "offset": 0.8,
              "color": "rgba(8, 12, 10, 0.95)"
            },
            {
              "offset": 1,
              "color": "rgba(8, 12, 10, 0.98)"
            }
          ]
        },
        {
          "id": "vertical_greeting",
          "type": "text",
          "binding": "greeting",
          "orientation": "vertical",
          "columns": "auto",
          "x": 1050,
          "y": 280,
          "maxBottomY": 1200,
          "fontSize": 34,
          "fontFamily": "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', serif",
          "fontWeight": "600",
          "color": "#ecd29b",
          "charSpacing": 14,
          "columnSpacing": 45
        },
        {
          "id": "eyebrow_cjk",
          "type": "text",
          "binding": "number",
          "x": 120,
          "y": 920,
          "fontSize": 24,
          "fontFamily": "system-ui, sans-serif",
          "fontWeight": "600",
          "color": "rgba(220, 192, 126, 0.85)",
          "align": "left",
          "maxWidth": 900,
          "maxLines": 1
        },
        {
          "id": "topic_cjk",
          "type": "text",
          "binding": "topic",
          "x": 120,
          "y": 1050,
          "fontSize": 88,
          "fontFamily": "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', serif",
          "fontWeight": "900",
          "color": "#ffffff",
          "align": "left",
          "maxWidth": 900,
          "lineHeight": 116,
          "maxBottomY": 1166
        },
        {
          "id": "content_cjk",
          "type": "text",
          "binding": "content",
          "flow": true,
          "flowGap": 116,
          "x": 120,
          "y": 1200,
          "fontSize": 34,
          "fontFamily": "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', serif",
          "fontWeight": "500",
          "color": "#e2e8f0",
          "align": "left",
          "maxWidth": 900,
          "lineHeight": 62,
          "maxBottomY": 1560
        },
        {
          "id": "subtext_cjk",
          "type": "text",
          "binding": "subtext",
          "flow": true,
          "flowGap": 90,
          "x": 120,
          "y": 1420,
          "fontSize": 28,
          "fontFamily": "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', serif",
          "fontWeight": "600",
          "color": "#dcc07e",
          "align": "left",
          "maxWidth": 900,
          "lineHeight": 52,
          "maxBottomY": 1740
        },
        {
          "id": "footer_cjk_sign",
          "type": "text",
          "binding": "signature",
          "x": 120,
          "y": 1880,
          "fontSize": 34,
          "fontFamily": "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', serif",
          "fontWeight": "700",
          "color": "#dcc07e",
          "align": "left",
          "maxWidth": 900,
          "maxLines": 1
        }
      ]
    },
    dark: {
      "name": "极客暗黑金句版 (Dark Mode Card)",
      "version": "1.1.0",
      "description": "现代冷调工业风，适合读书笔记、播客金句与极客观点分享。署名与注解跟随金句流动排布。",
      "dimensions": {
        "width": 1152,
        "height": 2048
      },
      "layers": [
        {
          "id": "dark_overlay",
          "type": "gradient",
          "direction": "vertical",
          "y": 0,
          "height": 2048,
          "stops": [
            {
              "offset": 0,
              "color": "rgba(15, 20, 25, 0.65)"
            },
            {
              "offset": 0.5,
              "color": "rgba(11, 15, 20, 0.88)"
            },
            {
              "offset": 1,
              "color": "rgba(7, 10, 14, 0.98)"
            }
          ]
        },
        {
          "id": "badge_box",
          "type": "rect",
          "x": 100,
          "y": 240,
          "width": 260,
          "height": 50,
          "fill": "rgba(56, 189, 248, 0.12)",
          "stroke": "rgba(56, 189, 248, 0.4)",
          "strokeWidth": 1.5
        },
        {
          "id": "badge_text",
          "type": "text",
          "binding": "number",
          "x": 230,
          "y": 273,
          "fontSize": 20,
          "fontFamily": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          "fontWeight": "700",
          "color": "#38bdf8",
          "align": "center",
          "maxWidth": 240,
          "maxLines": 1
        },
        {
          "id": "quote_mark",
          "type": "text",
          "content": "“",
          "x": 100,
          "y": 620,
          "fontSize": 180,
          "fontFamily": "Georgia, 'Times New Roman', serif",
          "fontWeight": "900",
          "color": "rgba(56, 189, 248, 0.25)",
          "align": "left",
          "maxLines": 1,
          "normalizePunctuation": false
        },
        {
          "id": "core_quote",
          "type": "text",
          "binding": "content",
          "x": 100,
          "y": 720,
          "fontSize": 48,
          "fontFamily": "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
          "fontWeight": "800",
          "color": "#ffffff",
          "align": "left",
          "maxWidth": 950,
          "lineHeight": 80,
          "maxBottomY": 1320
        },
        {
          "id": "author_title",
          "type": "text",
          "binding": "topic",
          "flow": true,
          "flowGap": 128,
          "x": 100,
          "y": 1400,
          "fontSize": 36,
          "fontFamily": "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
          "fontWeight": "700",
          "color": "#38bdf8",
          "align": "left",
          "maxWidth": 950,
          "lineHeight": 52,
          "maxLines": 2
        },
        {
          "id": "sub_context",
          "type": "text",
          "binding": "subtext",
          "flow": true,
          "flowGap": 76,
          "x": 100,
          "y": 1480,
          "fontSize": 26,
          "fontFamily": "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
          "fontWeight": "400",
          "color": "#94a3b8",
          "align": "left",
          "maxWidth": 950,
          "lineHeight": 44,
          "maxBottomY": 1790
        },
        {
          "id": "footer_sign",
          "type": "text",
          "binding": "signature",
          "x": 100,
          "y": 1880,
          "fontSize": 30,
          "fontFamily": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          "fontWeight": "600",
          "color": "#64748b",
          "align": "left",
          "maxWidth": 950,
          "maxLines": 1
        }
      ]
    }
  };
}));
