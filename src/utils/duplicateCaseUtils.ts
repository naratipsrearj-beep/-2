import { AppealCase } from '../types/appeal';
import { areCasesLinked } from './linkedCaseUtils';

export type DuplicateFieldType =
  | 'blackCaseNo'
  | 'redCaseNo'
  | 'receivedNumberS1'
  | 'filingNumberS4';

export interface DuplicateFieldMeta {
  field: DuplicateFieldType;
  fieldLabel: string;
  shortLabel: string;
}

export const DUPLICATE_FIELD_META: Record<DuplicateFieldType, DuplicateFieldMeta> = {
  blackCaseNo: {
    field: 'blackCaseNo',
    fieldLabel: 'หมายเลขคดีดำ',
    shortLabel: 'คดีดำ',
  },
  redCaseNo: {
    field: 'redCaseNo',
    fieldLabel: 'หมายเลขคดีแดง',
    shortLabel: 'คดีแดง',
  },
  receivedNumberS1: {
    field: 'receivedNumberS1',
    fieldLabel: 'หมายเลข ส.1',
    shortLabel: 'ส.1',
  },
  filingNumberS4: {
    field: 'filingNumberS4',
    fieldLabel: 'หมายเลข ส.4',
    shortLabel: 'ส.4',
  },
};

export const DUPLICATE_FIELD_ORDER: DuplicateFieldType[] = [
  'blackCaseNo',
  'redCaseNo',
  'receivedNumberS1',
  'filingNumberS4',
];

const THAI_DIGITS_MAP: Record<string, string> = {
  '๐': '0',
  '๑': '1',
  '๒': '2',
  '๓': '3',
  '๔': '4',
  '๕': '5',
  '๖': '6',
  '๗': '7',
  '๘': '8',
  '๙': '9',
};

function toArabicDigits(value: string): string {
  return value.replace(/[๐-๙]/g, (ch) => THAI_DIGITS_MAP[ch] ?? ch);
}

const PLACEHOLDER_TOKENS = new Set([
  '-',
  '--',
  '---',
  '/',
  'ไม่มี',
  'ยังไม่มี',
  'ยังไม่มีเลขแดง',
  'ยังไม่มีเลขดำ',
  'รอกำหนด',
  'รอเลข',
  'รอเลขแดง',
  'n/a',
  'na',
  'none',
  'null',
]);

/**
 * ปรับรูปแบบเลขคดีดำ / เลขคดีแดง เพื่อเทียบความซ้ำซ้อนได้แม่นยำ
 * เช่น "ดำ อ. 124 / 2569" และ "อ.124/2569" -> "อ.124/2569"
 * ยังคงอักษรย่อประเภทคดี (อ., ย., พ., ผบ. ฯลฯ) ไว้ครบถ้วนเพื่อไม่ให้สับสนข้ามประเภทคดี
 */
export function normalizeCaseNoForDuplicate(raw?: string | null): string {
  if (!raw) return '';
  let text = toArabicDigits(raw).trim().toLowerCase();
  if (!text) return '';

  // ตัดคำนำหน้าบรรยายทั่วไปออก แต่คงอักษรย่อคดี (เช่น อ., ย., พ., ผบ.) ไว้
  text = text
    .replace(/^(คดีหมายเลขดำที่|คดีหมายเลขแดงที่|หมายเลขคดีดำที่|หมายเลขคดีแดงที่|หมายเลขคดีดำ|หมายเลขคดีแดง|เลขคดีดำที่|เลขคดีแดงที่|เลขคดีดำ|เลขคดีแดง|คดีดำที่|คดีแดงที่|คดีดำ|คดีแดง|เลขดำที่|เลขแดงที่|เลขดำ|เลขแดง|ดำที่|แดงที่|ดำ|แดง)\s*[:.]?\s*/i, '')
    .replace(/\s+/g, '')
    .replace(/^[:\-]+|[:\-]+$/g, '');

  if (!text || PLACEHOLDER_TOKENS.has(text)) return '';
  if (text.length < 2 || !/\d/.test(text)) return '';
  return text;
}

