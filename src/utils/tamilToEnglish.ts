/**
 * Spoken Tamil → English for the sales matcher.
 * Runs in this process. No network call, so the live turn does not wait.
 * Unknown Tamil is left as-is so existing Tamil refusal rules still see it.
 * Only the name that follows "my name is" is transliterated.
 */

const PHRASES: [string, string][] = [
  ['இல்ல இல்ல வேண்டாம், போனை வச்சிருங்க, எனக்கு இன்ட்ரஸ்ட் இல்ல.', 'not interested, hang up the call'],
  ['இல்லங்க, எனக்கு இதெல்லாம் வேணாம்.', 'I am not interested'],
  ['வேணாம் call cut பண்ணுங்க.', 'not interested, hang up the call'],
  ['வேணாம்னு சொல்லிட்டேன் இல்ல.', 'I already said no'],
  ['எனக்கு இத பத்தி ஆல்ரெடி தெரியும்', 'I already know this'],
  ['ஆல்ரெடி தெரியும்', 'I already know'],
  ['ஏற்கனவே தெரியும்', 'I already know'],
  ['அட்வர்டைஸ்மென்ட்ல', 'advertisement'],
  ['அட்வர்டைஸ்மென்ட்', 'advertisement'],
  ['விளம்பரத்துல', 'advertisement'],
  ['விளம்பரம்', 'advertisement'],
  ['நான் பேசுறேன்', 'yes'],
  ['நான் பேசுவேன்', 'yes'],
  ['நான் வந்து', 'I am'],
  ['என்னோட பெயர்', 'my name is'],
  ['என் பெயர்', 'my name is'],
  ['என் பேரு', 'my name is'],
  ['அகாடமிஷியன்', 'academician'],
  ['ப்ரொஃபசரா', 'professor'],
  ['ப்ரொஃபசர்', 'professor'],
  ['ப்ரொபசரா', 'professor'],
  ['புரொபசரா', 'professor'],
  ['பேராசிரியர்', 'professor'],
  ['இந்தியால', 'from India'],
  ['இந்தியா', 'India'],
  ['இருந்து', 'from'],
  ['எக்ஸ்ப்ளோர்', 'explore'],
  ['எக்ஸ்போ', 'explore'],
  ['சூட்டபிள்', 'suitable'],
  ['லொகேஷன்ஸ்', 'locations'],
  ['லொகேஷன்', 'location'],
  ['ப்ராப்பர்ட்டீஸ்', 'properties'],
  ['ப்ராப்பர்ட்டி', 'property'],
  ['வில்லா', 'villa'],
  ['மில்லியன்', 'million'],
  ['க்ரோர்ஸ்', 'crore'],
  ['க்ரோர்', 'crore'],
  ['கோடி', 'crore'],
  ['லட்சம்', 'lakh'],
  ['திர்ஹாம்', 'dirham'],
  ['ரூபாய்', 'rupees'],
  ['பேமெண்ட்', 'payment'],
  ['இம்மீடியேட்', 'immediate'],
  ['இம்மீடியட்', 'immediate'],
  ['இம்மediate', 'immediate'],
  ['சொந்தவூர்', 'sontha ooru'],
  ['சொந்த ஊர்', 'sontha ooru'],
  ['குடும்பத்துல', 'family'],
  ['குடும்பம்', 'family'],
  ['கோயம்புத்தூர்', 'Coimbatore'],
  ['திருநெல்வேலி', 'Tirunelveli'],
  ['தூத்துக்குடி', 'Thoothukudi'],
  ['பெங்களூர்', 'Bangalore'],
  ['சென்னை', 'Chennai'],
  ['மதுரை', 'Madurai'],
  ['திருச்சி', 'Trichy'],
  ['மும்பை', 'Mumbai'],
  ['டெல்லி', 'Delhi'],
  ['சேலம்', 'Salem'],
  ['பேசுறேங்க', 'yes'],
  ['பேசுறேன்', 'yes'],
  ['பேசுங்கள்', 'yes'],
  ['பேசுங்க', 'yes'],
  ['சொல்லுங்கள்', 'yes'],
  ['சொல்லுங்க', 'yes'],
  ['ஆ சரி', 'yes'],
  ['ஆமாம்', 'yes'],
  ['ஆமா', 'yes'],
  ['ஓகே', 'okay'],
  ['ஏஇடி', 'AED'],
  ['ஏஈடி', 'AED'],
  ['ஃULL', 'full'],
  ['ஃull', 'full'],
  ['ஃபுல்', 'full'],
  ['ஒரு டூ', '1 to'],
  ['ஒரு to', '1 to'],
];

const CONS: Record<string, string> = {
  க: 'k', ங: 'ng', ச: 's', ஞ: 'nj', ட: 't', ண: 'n', த: 'th', ந: 'n',
  ப: 'p', ம: 'm', ய: 'y', ர: 'r', ல: 'l', வ: 'v', ழ: 'zh', ள: 'l',
  ற: 'r', ன: 'n', ஜ: 'j', ஷ: 'sh', ஸ: 's', ஹ: 'h',
};
const VOWELS: Record<string, string> = {
  அ: 'a', ஆ: 'aa', இ: 'i', ஈ: 'ee', உ: 'u', ஊ: 'oo', எ: 'e', ஏ: 'ae', ஐ: 'ai', ஒ: 'o', ஓ: 'o', ஔ: 'au',
};
const SIGNS: Record<string, string> = {
  '\u0BBE': 'aa', '\u0BBF': 'i', '\u0BC0': 'ee', '\u0BC1': 'u', '\u0BC2': 'oo',
  '\u0BC6': 'e', '\u0BC7': 'ae', '\u0BC8': 'ai', '\u0BCA': 'o', '\u0BCB': 'o', '\u0BCC': 'au',
};

function transliterateName(name: string): string {
  let out = '';
  const chars = [...name];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const next = chars[i + 1];
    if (CONS[c]) {
      if (next === '\u0BCD') { out += CONS[c]; i++; }
      else if (next && SIGNS[next]) { out += CONS[c] + SIGNS[next]; i++; }
      else out += CONS[c] + 'a';
    } else if (VOWELS[c]) out += VOWELS[c];
    else if (c === 'ஃ') out += 'f';
    else out += c;
  }
  const word = out.replace(/[^a-z]/gi, '');
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : name;
}

export function tamilToEnglish(raw: string): string {
  if (!raw || !/[\u0B80-\u0BFF]/.test(raw)) return raw;
  let text = raw;
  for (const [tamil, english] of PHRASES) {
    if (text.includes(tamil)) text = text.split(tamil).join(english);
  }
  text = text.replace(/ஒரு\s+(?=\d)/gu, '');
  text = text.replace(/my name is\s+([\u0B80-\u0BFF]+)/gu, (_all, name: string) => `my name is ${transliterateName(name)}`);
  return text.replace(/[ ]{2,}/g, ' ').trim();
}
