/*
 * Polyfills para el WebView viejo de los TV box Android (Chrome 66-69, Android 9 sin actualizar).
 * Se carga como script clásico antes de los módulos de la app. Solo define lo que falta.
 */
(function () {
  var g = typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : this;
  // Chrome 71+
  if (typeof globalThis === 'undefined') g.globalThis = g;
  // Chrome 71+
  if (typeof g.queueMicrotask !== 'function') {
    g.queueMicrotask = function (cb) {
      Promise.resolve().then(cb).catch(function (e) {
        setTimeout(function () { throw e; });
      });
    };
  }
  // Chrome 73+
  if (!Object.fromEntries) {
    Object.fromEntries = function (entries) {
      var o = {};
      Array.from(entries, function (kv) { o[kv[0]] = kv[1]; });
      return o;
    };
  }
  // Chrome 76+
  if (!Promise.allSettled) {
    Promise.allSettled = function (items) {
      return Promise.all(Array.from(items, function (p) {
        return Promise.resolve(p).then(
          function (value) { return { status: 'fulfilled', value: value }; },
          function (reason) { return { status: 'rejected', reason: reason }; }
        );
      }));
    };
  }
  // Chrome 85+
  if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function (search, replacement) {
      if (search instanceof RegExp) return this.replace(search, replacement);
      return this.split(String(search)).join(replacement);
    };
  }
  // Chrome 92+
  function at(n) {
    n = Math.trunc(n) || 0;
    if (n < 0) n += this.length;
    return n < 0 || n >= this.length ? undefined : this[n];
  }
  if (!Array.prototype.at) Object.defineProperty(Array.prototype, 'at', { value: at, writable: true, configurable: true });
  if (!String.prototype.at) Object.defineProperty(String.prototype, 'at', { value: at, writable: true, configurable: true });
  // Chrome 93+
  if (!Object.hasOwn) {
    Object.hasOwn = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  }
})();
