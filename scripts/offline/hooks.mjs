/**
 * 离线 ESM 钩子：不装依赖也能跑 src/ 里的真实解析器和 test/ 里的真实测试。
 *
 * - 把 '@videojs/vhs-utils/*'、'qunit'、'sinon' 重定向到 scripts/offline/stubs/
 * - 把 rollup 的 'data-files!expecteds' / 'data-files!manifests' 变成虚拟模块
 * - src/ 与 test/ 下的 .js 按 ESM 加载（package.json 未声明 type: module）
 * - 补上 src/ 里省略扩展名的相对导入
 */
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURES = path.join(ROOT, 'test', 'fixtures', 'integration');

const STUBS = {
  '@videojs/vhs-utils/es/stream.js': 'scripts/offline/stubs/stream.mjs',
  '@videojs/vhs-utils/es/decode-b64-to-uint8-array.js': 'scripts/offline/stubs/decode-b64.mjs',
  'qunit': 'scripts/offline/stubs/qunit.mjs',
  'sinon': 'scripts/offline/stubs/sinon.mjs'
};

const fixtureKey = (file) => file.replace(/\.(js|m3u8)$/, '');

const expectedsSource = async () => {
  const files = (await readdir(FIXTURES)).filter((f) => f.endsWith('.js')).sort();
  const entries = files.map((file) => {
    const key = fixtureKey(file);
    const requirePath = path.join(FIXTURES, file).replace(/\\/g, '/');

    return `${JSON.stringify(key)}: () => require(${JSON.stringify(requirePath)})`;
  });

  return [
    `import {createRequire} from 'node:module';`,
    `const require = createRequire(${JSON.stringify(pathToFileURL(path.join(ROOT, 'scripts', 'offline', 'hooks.mjs')).href)});`,
    `export default {${entries.join(',\n')}};`
  ].join('\n');
};

const manifestsSource = async () => {
  const files = (await readdir(FIXTURES)).filter((f) => f.endsWith('.m3u8')).sort();
  const entries = await Promise.all(files.map(async (file) => {
    const key = fixtureKey(file);
    const text = await readFile(path.join(FIXTURES, file), 'utf8');

    return `${JSON.stringify(key)}: () => (${JSON.stringify(text)})`;
  }));

  return `export default {${entries.join(',\n')}};`;
};

export async function resolve(specifier, context, nextResolve) {
  if (Object.prototype.hasOwnProperty.call(STUBS, specifier)) {
    return {
      url: pathToFileURL(path.join(ROOT, STUBS[specifier])).href,
      shortCircuit: true
    };
  }
  if (specifier === 'data-files!expecteds' || specifier === 'data-files!manifests') {
    return {url: `offline:${specifier}`, shortCircuit: true};
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) &&
      !/\.(mjs|js|json|cjs)$/.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.js`, context);
    } catch (error) {
      return nextResolve(`${specifier}/index.js`, context);
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === 'offline:data-files!expecteds') {
    return {format: 'module', source: await expectedsSource(), shortCircuit: true};
  }
  if (url === 'offline:data-files!manifests') {
    return {format: 'module', source: await manifestsSource(), shortCircuit: true};
  }
  if (url.startsWith('file:')) {
    const filePath = fileURLToPath(url);
    const esmDirs = [
      path.join(ROOT, 'src') + path.sep,
      path.join(ROOT, 'test') + path.sep,
      path.join(ROOT, 'scripts', 'offline') + path.sep
    ];

    if (esmDirs.some((dir) => filePath.startsWith(dir))) {
      return {format: 'module', source: await readFile(filePath, 'utf8'), shortCircuit: true};
    }
  }
  return nextLoad(url, context);
}
