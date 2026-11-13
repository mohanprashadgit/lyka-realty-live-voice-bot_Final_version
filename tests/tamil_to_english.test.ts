import test from 'node:test';
import assert from 'node:assert/strict';
import { tamilToEnglish } from '../src/utils/tamilToEnglish.ts';
import { observeSalesTurn, nextSalesAction } from '../src/utils/salesConversation.ts';

test('Latin text is not rewritten', () => {
  assert.equal(tamilToEnglish('Satish personal purpose.'), 'Satish personal purpose.');
});

test('spoken Tamil becomes English the matcher already understands', () => {
  assert.equal(tamilToEnglish('நான் பேசுறேன்.'), 'yes.');
  assert.match(tamilToEnglish('இந்தியால இருந்து எக்ஸ்போ.'), /India/i);
  assert.match(tamilToEnglish('இந்தியால இருந்து எக்ஸ்போ.'), /explore/i);
  assert.match(tamilToEnglish('நான் வந்து ப்ரொஃபசரா இருக்கேன்.'), /professor/i);
  assert.match(tamilToEnglish('இல்ல, எனக்கு இத பத்தி ஆல்ரெடி தெரியும். உங்க அட்வர்டைஸ்மென்ட்ல பாத்துருக்கேன்.'), /already know/i);
  assert.match(tamilToEnglish('இல்ல, எனக்கு இத பத்தி ஆல்ரெடி தெரியும். உங்க அட்வர்டைஸ்மென்ட்ல பாத்துருக்கேன்.'), /advertisement/i);
  assert.match(tamilToEnglish('சூட்டபிள் ஆச்சு. லொகேஷன்ஸ் ஆச்சு.'), /suitable/i);
  assert.match(tamilToEnglish('வில்லா வில்லா ப்ராப்பர்ட்டீஸ்'), /villa/i);
  assert.match(tamilToEnglish('ஒரு 25 க்ரோர்ஸ்.'), /25 crore/);
  assert.equal(tamilToEnglish('இம்மediate.'), 'immediate.');
  assert.match(tamilToEnglish('என் பெயர் சதீஷ்'), /my name is Sat/i);
});

test('a Tamil refusal is still a refusal after translation', () => {
  const f = observeSalesTurn({}, 'இல்ல இல்ல வேண்டாம், போனை வச்சிருங்க, எனக்கு இன்ட்ரஸ்ட் இல்ல.');
  assert.equal(f.soft_objection_count, '1');
  assert.equal(nextSalesAction(f).stage, 'objection_handling');
});
