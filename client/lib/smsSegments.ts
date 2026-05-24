// SMS encoding + segmentation helper.
//
// GSM-7  -> 160 chars per segment (153 in a multipart concat).
// UCS-2  -> 70  chars per segment (67  in a multipart concat).
//
// We pick GSM-7 if every character is in the GSM 03.38 set, else UCS-2.
// Reference: 3GPP TS 23.038, Telnyx Messaging docs.

const GSM_BASIC = new Set(
  '@\u00a3$\u00a5\u00e8\u00e9\u00f9\u00ec\u00f2\u00c7\n\u00d8\u00f8\r\u00c5\u00e5\u0394_\u03a6\u0393\u039b\u03a9\u03a0\u03a8\u03a3\u0398\u039e\u001b\u00c6\u00e6\u00df\u00c9 !"#\u00a4%&\'()*+,-./0123456789:;<=>?\u00a1ABCDEFGHIJKLMNOPQRSTUVWXYZ\u00c4\u00d6\u00d1\u00dc\u00a7\u00bfabcdefghijklmnopqrstuvwxyz\u00e4\u00f6\u00f1\u00fc\u00e0'.split(''),
);
// GSM-7 extension chars cost 2 characters (escape + char)
const GSM_EXT = new Set('|^\u20ac{}[]~\\'.split(''));

export type SmsEncoding = 'GSM-7' | 'UCS-2';

export interface SmsSegmentInfo {
  encoding: SmsEncoding;
  charCount: number;
  unitCount: number;
  segmentCount: number;
  remainingInSegment: number;
  perSegmentLimit: number;
  emojiOrUnicode: boolean;
}

export function analyzeSms(text: string): SmsSegmentInfo {
  if (!text) {
    return {
      encoding: 'GSM-7',
      charCount: 0,
      unitCount: 0,
      segmentCount: 1,
      remainingInSegment: 160,
      perSegmentLimit: 160,
      emojiOrUnicode: false,
    };
  }

  let gsmOk = true;
  let gsmUnits = 0;
  for (const ch of text) {
    if (GSM_BASIC.has(ch)) {
      gsmUnits += 1;
    } else if (GSM_EXT.has(ch)) {
      gsmUnits += 2;
    } else {
      gsmOk = false;
      break;
    }
  }

  if (gsmOk) {
    const charCount = [...text].length;
    let segmentCount: number;
    let perSegmentLimit: number;
    if (gsmUnits <= 160) {
      segmentCount = 1;
      perSegmentLimit = 160;
    } else {
      segmentCount = Math.ceil(gsmUnits / 153);
      perSegmentLimit = 153;
    }
    const usedInCurrent = gsmUnits - (segmentCount - 1) * perSegmentLimit;
    return {
      encoding: 'GSM-7',
      charCount,
      unitCount: gsmUnits,
      segmentCount,
      remainingInSegment: Math.max(perSegmentLimit - usedInCurrent, 0),
      perSegmentLimit,
      emojiOrUnicode: false,
    };
  }

  const unitCount = text.length; // UTF-16 code units (matches SMPP UCS-2 accounting)
  const charCount = [...text].length;
  let segmentCount: number;
  let perSegmentLimit: number;
  if (unitCount <= 70) {
    segmentCount = 1;
    perSegmentLimit = 70;
  } else {
    segmentCount = Math.ceil(unitCount / 67);
    perSegmentLimit = 67;
  }
  const usedInCurrent = unitCount - (segmentCount - 1) * perSegmentLimit;
  return {
    encoding: 'UCS-2',
    charCount,
    unitCount,
    segmentCount,
    remainingInSegment: Math.max(perSegmentLimit - usedInCurrent, 0),
    perSegmentLimit,
    emojiOrUnicode: true,
  };
}
