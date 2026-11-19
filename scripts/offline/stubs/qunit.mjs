/**
 * qunit 的离线替身：实现 test/ 里用到的 QUnit.module / QUnit.test /
 * QUnit.dump 与断言（ok、notOk、equal、strictEqual、notStrictEqual、
 * deepEqual、expect）。测试在 import 时同步执行，最后由 report() 汇总。
 */
import {isDeepStrictEqual} from 'node:util';
import {inspect} from 'node:util';

const state = {
  pass: 0,
  fail: 0,
  assertions: 0
};

// 回调形式的模块栈（QUnit.module(name, fn)）
const frames = [];
// 非回调形式的当前模块（QUnit.module(name) / QUnit.module(name, hooks)）
let openModule = null;

const activeModules = () => (openModule ? frames.concat([openModule]) : frames.slice());

class Assert {
  constructor(testName) {
    this.testName = testName;
    this.count = 0;
    this.expected = null;
    this.failures = [];
  }

  record_(pass, op, actual, expected, message) {
    this.count++;
    state.assertions++;
    if (!pass) {
      this.failures.push({op, actual, expected, message});
    }
  }

  ok(actual, message) {
    this.record_(!!actual, 'ok', actual, true, message);
  }

  notOk(actual, message) {
    this.record_(!actual, 'notOk', actual, false, message);
  }

  equal(actual, expected, message) {
    // eslint-disable-next-line eqeqeq
    this.record_(actual == expected, 'equal', actual, expected, message);
  }

  strictEqual(actual, expected, message) {
    this.record_(actual === expected, 'strictEqual', actual, expected, message);
  }

  notStrictEqual(actual, expected, message) {
    this.record_(actual !== expected, 'notStrictEqual', actual, expected, message);
  }

  deepEqual(actual, expected, message) {
    this.record_(isDeepStrictEqual(actual, expected), 'deepEqual', actual, expected, message);
  }

  expect(n) {
    this.expected = n;
  }

  verifyExpect_() {
    if (this.expected !== null && this.expected !== this.count) {
      this.failures.push({
        op: 'expect',
        actual: this.count,
        expected: this.expected,
        message: `expected ${this.expected} assertions, ran ${this.count}`
      });
    }
  }
}

const runTest = (name, fn) => {
  const modules = activeModules();
  const fullName = modules.map((m) => m.name).concat([name]).join(' > ');
  const context = {};
  const assert = new Assert(fullName);

  try {
    modules.forEach((mod) => {
      mod.beforeEach.forEach((beforeEach) => beforeEach.call(context));
    });
    fn.call(context, assert);
    assert.verifyExpect_();
  } catch (error) {
    assert.failures.push({op: 'throw', actual: error, expected: null, message: 'test threw'});
  }

  if (assert.failures.length === 0) {
    state.pass++;
    console.log(`ok ${fullName}`);
    return;
  }

  state.fail++;
  console.log(`not ok ${fullName}`);
  assert.failures.forEach((failure) => {
    console.log(`  ${failure.op}: ${failure.message || ''}`);
    console.log(`    actual:   ${inspect(failure.actual, {depth: 8, maxArrayLength: 20})}`);
    console.log(`    expected: ${inspect(failure.expected, {depth: 8, maxArrayLength: 20})}`);
  });
};

const parseModuleArgs = (arg, arg2) => {
  const mod = {beforeEach: []};
  let fn = null;

  if (typeof arg === 'function') {
    fn = arg;
  } else if (arg && typeof arg === 'object') {
    if (typeof arg.beforeEach === 'function') {
      mod.beforeEach.push(arg.beforeEach);
    }
  }
  if (typeof arg2 === 'function') {
    fn = arg2;
  }
  return {mod, fn};
};

const QUnit = {
  dump: {maxDepth: 3},

  module(name, arg, arg2) {
    const {mod, fn} = parseModuleArgs(arg, arg2);

    mod.name = name;

    if (fn) {
      const savedOpen = openModule;

      openModule = null;
      frames.push(mod);
      fn({
        beforeEach(beforeEachFn) {
          mod.beforeEach.push(beforeEachFn);
        }
      });
      frames.pop();
      openModule = savedOpen;
      return;
    }
    openModule = mod;
  },

  test(name, fn) {
    runTest(name, fn);
  },

  report() {
    console.log(`\n${state.pass} passed, ${state.fail} failed, ${state.assertions} assertions`);
    if (state.fail > 0) {
      process.exitCode = 1;
    }
  }
};

export default QUnit;
