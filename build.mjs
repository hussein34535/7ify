/* Build the single-file deliverables: inline CSS + both modules. */
import { readFileSync, writeFileSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src');
const pub = join(here, 'public');
try { mkdirSync(pub, { recursive: true }); } catch {}

const css = readFileSync(join(src, 'app.css'), 'utf8');
const app = readFileSync(join(src, 'app.js'), 'utf8');
const ui = readFileSync(join(src, 'ui.js'), 'utf8');

if (/<\/script/i.test(app + ui)) throw new Error('Script contains a closing script tag');

// 1. Build Desktop Nagham Studio (nagham-studio.html)
const studioPath = existsSync(join(src, 'studio.html')) ? join(src, 'studio.html') : join(src, 'index.html');
let studioHtml = readFileSync(studioPath, 'utf8');
if (studioHtml.includes('<!--INLINE_STYLE-->')) {
  studioHtml = studioHtml.replace('<!--INLINE_STYLE-->', () => '<style>\n' + css.trim() + '\n</style>');
}
if (studioHtml.includes('<!--INLINE_SCRIPTS-->')) {
  studioHtml = studioHtml.replace('<!--INLINE_SCRIPTS-->', () =>
    '<script>\n' + app.trim() + '\n</script>\n<script>\n' + ui.trim() + '\n</script>');
}
const studioOut = join(here, 'nagham-studio.html');
writeFileSync(studioOut, studioHtml, 'utf8');
writeFileSync(join(pub, 'nagham-studio.html'), studioHtml, 'utf8');

// 2. Build Mobile Spotify iOS (index.html & public/index.html)
let mobileHtml = readFileSync(join(src, 'index.html'), 'utf8');
if (mobileHtml.includes('<!--INLINE_STYLE-->')) {
  mobileHtml = mobileHtml.replace('<!--INLINE_STYLE-->', '');
}
if (mobileHtml.includes('<!--INLINE_SCRIPTS-->')) {
  mobileHtml = mobileHtml.replace('<!--INLINE_SCRIPTS-->', '');
}
const indexOut = join(here, 'index.html');
writeFileSync(indexOut, mobileHtml, 'utf8');
writeFileSync(join(pub, 'index.html'), mobileHtml, 'utf8');

const kbStudio = (statSync(studioOut).size / 1024).toFixed(1);
const kbIndex = (statSync(indexOut).size / 1024).toFixed(1);
console.log('built nagham-studio.html (' + kbStudio + ' KB) and index.html (' + kbIndex + ' KB)');
