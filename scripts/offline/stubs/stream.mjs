/**
 * @videojs/vhs-utils/es/stream.js 的离线替身。
 * 只实现 src/ 里真正用到的接口：on / off / trigger / pipe / push。
 * 语义与 vhs-utils 的 Stream 一致：trigger 同步逐个调用监听者。
 */
export default class Stream {
  constructor() {
    this.listeners_ = {};
  }

  on(type, listener) {
    if (!this.listeners_[type]) {
      this.listeners_[type] = [];
    }
    this.listeners_[type].push(listener);
  }

  off(type, listener) {
    const listeners = this.listeners_[type];

    if (!listeners) {
      return false;
    }
    const index = listeners.indexOf(listener);

    if (index === -1) {
      return false;
    }
    listeners.splice(index, 1);
    return true;
  }

  trigger(type, data) {
    const listeners = this.listeners_[type];

    if (!listeners) {
      return;
    }
    listeners.slice().forEach((listener) => listener.call(this, data));
  }

  pipe(stream) {
    this.on('data', (data) => stream.push(data));
  }

  push(data) {
    this.trigger('data', data);
  }
}
