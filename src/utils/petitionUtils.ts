import { AppealCase } from '../types/appeal';
import { formatThaiDate } from './dateUtils';

export interface CourtPetitionData {
  court: string;
  blackCaseNo: string;
  redCaseNo: string;
  caseType: string;
  plaintiff: string;
  defendant: string;
  judgmentDate: string;
  judgmentOutcome: string;
  originalDeadline: string;
  newDeadline: string;
  extensionCount: number;
  reason: string;
  prosecutorName: string;
  petitionDate: string; // YYYY-MM-DD
}

export const PRESET_PETITION_REASONS = [
  {
    id: 'copy_records',
    title: 'รอคัดถ่ายสำเนาคำพิพากษาและรายงานกระบวนพิจารณา (มาตรฐานยอดนิยม)',
    text: 'พนักงานอัยการเจ้าของสำนวนอยู่ระหว่างรอคัดถ่ายสำเนาคำพิพากษาฉบับเต็มและสำเนารายงานกระบวนพิจารณาของศาล เพื่อนำมาตรวจสอบข้อเท็จจริงและข้อกฎหมายอย่างละเอียดรอบคอบ ประกอบกับพนักงานอัยการเจ้าของสำนวนมีคดีที่ต้องดำเนินกระบวนพิจารณาและว่าต่างแก้ต่างในศาลอีกหลายเรื่อง จึงยังไม่อาจยื่นอุทธรณ์ได้ทันภายในกำหนดระยะเวลาตามกฎหมาย',
  },
  {
    id: 'region_attorney',
    title: 'เสนอสำนวนให้อธิบดีอัยการภาค 7 พิจารณาสั่งตามระเบียบ',
    text: 'พนักงานอัยการเจ้าของสำนวนได้พิจารณาข้อเท็จจริงและข้อกฎหมายแล้วเห็นควรอุทธรณ์คำพิพากษาของศาลชั้นต้น ซึ่งขณะนี้อยู่ระหว่างการจัดทำร่างอุทธรณ์และเสนอสำนวนไปยังอธิบดีอัยการภาค 7 เพื่อพิจารณาสั่งตามระเบียบของสำนักงานอัยการสูงสุด จึงมีความจำเป็นต้องขอขยายระยะเวลาเพื่อรอผลคำสั่งดังกล่าว',
  },
  {
    id: 'complex_case',
    title: 'สำนวนมีข้อเท็จจริงและพยานหลักฐานจำนวนมาก มีประเด็นกฎหมายซับซ้อน',
    text: 'คดีนี้มีข้อเท็จจริงและพยานหลักฐานในสำนวนการสอบสวนเป็นจำนวนมาก ทั้งมีประเด็นข้อกฎหมายที่ต้องค้นคว้าแนวคำพิพากษาศาลฎีกาและตรวจวิเคราะห์อย่างละเอียดรอบคอบเพื่อประโยชน์แห่งความยุติธรรม จึงยังไม่สามารถยื่นอุทธรณ์ได้ทันภายในกำหนดระยะเวลา',
  },
  {
    id: 'defendant_appealed',
    title: 'จำเลยยื่นอุทธรณ์ อยู่ระหว่างตรวจเพื่อจัดทำคำแก้อุทธรณ์',
    text: 'จำเลยได้ยื่นอุทธรณ์คำพิพากษาต่อศาล และพนักงานอัยการโจทก์ได้รับสำเนาอุทธรณ์ของจำเลยแล้ว อยู่ระหว่างตรวจสอบข้อเท็จจริงและข้อกฎหมายเพื่อจัดทำคำแก้อุทธรณ์ ซึ่งมีประเด็นโต้แย้งหลายประการ จึงไม่อาจยื่นคำแก้อุทธรณ์ได้ทันภายในกำหนด',
  },
];

const THAI_DIGITS = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];

export function toThaiNumerals(str: string | number): string {
  return String(str).replace(/[0-9]/g, (digit) => THAI_DIGITS[parseInt(digit, 10)]);
}

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

/**
 * แปลงวันที่เป็นรูปแบบศาลไทย เช่น วันที่ ๑๕ เดือน ตุลาคม พุทธศักราช ๒๕๖๙
 */
export function formatCourtThaiDate(dateStr?: string, thaiDigits = false): string {
  if (!dateStr) return '................................................';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const day = d;
    const month = THAI_MONTHS_FULL[m - 1] || '';
    const buddhistYear = y + 543;

    if (thaiDigits) {
      return `วันที่ ${toThaiNumerals(day)} เดือน ${month} พุทธศักราช ${toThaiNumerals(buddhistYear)}`;
    }
    return `วันที่ ${day} เดือน ${month} พ.ศ. ${buddhistYear}`;
  } catch {
    return dateStr;
  }
}

/**
 * สร้างข้อความคำร้องขอขยายระยะเวลาอุทธรณ์ตามแบบพิมพ์ศาล (๗)
 * พร้อมสำหรับการพิมพ์ลงกระดาษตราครุฑ หรือคัดลอกลง Word
 */
