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

export const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

/**
 * บวกจำนวนวันให้กับ YYYY-MM-DD
 */
export function addDaysToDateStr(dateStr?: string, days: number = 1): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    return dt.toISOString().slice(0, 10);
  } catch {
    return dateStr || '';
  }
}

/**
 * บวกจำนวนเดือนให้กับ YYYY-MM-DD
 */
export function addMonthsToDateStr(dateStr?: string, months: number = 2): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setMonth(dt.getMonth() + months);
    return dt.toISOString().slice(0, 10);
  } catch {
    return dateStr || '';
  }
}

/**
 * แปลงวันที่เป็นข้อความ วัน เดือน ปี แบบกระชับ เช่น "๑๖ ตุลาคม ๒๕๖๙"
 */
export function formatDayMonthYearSimple(dateStr?: string, thaiDigits = true): string {
  if (!dateStr) return '................................';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const day = d;
    const month = THAI_MONTHS_FULL[m - 1] || '';
    const buddhistYear = (y > 2400 ? y : y + 543);

    if (thaiDigits) {
      return `${toThaiNumerals(day)} ${month} ${toThaiNumerals(buddhistYear)}`;
    }
    return `${day} ${month} ${buddhistYear}`;
  } catch {
    return dateStr || '';
  }
}

/**
 * แปลงวันที่เป็นรูปแบบศาลไทย เช่น วันที่ ๑๕ เดือน ตุลาคม พุทธศักราช ๒๕๖๙
 */
export function formatCourtThaiDate(dateStr?: string, thaiDigits = false): string {
  if (!dateStr) return '................................................';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const day = d;
    const month = THAI_MONTHS_FULL[m - 1] || '';
    const buddhistYear = (y > 2400 ? y : y + 543);

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
  const plaintiff = data.plaintiff || 'พนักงานอัยการจังหวัดเพชรบุรี';
  const defendant = data.defendant || '................................................';
  const countStr = data.extensionCount > 1 ? `ครั้งที่ ${toThaiNumerals(data.extensionCount)}` : 'ครั้งที่ ๑';
  const prosecutor = data.prosecutorName || '................................................';

  const [py, pm, pd] = (data.petitionDate || new Date().toISOString().slice(0, 10)).split('-').map(Number);
  const petitionDay = pd ? toThaiNumerals(pd) : '......';
  const petitionMonth = THAI_MONTHS_FULL[pm - 1] || 'ตุลาคม';
  const petitionYear = toThaiNumerals(py > 2400 ? py : py + 543);

  const judgmentDateText = data.judgmentDate
    ? formatDayMonthYearSimple(data.judgmentDate, true)
    : '................................................';
  const originalDeadlineText = data.originalDeadline
    ? formatDayMonthYearSimple(data.originalDeadline, true)
    : '................................................';

  // วันถัดจากวันครบระยะเวลาอุทธรณ์
  const nextDay = data.originalDeadline ? addDaysToDateStr(data.originalDeadline, 1) : '';
  const nextDayDeadlineText = nextDay
    ? formatDayMonthYearSimple(nextDay, true)
    : '................................................';

  // ขยายวันทีครบอุทธรณ์ไปอีกสองเดือน
  const extended2Months = data.newDeadline || (data.originalDeadline ? addMonthsToDateStr(data.originalDeadline, 2) : '');
  const newDeadlineText = extended2Months
    ? formatDayMonthYearSimple(extended2Months, true)
    : '................................................';

  const topSpacing = options.forPreprintedGarudaPaper
    ? `\n\n\n\n\n`
    : `                                        [ตราครุฑ]\n\n`;

  return [
    topSpacing,
    `(คำร้อง) ขอขยายระยะเวลาอุทธรณ์                                   คดีหมายเลขดำที่ ( ${blackNo} )`,
    `        ${countStr}                                             คดีหมายเลขแดงที่ ( ${redNo} )`,
    `                                   ศาล จังหวัดเพชรบุรี`,
    ``,
    `                      วันที่ ${petitionDay} เดือน ${petitionMonth} พุทธศักราช ${petitionYear}`,
    ``,
    `                                    ความอาญา`,
    ``,
    `ระหว่าง { .....${plaintiff}....................................................โจทก์`,
    `        ( ${defendant} )..................................................จำเลย`,
    ``,
    `        ข้าพเจ้าพนักงานอัยการ .....จังหวัดเพชรบุรี...............................................โจทก์......`,
    `ขอยื่นคำร้องมีข้อความตามที่กล่าวต่อไปนี้`,
    `        ...............ข้อ ๑. คดีนี้ ศาลจังหวัดเพชรบุรีได้มีคำพิพากษาจำเลย เมื่อวันที่ ( ${judgmentDateText} ) และจะครบกำหนดระยะเวลาอุทธรณ์ ในวันที่ ( ${originalDeadlineText} ) ซึ่งคดีนี้อยู่ระหว่างเสนอผู้บังคับบัญชา โจทก์ จึงยื่นคำร้องขอขยายระยะเวลาอุทธรณ์ออกไปอีก มีกำหนด ๒ เดือน นับแต่วันที่ ( ${nextDayDeadlineText} ) ถึงวันที่ ( ${newDeadlineText} ) ขอศาลได้โปรดอนุญาต................................`,
    `..................................................................ควรมิควรแล้วแต่จะโปรด................................................`,
    `....................................................ลงชื่อ....................................................โจทก์`,
    `        ...............คำร้องฉบับนี้ ข้าพเจ้า ( ${prosecutor} ) พนักงานอัยการจังหวัดเพชรบุรี โจทก์ เป็นผู้เรียงและพิมพ์.............................................................................................................................`,
    `....................................................ลงชื่อ....................................................ผู้เรียงและพิมพ์`,
    `หมายเหตุ ข้าพเจ้ารอฟังคำสั่งอยู่ ถ้าไม่รอให้ถือว่าทราบแล้ว`,
    `....................................................ผู้ร้อง`,
  ].join('\n');
}
