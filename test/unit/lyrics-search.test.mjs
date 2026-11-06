import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppInstance } from '../helpers/load-app.mjs';

const { NG } = loadAppInstance();
const { findMatchedLyric } = NG;

test('findMatchedLyric matches lyrics with modern { t, text } API schema', () => {
  const track = {
    title: { ar: 'أغنية جديدة', en: 'New Song' },
    lyrics: [
      { t: 0, text: 'في أول السطر هنا' },
      { t: 15.5, text: 'وأنا معاك على طول الطريق' },
      { t: 30, text: 'نهاية المقطع الأول' }
    ]
  };

  const match = findMatchedLyric(track, 'على طول الطريق');
  assert.equal(match, 'وأنا معاك على طول الطريق');
});

test('findMatchedLyric matches legacy multilingual ar and en lyrics', () => {
  const track = {
    title: { ar: 'تملي معاك', en: 'Tamally Maak' },
    lyrics: [
      { t: 0, ar: 'تملي معاك، ولو حتى بعيد عني', en: 'Always with you, even if you are far from me' },
      { t: 15, ar: 'في قلبي هواك، بتمناك ومستنيك', en: 'In my heart is your love, I wish for you and wait for you' }
    ]
  };

  assert.equal(findMatchedLyric(track, 'بعيد عني'), 'تملي معاك، ولو حتى بعيد عني');
  assert.equal(findMatchedLyric(track, 'far from me'), 'تملي معاك، ولو حتى بعيد عني');
});

test('findMatchedLyric matches un-synced plainLyrics text block', () => {
  const track = {
    title: { ar: 'أغنية نصية', en: 'Plain Song' },
    lyrics: [],
    plainLyrics: 'سطر أول في الأغنية\nيا حبيبي كل يوم بفتكرك\nسطر أخير في القصيدة'
  };

  const match = findMatchedLyric(track, 'بفتكرك');
  assert.equal(match, 'يا حبيبي كل يوم بفتكرك');
});

test('findMatchedLyric returns null when no matching words exist', () => {
  const track = {
    title: { ar: 'أغنية هادئة', en: 'Quiet Song' },
    lyrics: [{ t: 0, text: 'كلمات هادئة لا علاقة لها بالاستعلام' }]
  };

  const match = findMatchedLyric(track, 'استعلام مختلف تماماً غير موجود');
  assert.equal(match, null);
});