export function generateCourtPetitionText(
  data: CourtPetitionData,
  options: { forPreprintedGarudaPaper?: boolean } = {}
): string {
  const courtName = data.court || 'ศาลจังหวัดเพชรบุรี';
  const blackNo = data.blackCaseNo || '........................';
  const redNo = data.redCaseNo || '........................';
  const caseType = data.caseType || 'อาญา';
  const plaintiff = data.plaintiff || 'พนักงานอัยการจังหวัดเพชรบุรี';
  const defendant = data.defendant || '................................................';
  const countStr = data.extensionCount > 1 ? ` (ครั้งที่ ${data.extensionCount})` : ' (ครั้งที่ ๑)';
  const prosecutor = data.prosecutorName || '................................................';

  const [py, pm, pd] = (data.petitionDate || new Date().toISOString().slice(0, 10)).split('-').map(Number);
  const petitionDay = pd;
  const petitionMonth = THAI_MONTHS_FULL[pm - 1] || '';
  const petitionYear = py + 543;

  const originalDeadlineText = data.originalDeadline
    ? formatCourtThaiDate(data.originalDeadline)
    : '................................................';
  const newDeadlineText = data.newDeadline
    ? formatCourtThaiDate(data.newDeadline)
    : '................................................';
  const judgmentDateText = data.judgmentDate
    ? formatCourtThaiDate(data.judgmentDate)
    : '................................................';

  const judgmentOutcomeText = data.judgmentOutcome
    ? `ปรากฏตามคำพิพากษาของศาลคือ "${data.judgmentOutcome}"`
    : 'ปรากฏตามคำพิพากษาของศาล';

  const extensionContextText =
    data.extensionCount > 1
      ? `และคดีนี้ ศาลได้เคยอนุญาตให้โจทก์ขยายระยะเวลาอุทธรณ์มาแล้ว โดยจะครบกำหนดใน${originalDeadlineText}`
      : `และคดีนี้จะครบกำหนดระยะเวลาอุทธรณ์ ๑ เดือน ตามกฎหมายใน${originalDeadlineText}`;

  const reasonText = data.reason || PRESET_PETITION_REASONS[0].text;

  // สำหรับกระดาษพิมพ์ตราครุฑสำเร็จรูป จะเว้นระยะห่างด้านบนไว้
  const topSpacing = options.forPreprintedGarudaPaper
    ? `\n\n\n\n\n`
    : `\n[ ตราครุฑ ]\n\n`;

  return [
    topSpacing,
    `                                                                      (๗)`,
    `                                                     คดีหมายเลขดำที่   ${blackNo}`,
    `                                                     คดีหมายเลขแดงที่  ${redNo}`,
    `                             ${courtName}`,
    `วันที่  ${petitionDay}  เดือน  ${petitionMonth}  พุทธศักราช  ${petitionYear}`,
    `ความ  ${caseType}`,
    ``,
    `${plaintiff}                                                                  โจทก์`,
    `ระหว่าง`,
    `${defendant}                                                                  จำเลย`,
    ``,
    `                                    คำร้องขอขยายระยะเวลาอุทธรณ์${countStr}`,
    ``,
    `      ข้าพเจ้า ${plaintiff} โจทก์ ขอยื่นคำร้องต่อศาล มีข้อความตามที่จะกราบเรียนต่อไปนี้`,
    ``,
    `      ข้อ ๑. คดีนี้ ศาลได้โปรดอ่านคำพิพากษาเมื่อ${judgmentDateText} ${judgmentOutcomeText} ${extensionContextText}`,
    ``,
    `      ข้อ ๒. เนื่องจาก ${reasonText}`,
    ``,
    `      ด้วยเหตุดังกล่าวข้างต้น โจทก์จึงมีความจำเป็นอย่างยิ่งที่จะต้องกราบเรียนต่อศาล เพื่อขอประทานศาลได้โปรดมีคำสั่งอนุญาตให้ขยายระยะเวลาอุทธรณ์ของโจทก์ออกไปอีก${countStr} นับแต่วันครบกำหนดเดิม จนถึง${newDeadlineText} เพื่อประโยชน์แห่งความยุติธรรม`,
    ``,
    `      ควรมิควรแล้วแต่จะโปรด`,
    ``,
    `                                          (ลงชื่อ) .............................................................. โจทก์`,
    `                                                ( ${prosecutor} )`,
    `                                                    พนักงานอัยการเจ้าของสำนวน`,
    ``,
    `คำร้องฉบับนี้ ข้าพเจ้า ${prosecutor} พนักงานอัยการผู้เรียงและยื่น`,
    `                                          (ลงชื่อ) .............................................................. ผู้เรียงและยื่น`,
    `                                          (ลงชื่อ) .............................................................. ผู้เขียนหรือพิมพ์`,
  ].join('\n');
}
