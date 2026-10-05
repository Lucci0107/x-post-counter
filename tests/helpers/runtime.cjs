const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const twitterText = require('../../vendor/twitter-text.js');

const html = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf8');
const script = new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1], { filename: 'index.html' });

function createElement() {
  const classes = new Set();
  const listeners = new Map();
  return {
    value: '', textContent: '', className: '', innerHTML: '', hidden: false,
    disabled: false, selectionStart: 0, selectionEnd: 0,
    classList: {
      toggle(name, force) {
        const enabled = force ?? !classes.has(name);
        if (enabled) classes.add(name);
        else classes.delete(name);
        return enabled;
      },
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      contains: name => classes.has(name)
    },
    setAttribute(name, value) { this[name] = value; },
    removeAttribute(name) { delete this[name]; },
    addEventListener: (name, callback) => listeners.set(name, callback),
    dispatch(name) { listeners.get(name)?.({ target: this }); },
    focus() {},
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  };
}

function createRuntime(options = {}) {
  const elements = new Map();
  const storage = new Map(Object.entries(options.savedValues || {}));
  const bindings = {
    Intl, twitterText,
    document: {
      body: createElement(),
      getElementById(id) {
        if (!elements.has(id)) {
          const element = createElement();
          if (id === 'storageNotice') element.hidden = true;
          if (id === 'undoBtn') element.disabled = true;
          elements.set(id, element);
        }
        return elements.get(id);
      }
    },
    navigator: { clipboard: { writeText: async () => {} } },
    window: { isSecureContext: true },
    URL: { createObjectURL: () => 'blob:qa-image', revokeObjectURL() {} },
    localStorage: {
      getItem(key) {
        if (options.failReads) throw new Error('SecurityError');
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        if (options.failWrites) throw new Error('QuotaExceededError');
        storage.set(key, value);
      },
      removeItem(key) {
        if (options.failRemovals) throw new Error('SecurityError');
        storage.delete(key);
      }
    },
    setTimeout: () => 0,
    clearTimeout() {}
  };
  if (options.failAccess) Object.defineProperty(bindings, 'localStorage', { get() { throw new Error('SecurityError'); } });
  const runtime = vm.createContext(bindings);
  script.runInContext(runtime);
  return { runtime, elements, storage };
}

module.exports = { createRuntime, twitterText };
