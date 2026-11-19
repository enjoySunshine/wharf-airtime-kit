/**
 * 离线跑项目的真实测试（qunit 用替身，解析器是 src/ 里的真代码）：
 *
 *   node scripts/offline/run-tests.mjs
 */
import {register} from 'node:module';

register('./hooks.mjs', import.meta.url);

const {default: QUnit} = await import('./stubs/qunit.mjs');

await import('../../test/line-stream.test.js');
await import('../../test/parse-stream.test.js');
await import('../../test/parser.test.js');

QUnit.report();
