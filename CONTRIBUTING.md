# 参与 ZeroPoster

感谢你愿意投入时间。这份文档说明如何在不破坏既有排版行为的前提下修改代码。

## 环境

只需要 Node.js 18+，**没有任何运行时或开发依赖**，不需要 `npm install`。

```bash
git clone git@github.com:ixiangqun/ZeroPoster.git
cd ZeroPoster
npm test
```

## 项目的两条硬约束

改动前请先理解这两条，它们解释了大部分看起来「绕」的设计：

1. **`index.html` 必须能通过 `file://` 双击直接运行。**
   浏览器会以 CORS 错误拒绝 `file://` 下的 `fetch()`，所以内置模板被编译进
   `core/Presets.js` 并以 `<script src>` 引入。**不要**为了「更优雅」而把它改回 `fetch()` —
   `test/schema-sync.test.mjs` 会拦住这个改动。

2. **`core/` 下的模块不依赖 DOM（`CanvasCompositor` 除外）。**
   它们只要求传入的 `ctx` 具备 `measureText()`，因此可以在 Node 中直接单测。
   请保持这个性质，不要在排版逻辑里引用 `document` 或 `window`。

## 常用命令

```bash
npm test              # 全部单元测试
npm run test:watch    # 监听模式
npm run check:presets # 校验 core/Presets.js 与 templates/*.json 同步
npm run build:presets # 修改模板后重新编译
npm run serve         # 可选的本地 http 服务器
```

## 修改模板

模板的唯一数据源是 `templates/*.json`。改完后必须运行：

```bash
npm run build:presets
```

否则 CI 会因为 `core/Presets.js` 过期而失败。**不要手改 `core/Presets.js`。**

新增字段时，需要同步三处并让测试通过：

- `schemas/template.schema.json`（协议文档）
- `DesignImporter.validateTemplate()`（运行时校验）
- `test/schema-sync.test.mjs`（断言两者一致）

## 排版改动的要求

排版是这个项目唯一有技术含量的部分，也最容易悄悄回归。任何触及
`core/KinsokuEngine.js` 或 `core/DesignImporter.js` 布局逻辑的 PR，请：

1. **先写一个会失败的测试**，复现你要修的问题。
2. 保证既有的不变量测试仍然通过，尤其是：
   - 行首禁则标点不出现在行首
   - 行尾禁则标点不出现在行尾
   - 不产生空行
   - 竖排不越过 `maxBottomY`
   - 内置模板在超长文案下不出现图层压盖

`test/helpers.mjs` 提供了一个不依赖浏览器的 Canvas 替身，用等宽近似度量
（全角 1 字宽、ASCII 0.5 字宽），足以覆盖布局逻辑。

## 源码卫生

`test/source-hygiene.test.mjs` 会拒绝源码中出现裸控制字符与零宽字符。

这条规则来自一次真实事故：一个裸 NUL 字符混进了导出文件名的正则，把字符类
变成了非法的区间，浏览器直接抛 `SyntaxError`，整个页面白屏。

**控制字符一律写成转义形式**（例如用反斜杠 u 加四位十六进制），
不要把裸字节直接嵌进源文件——它在编辑器和 diff 里都是隐形的。

## 提交规范

- 提交信息使用 `type: 描述`，如 `fix: 竖排文本越过安全区下边界`。
- 一个 PR 只做一件事。
- 涉及视觉变化时，请附上改动前后的截图。
