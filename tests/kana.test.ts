import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { generateKana } from '../lib/kanaUtils';

describe('kanaUtils', () => {
  test('generateKana converts hiragana to katakana', () => {
    assert.equal(generateKana('あいうえお'), 'アイウエオ');
    assert.equal(generateKana('がぎぐげご'), 'ガギグゲゴ');
    assert.equal(generateKana('っゃゅょ'), 'ッャュョ');
  });

  test('generateKana normalizes half-width characters', () => {
    assert.equal(generateKana('ｱｲｳｴｵ'), 'アイウエオ');
    assert.equal(generateKana('ｶﾞｷﾞｸﾞｹﾞｺﾞ'), 'ガギグゲゴ');
  });

  test('generateKana preserves kanji and numbers', () => {
    assert.equal(generateKana('漢字123'), '漢字123');
  });

  test('generateKana handles empty or null values safely', () => {
    assert.equal(generateKana(''), '');
    assert.equal(generateKana(undefined as unknown as string), '');
    assert.equal(generateKana(null as unknown as string), '');
  });
});
