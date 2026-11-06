/* Recover source modules from the last good single-file build. */
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('nagham-studio.html', 'utf8');
const style = html.match(/<style>\n([\s\S]*?)\n<\/style>/);
const scripts = [...html.matchAll(/<script>\n([\s\S]*?)\n<\/script>/g)].map((m) => m[1]);
if (!style || scripts.length !== 2) throw new Error('unexpected build shape: ' + scripts.length);

writeFileSync('src/app.css', style[1].trim() + '\n', 'utf8');
writeFileSync('src/app.js', scripts[0].trim() + '\n', 'utf8');
writeFileSync('src/ui.js', scripts[1].trim() + '\n', 'utf8');

const check = scripts[0].includes('ليالي القاهرة') && scripts[1].includes('الأغاني المعجب بها');
console.log('extracted css/js; arabic intact =', check, '| js chars', scripts[0].length, scripts[1].length);
