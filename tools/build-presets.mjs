#!/usr/bin/env node
/**
 * 把 templates/*.json 内联生成 core/Presets.js。
 *
 * 为什么需要这一步：index.html 必须能通过 file:// 双击直接运行，而浏览器会
 * 以 CORS 错误拒绝 file:// 下的 fetch()。<script src> 不受此限制，因此把模板
 * 编译成一个普通脚本，既保持“零后端、双击即用”，又让 templates/*.json 继续
 * 作为唯一可编辑的数据源。
 *
 * 用法：node tools/build-presets.mjs [--check]
 *   --check  只校验产物是否与源文件一致（CI 用），不写盘
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 预设 key -> 模板文件名。key 同时是 index.html 中 data-template 的取值。 */
export const PRESET_FILES = {
  minimal: 'minimal-editorial.json',
  classic: 'classic-cjk.json',
  dark: 'dark-mode-card.json'
};

export function buildPresetsSource() {
  const entries = Object.entries(PRESET_FILES).map(([key, file]) => {
    const raw = readFileSync(join(ROOT, 'templates', file), 'utf8');
    const parsed = JSON.parse(raw);
    const body = JSON.stringify(parsed, null, 2)
      .split('\n')
      .map((line, index) => (index === 0 ? line : '    ' + line))
      .join('\n');
    return `    ${key}: ${body}`;
  });

  return `/**
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
${entries.join(',\n')}
  };
}));
`;
}

const OUTPUT = join(ROOT, 'core', 'Presets.js');

function main() {
  const source = buildPresetsSource();

  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(OUTPUT, 'utf8');
    } catch {
      console.error('core/Presets.js 不存在，请运行 npm run build:presets');
      process.exit(1);
    }
    if (current !== source) {
      console.error('core/Presets.js 与 templates/*.json 不同步，请运行 npm run build:presets');
      process.exit(1);
    }
    console.log('core/Presets.js 与 templates/*.json 同步');
    return;
  }

  writeFileSync(OUTPUT, source, 'utf8');
  console.log('已生成 core/Presets.js（' + Object.keys(PRESET_FILES).length + ' 个预设）');
}

// 仅在作为脚本直接执行时才写盘；被测试 import 时只导出纯函数。
const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  main();
}
