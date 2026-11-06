import { writeFileSync } from 'node:fs';

const sr = 22050;
const sec = 2.5;
const n = Math.floor(sr * sec);
const buf = Buffer.alloc(44 + n * 2);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + n * 2, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(sr, 24);
buf.writeUInt32LE(sr * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) {
  const env = 1 - i / n;
  const v = (Math.sin((2 * Math.PI * 440 * i) / sr) * 0.28 + Math.sin((2 * Math.PI * 660 * i) / sr) * 0.1) * env;
  buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
}
writeFileSync('test/tone.wav', buf);
console.log('tone.wav', buf.length, 'bytes');
