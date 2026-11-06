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
    `        ...............ข้อ ๑. คดีนี้ ศาลจังหวัดเพชรบุรีได้มีคำพิพากษาจำเลย เมื่อวันที่ ( ${judgmentDateText} ) และจะครบกำหนดระยะเวลาอุทธรณ์ ในวันที่ ( ${originalDeadlineText} ) ซึ่งคดีนี้อยู่ระหว่างเสนอผู้บังคับบัญชา โจทก์ จึงยื่นคำร้องขอขยายระยะเวลาอุทธรณ์ออกไปอีก มีกำหนด ๒ เดือน นับแต่วันที่ ( ${nextDayDeadlineText} ) ถึงวันที่ ( ${newDeadlineText} ) ขอศาลได้โปรดอนุญาต`,
    `..................................................................ควรมิควรแล้วแต่จะโปรด................................................`,
    `....................................................ลงชื่อ....................................................โจทก์`,
    `        ...............คำร้องฉบับนี้ ข้าพเจ้า${prosecutor && prosecutor !== '................................................' ? ` ( ${prosecutor} ) ` : '................................................'}พนักงานอัยการจังหวัดเพชรบุรี โจทก์ เป็น`,
    `ผู้เรียงและพิมพ์.............................................................................................................................`,
    `....................................................ลงชื่อ....................................................ผู้เรียงและพิมพ์`,
    `หมายเหตุ ข้าพเจ้ารอฟังคำสั่งอยู่ ถ้าไม่รอให้ถือว่าทราบแล้ว`,
    `                                                                            ผู้ร้อง`,
  ].join('\n');
}

/**
 * สร้าง HTML สำหรับเปิดและแก้ไขใน Microsoft Word (.doc)
 * กำหนดขนาดหน้า A4 มาตราส่วนขอบกระดาษของศาล และแบบอักษร TH Sarabun PSK 16pt มาตรฐานราชการ
 * รองรับการไฮไลท์สีเหลืองตามแบบฟอร์ม PDF
 */
