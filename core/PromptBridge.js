/**
 * PromptBridge.js
 * 纯反向 AI 提示词引擎：将卡片元数据动态转化为单反写实无字 Prompt
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PromptBridge = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  const CAMERAS = [
    'Hasselblad X2D 100C, 90mm f/2.5 lens',
    'Leica M11-P, Summilux-M 35mm f/1.4 ASPH',
    'Sony A7R V, FE 90mm f/2.8 Macro G OSS'
  ];

  const NEGATIVE_CONSTRAINTS = 'STRICT NEGATIVE: no text, no characters, no watermark, no typography, no logo, no labels, no artificial plastic look, no 3D render, no CGI, no drawing, no illustration, pure optical raw photography.';

  /**
   * 8 大场景模态自适应映射
   */
  const SCENE_MODES = {
    macro: {
      name: '微距材质 / 静物特写',
      promptTpl: (subject) => `Commercial award-winning macro photograph of ${subject}, ultra-crisp material texture, natural light beam illuminating surface details, optical depth of field f/2.2, soft natural bokeh background, editorial magazine grade.`
    },
    craft: {
      name: '人文纪实 / 手作匠心',
      promptTpl: (subject) => `National Geographic documentary portrait of veteran artisan hands working on ${subject}, weathered skin texture, vintage handmade iron tools, fine raw shavings, side atmospheric warm sunlight, authentic candid moment.`
    },
    zen: {
      name: '东方禅意 / 案头雅集',
      promptTpl: (subject) => `Atmospheric minimalist Zen interior with ${subject}, delicate wisps of natural translucent incense smoke rising in calm morning air, soft shadows through bamboo blinds, rustic linen mat, wabi-sabi stillness.`
    },
    nature: {
      name: '自然生境 / 古树林野',
      promptTpl: (subject) => `Early morning misty landscape featuring authentic wild ${subject}, dense wet forest atmosphere, soft volumetric god rays through canopies, dewy leaves, 8k realistic botanical photography.`
    },
    interior: {
      name: '文房空间 / 现代生活',
      promptTpl: (subject) => `Architectural Digest photography of a serene modern study desk featuring ${subject}, smooth warm walnut table, soft ambient daylight from floor-to-ceiling window, quiet aesthetic life.`
    },
    tech: {
      name: '现代极客 / 冷调先锋',
      promptTpl: (subject) => `Minimalist industrial product photography of ${subject}, brushed anodized aluminum surface, crisp directional studio rim lighting, matte dark graphite environment, razor-sharp focus.`
    }
  };

  class PromptGenerator {
    /**
     * 根据主题、意象与场景模式自动装配一体化提示词
     */
    static buildPrompt({ topic = '', visual = '', mode = 'macro', cameraIndex = 0 }) {
      const selectedMode = SCENE_MODES[mode] || SCENE_MODES.macro;
      const camera = CAMERAS[cameraIndex % CAMERAS.length];
      const subjectDesc = visual || topic || 'a quiet serene artistic object';

      const coreScene = selectedMode.promptTpl(subjectDesc);

      // 组装一体化写实提示词（适用于豆包、Midjourney、即梦、FLUX）
      return `${coreScene}, shot on ${camera}, 1/250s, ISO 100, photorealistic RAW format, neutral film grain, masterwork composition, 9:16 vertical ratio. --ar 9:16 [${NEGATIVE_CONSTRAINTS}]`;
    }

    /**
     * 获取所有支持的场景模式列表
     */
    static getModes() {
      return Object.entries(SCENE_MODES).map(([key, val]) => ({
        key,
        name: val.name
      }));
    }
  }

  return PromptGenerator;
}));

