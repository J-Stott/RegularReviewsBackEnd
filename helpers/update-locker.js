class UpdateLocker {
  constructor() {
    this.UpdateMap = new Map();
  }

  exists(key) {
    return this.UpdateMap.has(key);
  }

  add(key) {
    this.UpdateMap.set(key, true);
  }

  remove(key) {
    this.UpdateMap.delete(key);
  }
}

let Locker = new UpdateLocker();

module.exports = Locker;
