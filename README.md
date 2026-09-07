# ZeroPoster

> **Zero-backend, Zero-API-cost, AI-prompt-coupled client-side poster engine with native CJK Kinsoku Shori typography.**  
> 面向 AI 创作者与企业的纯客户端高保真排版与海报合成引擎。

---

## 一、 为什么存在 ZeroPoster？

在内容生产与营销视觉领域，创作者长期面临一个**三元悖论**：
1. **直接用 AI 生成海报**：文字严重畸变、错别字多、标点乱跳，完全无法满足商业排版与品牌规范。
2. **人工美工逐张排版**：制作单张成本 50~200 元，批量产出 30~60 天内容周期过长。
3. **传统在线设计 SaaS / 截图后端**：依赖高配无头浏览器（Puppeteer）或付费 API，服务器运维昂贵且有网络排队延迟。

**ZeroPoster 采用“分层解耦混合渲染范式”（Decoupled Layered Rendering Paradigm）刺破这一僵局：**
- **AI 只做顶级摄影师**：输出纯净无字的极致写实材质底图。
- **Canvas 代码做艺术总监**：在用户本地显卡上以 60fps 实时执行国家标准 GB/T 15834 汉字避头尾算法、金石竖排与品牌排印。
- **零后端、零 API 账单、零跨域污染**：完全基于 HTML5 纯前端单文件运行，双击即用。

---

## 二、 核心架构图

```
┌─────────────────────────────────────────────────────────────┐
│                       ZeroPoster 引擎                       │
├─────────────────────────────────────────────────────────────┤
│  1. 视觉资产输入层 (Visual Layer)                            │
│     ├── 本地文件流 (FileReader Base64 / 零跨域污染)          │
│     └── AI 提示词桥接器 (PromptBridge: 单反无字 RAW 提示词)   │
├─────────────────────────────────────────────────────────────┤
│  2. 外部设计导入层 (Design Importer)                        │
│     ├── SVG 语义插槽解析 (DOMParser 动态节点替换)            │
│     └── JSON 标准模板规范 (template.schema.json)            │
├─────────────────────────────────────────────────────────────┤
│  3. 工业级排印中枢 (Typography Engine)                       │
│     ├── GB/T 15834 中文避头尾 (Kinsoku Shori)              │
│     ├── 标点悬挂 (Hanging Punctuation)                      │
│     └── 金石竖排安全区高度碰撞拦截                           │
├─────────────────────────────────────────────────────────────┤
│  4. 交互与渲染导出中枢 (Canvas Compositor)                   │
│     ├── 单指触控 / 鼠标平移与滚轮双向缩放 (30% ~ 250%)       │
│     ├── 动态视口矩阵计算 (getBoundingClientRect)            │
│     └── 1152 × 2048 打印级高清 JPEG 本地瞬时导出             │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、 工程模块清单

| 文件路径 | 模块说明 | 核心特性 |
|---|---|---|
| `core/KinsokuEngine.js` | 汉字避头尾与标点排版引擎 | 遵循 GB/T 15834 规范，彻底消除行首行尾禁则标点，支持安全金石双列竖排。 |
| `core/CanvasCompositor.js` | 画布合成与交互中枢 | 支持触屏拖拽、鼠标滚轮缩放，FileReader 规避跨域画布污染，物理锁死高清分辨率。 |
| `core/DesignImporter.js` | 外部设计模板解析器 | 支持导入 Figma/Illustrator 导出的语义化 SVG，或导入 JSON 模板规范。 |
| `core/PromptBridge.js` | AI 摄影提示词生成器 | 自动生成包含微距景深、哈苏/徕卡光学参数及强负向无字约束的 Prompt。 |
| `schemas/template.schema.json` | 模板规范协议 | 定义图层坐标、字号、颜色、渐变与动态数据绑定的标准 JSON Schema。 |
| `templates/` | 官方预置多风格模板库 | 内置极简大片版、金石宋韵版、极客暗黑版。 |
| `sample-design.svg` | 外部设计导入样例 | 展示如何通过带有 `id="field_xxx"` 的 SVG 直接接管排版。 |
| `index.html` | 生产级工作台界面 | 零外部构建依赖，支持移动端自适应与桌面端全功能。 |

---

## 四、 外部设计如何导入？

ZeroPoster 支持直接读取外部设计师交付的矢量图稿或配置：

### 方式 A：SVG 语义插槽导入（推荐）
1. 设计师在 Figma、Illustrator 或 Sketch 中完成设计排版。
2. 将需要动态替换的图层 ID 命名为对应字段：
   - `id="field_number"`：期号或上标
   - `id="field_topic"`：核心标题
   - `id="field_content"`：长正文内容
   - `id="field_greeting"`：结尾金句
   - `id="field_signature"`：品牌署名
3. 导出为标准 `.svg` 文件。
4. 在 ZeroPoster 界面点击 **“📂 导入外部设计”**，选择该 `.svg` 文件，引擎自动解析插槽并渲染。

### 方式 B：JSON 模板协议导入
编写符合 `schemas/template.schema.json` 的 JSON 文件，定义各图层类型（`text`, `gradient`, `line`, `rect`）与坐标，点击导入即可实时预览。

---

## 五、 快速开始

1. **直接运行**：
   无需安装 Node.js、无需运行 `npm install`。直接用任意浏览器（Chrome / Edge / Safari）双击打开 `index.html`。
2. **移动端支持**：
   在手机浏览器或微信中打开同样自适应，支持单指滑动调节底图位置，底部吸附半透明操作栏。
3. **一键导出**：
   调整好底图与文案后，点击右上角（或手机底部）**“📥 导出 1152×2048 高清海报”**，浏览器即刻保存打印级 JPEG。

---

## 六、 开源许可证

本项目采用 [MIT License](LICENSE) 开源协议。
商业使用友好，无任何隐藏限制。
