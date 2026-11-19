/**
 * sinon 的离线替身：只实现测试里用到的 spy。
 */
export function spy(fn) {
  const calls = [];

  const spied = function(...args) {
    calls.push({args, thisValue: this});
    if (fn) {
      return fn.apply(this, args);
    }
  };

  Object.defineProperty(spied, 'called', {get: () => calls.length > 0});
  Object.defineProperty(spied, 'callCount', {get: () => calls.length});
  spied.getCall = (index) => calls[index];

  return spied;
}

export default {spy};
