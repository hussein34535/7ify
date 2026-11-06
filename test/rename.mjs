import { readFileSync, writeFileSync } from 'node:fs';

let a = readFileSync('src/app.js', 'utf8');
a = a.split("motif: 'bars'").join("motif: 'orb'");
a = a.split("['rings', 'bars', 'dots', 'arcs']").join("['rings', 'orb', 'dots', 'arcs']");
writeFileSync('src/app.js', a, 'utf8');

let c = readFileSync('src/app.css', 'utf8');
c = c.split('art-bars').join('art-orb');
writeFileSync('src/app.css', c, 'utf8');
console.log('orb motifs:', (a.match(/motif: 'orb'/g) || []).length, '| css:', (c.match(/art-orb/g) || []).length);