/**
 * ปรับรูปแบบเลข ส.1 / ส.4 เพื่อเทียบความซ้ำซ้อนได้แม่นยำ
 * เช่น "ส.1 124/2569", "ส.1: 124 / 2569", "124/2569" -> "124/2569"
 */
export function normalizeDocketForDuplicate(raw?: string | null): string {
  if (!raw) return '';
  let text = toArabicDigits(raw).trim().toLowerCase();
  if (!text) return '';

  text = text
    .replace(/สารบบ(รับสำนวน|การยื่นฟ้อง)?/g, '')
    .replace(/(เลขรับ|เลขฟ้อง|หมายเลข|เลขที่)/g, '')
    .replace(/ส\s*\.?\s*[14]/gi, '')
    .replace(/[:\s]+/g, '')
    .replace(/^-+|-+$/g, '');

  if (!text || PLACEHOLDER_TOKENS.has(text)) return '';
  if (text.length < 2 || !/\d/.test(text)) return '';
  return text;
}

export function normalizeFieldForDuplicate(
  field: DuplicateFieldType,
  raw?: string | null
): string {
  if (field === 'blackCaseNo' || field === 'redCaseNo') {
    return normalizeCaseNoForDuplicate(raw);
  }
  return normalizeDocketForDuplicate(raw);
}

export interface DuplicateFieldGroup {
  key: string;
  field: DuplicateFieldType;
  fieldLabel: string;
  shortLabel: string;
  normalizedValue: string;
  displayValue: string;
  cases: AppealCase[];
  isAllLinkedSevered: boolean;
}

export interface DuplicateCheckResult {
  groups: DuplicateFieldGroup[];
  byField: Record<DuplicateFieldType, DuplicateFieldGroup[]>;
  affectedCaseIds: Set<string>;
  caseDuplicateFieldsMap: Map<string, DuplicateFieldGroup[]>;
}

/**
 * ตรวจสอบสำนวนทั้งหมดเพื่อหาหมายเลขคดีดำ, หมายเลขคดีแดง, ส.1 และ ส.4 ที่ซ้ำกัน
 */