export function generateCourtPetitionWordHtml(
  data: CourtPetitionData,
  options: {
    hasGarudaOnPaper?: boolean;
    highlightEnabled?: boolean;
    leaveDayBlank?: boolean;
  } = {}
): string {
  const courtName = data.court ? data.court.replace(/^ศาล\s*/, '') : 'จังหวัดเพชรบุรี';
  const blackNo = data.blackCaseNo || '............................';
  const redNo = data.redCaseNo || '............................';
  const plaintiff = data.plaintiff || 'พนักงานอัยการจังหวัดเพชรบุรี';
  const defendant = data.defendant || '................................................';
  const extensionCountStr = data.extensionCount > 1 ? `ครั้งที่ ${toThaiNumerals(data.extensionCount)}` : 'ครั้งที่ ๑';
  const prosecutor = data.prosecutorName || '';

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

  const nextDay = data.originalDeadline ? addDaysToDateStr(data.originalDeadline, 1) : '';
  const nextDayDeadlineText = nextDay
    ? formatDayMonthYearSimple(nextDay, true)
    : '................................................';

  const extended2Months = data.newDeadline || (data.originalDeadline ? addMonthsToDateStr(data.originalDeadline, 2) : '');
  const newDeadlineText = extended2Months
    ? formatDayMonthYearSimple(extended2Months, true)
    : '................................................';

  const isHighlight = options.highlightEnabled !== false;
  const wrapHighlight = (val: string) =>
    isHighlight
      ? `<span class="highlight" style="background-color: #FFFF00; mso-highlight: yellow;">(&nbsp;${val}&nbsp;)</span>`
      : `( ${val} )`;

  // บรรทัดวันที่ ตามแบบ PDF
  let dateHtml = '';
  if (options.leaveDayBlank) {
    if (isHighlight) {
      dateHtml = `<span class="highlight" style="background-color: #FFFF00; mso-highlight: yellow;">วันที่......เดือน</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="highlight" style="background-color: #FFFF00; mso-highlight: yellow;">พุทธศักราช ${petitionYear}</span>`;
    } else {
      dateHtml = `วันที่......เดือน          พุทธศักราช ${petitionYear}`;
    }
  } else {
    if (isHighlight) {
      dateHtml = `<span class="highlight" style="background-color: #FFFF00; mso-highlight: yellow;">วันที่ ${petitionDay} เดือน ${petitionMonth} พุทธศักราช ${petitionYear}</span>`;
    } else {
      dateHtml = `วันที่ ${petitionDay} เดือน ${petitionMonth} พุทธศักราช ${petitionYear}`;
    }
  }

  const topHeaderArea = options.hasGarudaOnPaper
    ? `<div style="text-align: center; margin-bottom: 12pt;">
        <div style="font-size: 16pt; font-weight: bold; color: #000000; letter-spacing: 2px;">[ ตราครุฑ ]</div>
       </div>`
    : `<div style="height: 4.5cm; margin-bottom: 12pt;">&nbsp;</div>`;

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Microsoft Word">
<meta name="Originator" content="Microsoft Word">
<title>คำร้องขอขยายระยะเวลาอุทธรณ์ ${data.blackCaseNo || ''}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
    <w:Compatibility>
      <w:BreakWrappedTables/>
      <w:SnapToGridInCell/>
      <w:WrapTextWithPunct/>
      <w:UseAsianBreakRules/>
    </w:Compatibility>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page Section1 {
    size: 21.0cm 29.7cm; /* A4 */
    margin: 2.5cm 2.0cm 2.0cm 2.5cm; /* ขอบบน 2.5cm, ขวา 2.0cm, ล่าง 2.0cm, ซ้าย 2.5cm ตามมาตรฐานศาล */
    mso-header-margin: 36.0pt;
    mso-footer-margin: 36.0pt;
    mso-paper-source: 0;
  }
  div.Section1 {
    page: Section1;
  }
  body {
    font-family: 'TH Sarabun PSK', 'TH Sarabun New', 'Angsana New', 'Cordia New', Tahoma, sans-serif;
    font-size: 16pt;
    line-height: 1.25;
    color: #000000;
  }
  p, div, td, span {
    font-family: 'TH Sarabun PSK', 'TH Sarabun New', 'Angsana New', 'Cordia New', Tahoma, sans-serif;
    font-size: 16pt;
    line-height: 1.25;
  }
  .highlight {
    background-color: #FFFF00 !important;
    mso-highlight: yellow;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  td {
    padding: 0;
    vertical-align: top;
  }
</style>
</head>
<body lang="TH">
<div class="Section1">
  ${topHeaderArea}

  <!-- Header row: Request title and Case Numbers -->
  <table style="width: 100%; margin-bottom: 6pt;">
    <tr>
      <td style="width: 48%; text-align: left; vertical-align: top;">
        <div>(คำร้อง) ขอขยายระยะเวลาอุทธรณ์</div>
        <div style="padding-left: 2.0cm;">${extensionCountStr}</div>
      </td>
      <td style="width: 52%; text-align: right; vertical-align: top;">
        <div>คดีหมายเลขดำที่ ${wrapHighlight(blackNo)}</div>
        <div style="margin-top: 2pt;">คดีหมายเลขแดงที่ ${wrapHighlight(redNo)}</div>
      </td>
    </tr>
  </table>

  <!-- Court Name -->
  <div style="text-align: center; margin: 4pt 0; font-size: 16pt;">
    ศาล ${courtName}
  </div>

  <!-- Date -->
  <div style="text-align: center; margin: 4pt 0;">
    ${dateHtml}
  </div>

  <!-- Case Type -->
  <div style="text-align: center; margin: 4pt 0;">
    ความ${data.caseType || 'อาญา'}
  </div>

  <!-- Parties (ระหว่าง { โจทก์ / จำเลย) -->
  <table style="width: 100%; margin: 8pt 0 10pt 0;">
    <tr>
      <td style="width: 14%; text-align: right; vertical-align: middle; padding-right: 6pt;">
        ระหว่าง
      </td>
      <td style="width: 4%; text-align: center; vertical-align: middle; font-size: 38pt; line-height: 0.9; font-weight: lighter;">
        &#123;
      </td>
      <td style="width: 82%; vertical-align: middle;">
        <table style="width: 100%;">
          <tr>
            <td style="text-align: left;">.....${plaintiff}....................................................</td>
            <td style="text-align: right; width: 50pt;">โจทก์</td>
          </tr>
          <tr>
            <td style="text-align: left;">${wrapHighlight(defendant)}..................................................</td>
            <td style="text-align: right; width: 50pt;">จำเลย</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Body -->
  <div style="text-indent: 2.0cm; margin-top: 8pt;">
    ข้าพเจ้าพนักงานอัยการ .....จังหวัดเพชรบุรี...............................................โจทก์......
  </div>
  <div>
    ขอยื่นคำร้องมีข้อความตามที่กล่าวต่อไปนี้
  </div>

  <div style="text-indent: 2.0cm; text-align: justify; margin-top: 6pt; line-height: 1.3;">
    ...............ข้อ ๑. คดีนี้ ศาลจังหวัดเพชรบุรีได้มีคำพิพากษาจำเลย เมื่อวันที่ ${wrapHighlight(judgmentDateText)} และจะครบกำหนดระยะเวลาอุทธรณ์ ในวันที่ ${wrapHighlight(originalDeadlineText)} ซึ่งคดีนี้อยู่ระหว่างเสนอผู้บังคับบัญชา โจทก์ จึงยื่นคำร้องขอขยายระยะเวลาอุทธรณ์ออกไปอีก มีกำหนด ๒ เดือน นับแต่วันที่ ${wrapHighlight(nextDayDeadlineText)} ถึงวันที่ ${wrapHighlight(newDeadlineText)} ขอศาลได้โปรดอนุญาต
  </div>

  <!-- Closing -->
  <div style="text-align: center; margin: 18pt 0 12pt 0;">
    ..................................................................ควรมิควรแล้วแต่จะโปรด................................................
  </div>

  <div style="text-align: right; padding-right: 1.5cm; margin: 8pt 0;">
    ....................................................ลงชื่อ....................................................โจทก์
  </div>

  <!-- Author and Typist -->
  <div style="text-indent: 2.0cm; text-align: justify; margin-top: 8pt; line-height: 1.3;">
    ...............คำร้องฉบับนี้ ข้าพเจ้า${prosecutor ? ` ${wrapHighlight(prosecutor)} ` : '................................................'}พนักงานอัยการจังหวัดเพชรบุรี โจทก์ เป็น
  </div>
  <div>
    ผู้เรียงและพิมพ์.............................................................................................................................
  </div>

  <div style="text-align: right; padding-right: 1.5cm; margin: 8pt 0;">
    ....................................................ลงชื่อ....................................................ผู้เรียงและพิมพ์
  </div>

  <!-- Note -->
  <div style="margin-top: 18pt;">
    <u>หมายเหตุ</u> ข้าพเจ้ารอฟังคำสั่งอยู่ ถ้าไม่รอให้ถือว่าทราบแล้ว
  </div>
  <div style="text-align: right; padding-right: 1.5cm; margin-top: 4pt;">
    ผู้ร้อง
  </div>
</div>
</body>
</html>`;
}

/**
 * ดาวน์โหลดแบบคำร้องขอขยายระยะเวลาอุทธรณ์เป็นไฟล์ Microsoft Word (.doc)
 * ที่สามารถคลิกเปิดในโปรแกรม Microsoft Word บนคอมพิวเตอร์ทั่วไปได้ทันที
 */
export function downloadCourtPetitionWordDoc(
  data: CourtPetitionData,
  options: {
    hasGarudaOnPaper?: boolean;
    highlightEnabled?: boolean;
    leaveDayBlank?: boolean;
  } = {}
): void {
  const htmlContent = generateCourtPetitionWordHtml(data, options);
  const blob = new Blob(['\uFEFF' + htmlContent], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeBlackNo = (data.blackCaseNo || 'คำร้อง').replace(/[/\\?%*:|"<>]/g, '_');
  a.download = `คำร้องขอขยายอุทธรณ์_${safeBlackNo}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
