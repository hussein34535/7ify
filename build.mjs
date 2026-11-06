/* Build the single-file deliverable: inline CSS + both modules. */
import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src');
const pub = join(here, 'public');
try { mkdirSync(pub, { recursive: true }); } catch {}

const css = readFileSync(join(src, 'app.css'), 'utf8');
const app = readFileSync(join(src, 'app.js'), 'utf8');
const ui = readFileSync(join(src, 'ui.js'), 'utf8');
let html = readFileSync(join(src, 'index.html'), 'utf8');

if (!html.includes('<!--INLINE_STYLE-->') || !html.includes('<!--INLINE_SCRIPTS-->')) {
  throw new Error('Placeholders missing from src/index.html');
}
if (/<\/script/i.test(app + ui)) throw new Error('Script contains a closing script tag');

html = html.replace('<!--INLINE_STYLE-->', () => '<style>\n' + css.trim() + '\n</style>');
html = html.replace('<!--INLINE_SCRIPTS-->', () =>
  '<script>\n' + app.trim() + '\n</script>\n<script>\n' + ui.trim() + '\n</script>');

const out = join(here, 'nagham-studio.html');
writeFileSync(out, html, 'utf8');
writeFileSync(join(here, 'index.html'), html, 'utf8');
writeFileSync(join(pub, 'index.html'), html, 'utf8');
writeFileSync(join(pub, 'nagham-studio.html'), html, 'utf8');
const kb = (statSync(out).size / 1024).toFixed(1);
console.log('built', out, 'and public/index.html', kb + ' KB');