export function findDuplicateCases(cases: AppealCase[]): DuplicateCheckResult {
  const buckets: Record<DuplicateFieldType, Map<string, { displayValue: string; cases: AppealCase[] }>> = {
    blackCaseNo: new Map(),
    redCaseNo: new Map(),
    receivedNumberS1: new Map(),
    filingNumberS4: new Map(),
  };

  for (const c of cases) {
    if (!c) continue;
    const entries: Array<[DuplicateFieldType, string | undefined]> = [
      ['blackCaseNo', c.blackCaseNo],
      ['redCaseNo', c.redCaseNo],
      ['receivedNumberS1', c.receivedNumberS1],
      ['filingNumberS4', c.filingNumberS4],
    ];

    for (const [field, rawVal] of entries) {
      const normalized = normalizeFieldForDuplicate(field, rawVal);
      if (!normalized) continue;

      const map = buckets[field];
      const existing = map.get(normalized);
      if (existing) {
        existing.cases.push(c);
      } else {
        map.set(normalized, {
          displayValue: (rawVal || '').trim() || normalized,
          cases: [c],
        });
      }
    }
  }

  const byField: Record<DuplicateFieldType, DuplicateFieldGroup[]> = {
    blackCaseNo: [],
    redCaseNo: [],
    receivedNumberS1: [],
    filingNumberS4: [],
  };

  const groups: DuplicateFieldGroup[] = [];
  const affectedCaseIds = new Set<string>();
  const caseDuplicateFieldsMap = new Map<string, DuplicateFieldGroup[]>();

  for (const field of DUPLICATE_FIELD_ORDER) {
    const meta = DUPLICATE_FIELD_META[field];
    const map = buckets[field];

    const fieldGroups: DuplicateFieldGroup[] = [];
    for (const [normalizedValue, entry] of map.entries()) {
      if (entry.cases.length < 2) continue;

      // เรียงลำดับสำนวนในกลุ่มตามวันที่ฟ้องล่าสุด -> เก่าสุด
      const sortedCases = [...entry.cases].sort((a, b) =>
        (b.filingDate || '').localeCompare(a.filingDate || '')
      );

      // ตรวจสอบว่าสำนวนทั้งหมดในกลุ่มเชื่อมโยงเป็นคดีแยกฟ้องกันหรือไม่ (กรณี ส.1/ส.4 ซ้ำจากการแยกฟ้อง)
      let isAllLinkedSevered = false;
      if (field === 'receivedNumberS1' || field === 'filingNumberS4') {
        const hasSeveredFlag = sortedCases.some(
          (item) =>
            Boolean(item.isSeveredCase) ||
            Boolean(item.severedFromCaseId) ||
            Boolean(item.originalBlackCaseNo) ||
            Boolean(item.hasPendingSeveredFiling)
        );
        if (hasSeveredFlag) {
          isAllLinkedSevered = sortedCases.every((item, idx) =>
            sortedCases.some((other, otherIdx) => idx !== otherIdx && areCasesLinked(item, other))
          );
        }
      }

      const group: DuplicateFieldGroup = {
        key: `${field}:${normalizedValue}`,
        field,
        fieldLabel: meta.fieldLabel,
        shortLabel: meta.shortLabel,
        normalizedValue,
        displayValue: entry.displayValue,
        cases: sortedCases,
        isAllLinkedSevered,
      };

      fieldGroups.push(group);
      for (const item of sortedCases) {
        affectedCaseIds.add(item.id);
        const list = caseDuplicateFieldsMap.get(item.id) || [];
        list.push(group);
        caseDuplicateFieldsMap.set(item.id, list);
      }
    }

    // เรียงกลุ่มที่ซ้ำมากสุดและอัปเดตล่าสุดขึ้นก่อน
    fieldGroups.sort((a, b) => {
      if (b.cases.length !== a.cases.length) return b.cases.length - a.cases.length;
      const latestA = a.cases[0]?.filingDate || '';
      const latestB = b.cases[0]?.filingDate || '';
      return latestB.localeCompare(latestA);
    });

    byField[field] = fieldGroups;
    groups.push(...fieldGroups);
  }

  return {
    groups,
    byField,
    affectedCaseIds,
    caseDuplicateFieldsMap,
  };
}

export interface CandidateDuplicateMatch {
  field: DuplicateFieldType;
  fieldLabel: string;
  shortLabel: string;
  inputValue: string;
  normalizedValue: string;
  matchedCases: AppealCase[];
}

/**
 * ตรวจสอบค่าที่กำลังกรอกในฟอร์มเพิ่ม/แก้ไขสำนวนว่าซ้ำกับสำนวนที่มีอยู่แล้วหรือไม่
 */
export function findCandidateDuplicates(
  candidate: {
    blackCaseNo?: string;
    redCaseNo?: string;
    receivedNumberS1?: string;
    filingNumberS4?: string;
  },
  existingCases: AppealCase[],
  excludeCaseId?: string
): CandidateDuplicateMatch[] {
  if (!existingCases || existingCases.length === 0) return [];

  const matches: CandidateDuplicateMatch[] = [];

  for (const field of DUPLICATE_FIELD_ORDER) {
    const rawInput = candidate[field];
    const normalizedInput = normalizeFieldForDuplicate(field, rawInput);
    if (!normalizedInput) continue;

    const matchedCases = existingCases.filter((c) => {
      if (!c || (excludeCaseId && c.id === excludeCaseId)) return false;
      const existingNormalized = normalizeFieldForDuplicate(field, c[field]);
      return Boolean(existingNormalized && existingNormalized === normalizedInput);
    });

    if (matchedCases.length > 0) {
      const meta = DUPLICATE_FIELD_META[field];
      matches.push({
        field,
        fieldLabel: meta.fieldLabel,
        shortLabel: meta.shortLabel,
        inputValue: (rawInput || '').trim(),
        normalizedValue: normalizedInput,
        matchedCases,
      });
    }
  }

  return matches;
}
