const { build } = require('esbuild');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const library = require('twitter-text/package.json');
const licenses = [
  ['twitter-text', 'LICENSE'],
  ['twemoji-parser', 'LICENSE.md'],
  ['punycode', 'LICENSE-MIT.txt']
];

(async () => {
  mkdirSync(join(root, 'vendor'), { recursive: true });
  await build({
    absWorkingDir: root,
    entryPoints: ['scripts/twitter-text-entry.js'],
    outfile: 'vendor/twitter-text.js',
    bundle: true,
    minify: true,
    format: 'iife',
    globalName: 'twitterText',
    target: 'es2020',
    legalComments: 'eof',
    banner: { js: `/*! twitter-text ${library.version} | Apache-2.0 | npm run vendor で生成 | THIRD_PARTY_LICENSES.txt を参照 */` },
    footer: { js: 'if (typeof module !== "undefined") module.exports = twitterText;' },
    plugins: [{
      name: 'modern-browser',
      setup(plugin) {
        // Intl.Segmenter対応ブラウザでは不要な旧ブラウザ用polyfillを除く。
        plugin.onResolve({ filter: /^core-js\// }, () => ({ path: 'native-builtins', namespace: 'native-builtins' }));
        plugin.onLoad({ filter: /.*/, namespace: 'native-builtins' }, () => ({ contents: '' }));
      }
    }]
  });
  const notices = licenses.map(([name, file]) => {
    const directory = join(root, 'node_modules', name);
    const version = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')).version;
    return `${name} ${version}\n${'='.repeat(60)}\n${readFileSync(join(directory, file), 'utf8').trim()}`;
  }).join('\n\n');
  writeFileSync(join(root, 'vendor', 'THIRD_PARTY_LICENSES.txt'), `${notices}\n`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
