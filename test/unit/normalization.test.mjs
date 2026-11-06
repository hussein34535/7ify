import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppInstance } from '../helpers/load-app.mjs';

const { NG } = loadAppInstance();
const { normalizeSearchText, tokenize } = NG;

test('1. Normalization: removes Arabic diacritics, tashkeel, shaddah, and Quranic marks', () => {
  const text = 'تَمَلِّي مَعَاكْ ۖ وَلَوْ حَتَّىٰ بَعِيدْ';
  const norm = normalizeSearchText(text);
  assert.equal(norm, 'تملي معاك ولو حتي بعيد');
});

test('2. Normalization: unifies Arabic alef forms (أ / إ / آ / ٱ -> ا)', () => {
  assert.equal(normalizeSearchText('أحمد'), 'احمد');
  assert.equal(normalizeSearchText('إبراهيم'), 'ابراهيم');
  assert.equal(normalizeSearchText('آمال'), 'امال');
  assert.equal(normalizeSearchText('ٱسم'), 'اسم');
});

test('3. Normalization: unifies yaa / alef maksura (ى -> ي) and taa marbuta (ة -> ه)', () => {
  assert.equal(normalizeSearchText('منى'), 'مني');
  assert.equal(normalizeSearchText('ليلى'), 'ليلي');
  assert.equal(normalizeSearchText('أغنية'), 'اغنيه');
  assert.equal(normalizeSearchText('حفلة'), 'حفله');
});

test('4. Normalization: unifies hamza on waw (ؤ -> و) and nabrah (ئ -> ي)', () => {
  assert.equal(normalizeSearchText('لؤي'), 'لوي');
  assert.equal(normalizeSearchText('فؤاد'), 'فواد');
  assert.equal(normalizeSearchText('شاطئ'), 'شاطي');
  assert.equal(normalizeSearchText('جرائم'), 'جرايم');
});

test('5. Normalization: converts punctuation and symbols into single spaces', () => {
  const raw = 'عمرو دياب - تملي معاك (Official Clip) [2000] #1 / HD!';
  const norm = normalizeSearchText(raw);
  assert.equal(norm, 'عمرو دياب تملي معاك official clip 2000 1 hd');
});

test('6. Normalization: normalizes Latin case to lowercase', () => {
  assert.equal(normalizeSearchText('Tamally Maak AMR DIAB'), 'tamally maak amr diab');
});

test('7. Normalization: normalizes accented Latin characters to base characters', () => {
  assert.equal(normalizeSearchText('Beyoncé & Café'), 'beyonce cafe');
  assert.equal(normalizeSearchText('Mötley Crüe'), 'motley crue');
});

test('8. Tokenize: breaks normalized text into meaningful word tokens', () => {
  const tokens = tokenize('  عمرو دياب   -   تملي   معاك!  ');
  assert.deepEqual([...tokens], ['عمرو', 'دياب', 'تملي', 'معاك']);
});
