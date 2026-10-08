import { AppealCase } from '../types/appeal';
import { formatThaiDate } from './dateUtils';

/**
 * ตัดคำนำหน้า ส.1 / ส.4 และช่องว่าง เพื่อให้เปรียบเทียบเลขสารบบได้แม่นยำ
 * เช่น "ส.1 124/2569", "124/2569", "ส.1  124 / 2569" -> "124/2569"
 */
export function cleanDocketNumber(num?: string | null): string {
  if (!num) return '';
  const cleaned = num
    .replace(/สารบบ(รับสำนวน|การยื่นฟ้อง)?/g, '')
    .replace(/ส\s*\.?\s*[14]/gi, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
  if (cleaned === '-' || cleaned === '/' || cleaned.length < 2) return '';
  return cleaned;
}

/**
 * ทำความสะอาดเลขคดีดำ เช่น "อ. 120/2569", "อ.120/2569" -> "อ.120/2569"
 */
export function cleanBlackCaseNo(no?: string | null): string {
  if (!no) return '';
  return no.replace(/\s+/g, '').trim().toLowerCase();
}

/**
 * ตรวจสอบว่าคดี c1 และ c2 มีความเชื่อมโยงกันหรือไม่
 * ความเชื่อมโยงของสำนวนที่ศาลสั่งแยกฟ้อง:
 * 1. มีการระบุ severedFromCaseId ตรงกับ id ของอีกสำนวน
 * 2. มีการระบุ originalBlackCaseNo ตรงกับ blackCaseNo ของอีกสำนวน
 * 3. มี originalBlackCaseNo เดียวกัน (ทั้งสองสำนวนถูกแยกฟ้องมาจากคดีดำต้นทางเดียวกัน)
 * 4. สำนวนใดสำนวนหนึ่งเป็นสำนวนแยกฟ้อง และใช้เลขรับ ส.1 (receivedNumberS1) เดียวกัน
 * 5. สำนวนใดสำนวนหนึ่งเป็นสำนวนแยกฟ้อง และใช้เลขฟ้อง ส.4 (filingNumberS4) เดียวกัน
 * 6. ทั้งสองสำนวนมีเลข ส.1 และ ส.4 คู่เดียวกันตรงกัน
 */
export function areCasesLinked(c1: AppealCase, c2: AppealCase): boolean {
  if (!c1 || !c2 || c1.id === c2.id) return false;

  // 1. Direct ID link
  if (c1.severedFromCaseId && c1.severedFromCaseId === c2.id) return true;
  if (c2.severedFromCaseId && c2.severedFromCaseId === c1.id) return true;

  // 2. Original Black Case No link
  const c1Black = cleanBlackCaseNo(c1.blackCaseNo);
  const c2Black = cleanBlackCaseNo(c2.blackCaseNo);
  const c1OrigBlack = cleanBlackCaseNo(c1.originalBlackCaseNo);
  const c2OrigBlack = cleanBlackCaseNo(c2.originalBlackCaseNo);

  if (c1OrigBlack && c1Black && c1OrigBlack === c2Black) return true;
  if (c2OrigBlack && c2Black && c2OrigBlack === c1Black) return true;
  if (c1OrigBlack && c2OrigBlack && c1OrigBlack === c2OrigBlack) return true;

  // 3. Shared ส.1 (receivedNumberS1)
  const c1S1 = cleanDocketNumber(c1.receivedNumberS1);
  const c2S1 = cleanDocketNumber(c2.receivedNumberS1);
  const c1OrigS1 = cleanDocketNumber(c1.originalReceivedNumberS1);
  const c2OrigS1 = cleanDocketNumber(c2.originalReceivedNumberS1);

  // 4. Shared ส.4 (filingNumberS4)
  const c1S4 = cleanDocketNumber(c1.filingNumberS4);
  const c2S4 = cleanDocketNumber(c2.filingNumberS4);
  const c1OrigS4 = cleanDocketNumber(c1.originalFilingNumberS4);
  const c2OrigS4 = cleanDocketNumber(c2.originalFilingNumberS4);

  // ทั้งสองสำนวนมีคู่เลข ส.1 และ ส.4 เดียวกันตรงกัน
  if (c1S1 && c2S1 && c1S1 === c2S1 && c1S4 && c2S4 && c1S4 === c2S4) {
    return true;
  }

  // สำนวนใดสำนวนหนึ่งมีสถานะเป็นสำนวนที่ศาลแยกฟ้อง
  const isC1Severed = Boolean(c1.isSeveredCase || c1.originalBlackCaseNo || c1.severedFromCaseId);
  const isC2Severed = Boolean(c2.isSeveredCase || c2.originalBlackCaseNo || c2.severedFromCaseId);

  if (isC1Severed || isC2Severed) {
    // Shared ส.1
    if (c1S1 && c2S1 && c1S1 === c2S1) return true;
    if (c1OrigS1 && c2S1 && c1OrigS1 === c2S1) return true;
    if (c2OrigS1 && c1S1 && c2OrigS1 === c1S1) return true;

    // Shared ส.4
    if (c1S4 && c2S4 && c1S4 === c2S4) return true;
    if (c1OrigS4 && c2S4 && c1OrigS4 === c2S4) return true;
    if (c2OrigS4 && c1S4 && c2OrigS4 === c1S4) return true;
  }

  return false;
}

/**
 * ดึงรายการสำนวนคดีทั้งหมดที่เชื่อมโยงกับ targetCase
 */
export function getLinkedCases(targetCase: AppealCase, allCases: AppealCase[]): AppealCase[] {
  if (!targetCase || !allCases || allCases.length === 0) return [];
  return allCases.filter((c) => areCasesLinked(targetCase, c));
}

/**
 * สร้าง Map แคชสำหรับดึงสำนวนที่เชื่อมโยงกันอย่างรวดเร็ว (O(N^2) ครั้งเดียว แล้ว lookup O(1))
 */
export function buildLinkedCasesMap(allCases: AppealCase[]): Map<string, AppealCase[]> {
  const map = new Map<string, AppealCase[]>();
  if (!allCases) return map;

  for (let i = 0; i < allCases.length; i++) {
    const c1 = allCases[i];
    const linked: AppealCase[] = [];
    for (let j = 0; j < allCases.length; j++) {
      if (i === j) continue;
      const c2 = allCases[j];
      if (areCasesLinked(c1, c2)) {
        linked.push(c2);
      }
    }
    map.set(c1.id, linked);
  }
  return map;
}

/**
 * ฟังก์ชันตรวจสอบความตรงกันของข้อความค้นหากับสำนวนคดี
 */
export function baseCaseMatcher(c: AppealCase, query: string): boolean {
  if (!query || !query.trim()) return true;
  const term = query.toLowerCase().trim();

  // 1. ค้นหาหมวด "แยกฟ้อง" / "ศาลแยกฟ้อง"
  if (term.includes('แยกฟ้อง') || term.includes('ศาลแยก')) {
    if (
      c.isSeveredCase ||
      Boolean(c.severedFromCaseId) ||
      Boolean(c.originalBlackCaseNo) ||
      (c.severedNotes && c.severedNotes.toLowerCase().includes(term))
    ) {
      return true;
    }
  }

  // 2. ลบคำนำหน้าการค้นหาภาษาพูด
  const cleanTerm = term
    .replace(/ค้นหา/g, '')
    .replace(/คดีดำ/g, '')
    .replace(/คดีแดง/g, '')
    .replace(/ส\.1/g, '')
    .replace(/ส\.4/g, '')
    .replace(/เลขรับ/g, '')
    .replace(/เลขฟ้อง/g, '')
    .replace(/ฟ้องวันที่/g, '')
    .replace(/วันที่ฟ้อง/g, '')
    .replace(/วันฟ้อง/g, '')
    .replace(/วันที่/g, '')
    .replace(/ยื่นฟ้อง/g, '')
    .replace(/ฟ้อง/g, '')
    .trim();

  if (!cleanTerm && (term.includes('ฟ้อง') || term.includes('วันที่') || term.includes('ค้นหา'))) {
    return true;
  }

  const q = cleanTerm || term;
  const rawFilingDate = (c.filingDate || '').toLowerCase();
  const thaiFilingDate = formatThaiDate(c.filingDate).toLowerCase();

  // 3. ค้นหาเลขสารบบ ส.1 และ ส.4 อย่างเจาะจง
  const qDocket = cleanDocketNumber(term) || cleanDocketNumber(cleanTerm);
  const cS1 = cleanDocketNumber(c.receivedNumberS1);
  const cOrigS1 = cleanDocketNumber(c.originalReceivedNumberS1);
  const cS4 = cleanDocketNumber(c.filingNumberS4);
  const cOrigS4 = cleanDocketNumber(c.originalFilingNumberS4);

  if ((term.includes('ส.1') || term.includes('เลขรับ')) && cleanTerm) {
    if (
      (cS1 && (cS1.includes(qDocket || cleanTerm) || (qDocket && (qDocket.includes(cS1))))) ||
      (cOrigS1 && (cOrigS1.includes(qDocket || cleanTerm) || (qDocket && (qDocket.includes(cOrigS1))))) ||
      Boolean(c.receivedNumberS1 && c.receivedNumberS1.toLowerCase().includes(cleanTerm))
    ) {
      return true;
    }
  }

  if ((term.includes('ส.4') || term.includes('เลขฟ้อง')) && cleanTerm) {
    if (
      (cS4 && (cS4.includes(qDocket || cleanTerm) || (qDocket && (qDocket.includes(cS4))))) ||
      (cOrigS4 && (cOrigS4.includes(qDocket || cleanTerm) || (qDocket && (qDocket.includes(cOrigS4))))) ||
      Boolean(c.filingNumberS4 && c.filingNumberS4.toLowerCase().includes(cleanTerm))
    ) {
      return true;
    }
  }

  if (qDocket && qDocket.length >= 2) {
    if (cS1 && (cS1.includes(qDocket) || qDocket.includes(cS1))) return true;
    if (cOrigS1 && (cOrigS1.includes(qDocket) || qDocket.includes(cOrigS1))) return true;
    if (cS4 && (cS4.includes(qDocket) || qDocket.includes(cS4))) return true;
    if (cOrigS4 && (cOrigS4.includes(qDocket) || qDocket.includes(cOrigS4))) return true;
  }

  // 4. หมายเลขคดีดำ / แดง ทั้งปัจจุบันและเดิม
  if (c.blackCaseNo.toLowerCase().includes(q) || c.blackCaseNo.toLowerCase().includes(term)) return true;
  if (c.originalBlackCaseNo && (c.originalBlackCaseNo.toLowerCase().includes(q) || c.originalBlackCaseNo.toLowerCase().includes(term))) return true;
  if (c.redCaseNo && (c.redCaseNo.toLowerCase().includes(q) || c.redCaseNo.toLowerCase().includes(term))) return true;
  if (c.originalRedCaseNo && (c.originalRedCaseNo.toLowerCase().includes(q) || c.originalRedCaseNo.toLowerCase().includes(term))) return true;

  // 5. ส.1 และ ส.4 แบบข้อความตรงตัว
  if (c.receivedNumberS1 && (c.receivedNumberS1.toLowerCase().includes(q) || c.receivedNumberS1.toLowerCase().includes(term))) return true;
  if (c.filingNumberS4 && (c.filingNumberS4.toLowerCase().includes(q) || c.filingNumberS4.toLowerCase().includes(term))) return true;

  // 6. วันที่ฟ้อง
  if (rawFilingDate.includes(q) || thaiFilingDate.includes(q)) return true;
  if (cleanTerm && (rawFilingDate.includes(cleanTerm) || thaiFilingDate.includes(cleanTerm))) return true;

  // 7. คู่ความ ศาล และผู้รับผิดชอบ
  if (c.defendant.toLowerCase().includes(q) || c.defendant.toLowerCase().includes(term)) return true;
  if (c.plaintiff.toLowerCase().includes(q) || c.plaintiff.toLowerCase().includes(term)) return true;
  if (c.court.toLowerCase().includes(q) || c.court.toLowerCase().includes(term)) return true;
  if (c.prosecutorName && (c.prosecutorName.toLowerCase().includes(q) || c.prosecutorName.toLowerCase().includes(term))) return true;
  if (c.responsiblePerson && (c.responsiblePerson.toLowerCase().includes(q) || c.responsiblePerson.toLowerCase().includes(term))) return true;
  if (c.caseType.toLowerCase().includes(q)) return true;

  // 8. หมายเหตุ ผลคำพิพากษา และคำสั่งแยกฟ้อง
  if (c.judgmentOutcome && c.judgmentOutcome.toLowerCase().includes(q)) return true;
  if (c.notes && c.notes.toLowerCase().includes(q)) return true;
  if (c.severedNotes && (c.severedNotes.toLowerCase().includes(q) || c.severedNotes.toLowerCase().includes(term))) return true;
  if (c.requisitionNotes && c.requisitionNotes.toLowerCase().includes(q)) return true;

  return false;
}

export interface LinkedSearchResult {
  matches: boolean;
  isDirectMatch: boolean;
  isLinkedMatch: boolean;
  matchedViaCases: AppealCase[];
  linkedCases: AppealCase[];
}

/**
 * ค้นหาสำนวนคดีโดยรวมสำนวนที่เชื่อมโยงกัน (Linked Cases)
 * หากสำนวน A ตรงกับการค้นหา สำนวน B ที่เชื่อมโยงกับ A (สำนวนที่ศาลแยกฟ้อง / สำนวนเดิม)
 * จะถูกดึงขึ้นมาแสดงด้วย พร้อมระบุว่าพบจากการเชื่อมโยง
 */
export function caseMatchesWithLinkedSearch(
  c: AppealCase,
  allCases: AppealCase[],
  searchQuery: string,
  baseMatcher: (caseItem: AppealCase, query: string) => boolean = baseCaseMatcher,
  prebuiltLinkedMap?: Map<string, AppealCase[]>
): LinkedSearchResult {
  if (!searchQuery || !searchQuery.trim()) {
    const linked = prebuiltLinkedMap?.get(c.id) || getLinkedCases(c, allCases);
    return {
      matches: true,
      isDirectMatch: true,
      isLinkedMatch: false,
      matchedViaCases: [],
      linkedCases: linked,
    };
  }

  const isDirect = baseMatcher(c, searchQuery);
  const linked = prebuiltLinkedMap?.get(c.id) || getLinkedCases(c, allCases);

  if (isDirect) {
    return {
      matches: true,
      isDirectMatch: true,
      isLinkedMatch: false,
      matchedViaCases: [],
      linkedCases: linked,
    };
  }

  // ตรวจสอบว่าสำนวนที่เชื่อมโยงกันตรงกับการค้นหาหรือไม่
  const matchedVia = linked.filter((linkedCase) => baseMatcher(linkedCase, searchQuery));
  if (matchedVia.length > 0) {
    return {
      matches: true,
      isDirectMatch: false,
      isLinkedMatch: true,
      matchedViaCases: matchedVia,
      linkedCases: linked,
    };
  }

  return {
    matches: false,
    isDirectMatch: false,
    isLinkedMatch: false,
    matchedViaCases: [],
    linkedCases: linked,
  };
}
