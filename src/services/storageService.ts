import { AppealCase, DailyJudgmentFollowUp, SheetConfig, MonthlyDutyRoster } from '../types/appeal';

const STORAGE_KEY_CASES = 'appeal_tracker_cases_v1';
const STORAGE_KEY_FOLLOWUPS = 'appeal_tracker_followups_v1';
const STORAGE_KEY_SHEET_CONFIG = 'appeal_tracker_sheet_config_v1';
const STORAGE_KEY_DUTY_ROSTERS = 'appeal_tracker_duty_rosters_v1';

export function getSavedSheetConfig(): SheetConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SHEET_CONFIG);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSheetConfig(config: SheetConfig | null) {
  if (config) {
    localStorage.setItem(STORAGE_KEY_SHEET_CONFIG, JSON.stringify(config));
  } else {
    localStorage.removeItem(STORAGE_KEY_SHEET_CONFIG);
  }
}

export function getSavedCases(): AppealCase[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CASES);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to parse saved cases', e);
  }
  return getInitialSampleCases();
}

export function saveCases(cases: AppealCase[]) {
  localStorage.setItem(STORAGE_KEY_CASES, JSON.stringify(cases));
}

export function getSavedFollowUps(): DailyJudgmentFollowUp[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FOLLOWUPS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to parse saved followups', e);
  }
  return getInitialSampleFollowUps();
}

export function saveFollowUps(items: DailyJudgmentFollowUp[]) {
  localStorage.setItem(STORAGE_KEY_FOLLOWUPS, JSON.stringify(items));
}

export function getSavedDutyRosters(): MonthlyDutyRoster[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DUTY_ROSTERS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to parse saved duty rosters', e);
  }
  return getInitialSampleDutyRosters();
}

export function saveDutyRosters(rosters: MonthlyDutyRoster[]) {
  localStorage.setItem(STORAGE_KEY_DUTY_ROSTERS, JSON.stringify(rosters));
}

function getInitialSampleDutyRosters(): MonthlyDutyRoster[] {
  return [
    {
      id: 'roster_2026_10',
      monthYear: '2026-10',
      monthNameThai: 'ตุลาคม 2569',
      title: 'ตารางเวรชี้คดีและเวรศาล ประจำเดือนตุลาคม 2569 (สำนักงานอัยการพิเศษฝ่ายคดีอาญา / ศาลอาญา)',
      uploadedFileName: 'ตารางเวรชี้_ตุลาคม_2569.pdf',
      uploadedAt: new Date().toISOString(),
      totalDays: 31,
      notes: 'เวรชี้คดีและเวรศาลประจำวัน เริ่มเวลา 08:30 น. - 16:30 น. หากติดราชการศาลอื่นให้ทำบันทึกแจ้งขอสลับเวรล่วงหน้า 1 วัน',
      duties: [
        {
          id: 'duty_2026_10_01',
          date: '2026-10-01',
          dayOfWeek: 'วันพฤหัสบดี',
          isHoliday: false,
          dutyType: 'เวรชี้สองฝ่าย / เวรชี้คดีอาญา',
          officers: [
            {
              name: 'นายสมชาย นิติการ',
              role: 'อัยการประจำกอง (เวรชี้ 1)',
              courtRoom: 'ห้องพิจารณาคดี 801',
              session: 'ตลอดวัน',
              contact: 'ต่อ 4101',
              notes: 'เวรชี้คดีใหม่รอบเช้า-บ่าย',
            },
            {
              name: 'นางสาวกานดา ยุติธรรม',
              role: 'รองอัยการจังหวัด (เวรชี้ 2)',
              courtRoom: 'ห้องพิจารณาคดี 802',
              session: 'ตลอดวัน',
              contact: 'ต่อ 4102',
              notes: 'รับผิดชอบคดีคุ้มครองสิทธิ',
            },
          ],
          notes: 'เปิดทำการปกติ',
        },
        {
          id: 'duty_2026_10_02',
          date: '2026-10-02',
          dayOfWeek: 'วันศุกร์',
          isHoliday: false,
          dutyType: 'เวรชี้สองฝ่าย / เวรชี้คดีอาญา',
          officers: [
            {
              name: 'นายธนพล บุญเจริญ',
              role: 'อัยการจังหวัดประจำสำนักงาน (เวรชี้ 1)',
              courtRoom: 'ห้องพิจารณาคดี 703',
              session: 'ตลอดวัน',
              contact: 'ต่อ 4105',
              notes: 'เวรชี้ประจำวันศุกร์',
            },
            {
              name: 'นิติกร นราธิป',
              role: 'นิติกรชำนาญการ (ผู้ช่วยเวรชี้)',
              courtRoom: 'ห้องพิจารณาคดี 703',
              session: 'ตลอดวัน',
              contact: 'ต่อ 4110',
              notes: 'ประสานงานสำนวนและคุมระยะเวลาอุทธรณ์',
            },
          ],
          notes: 'เวรชี้วันนี้',
        },
        {
          id: 'duty_2026_10_03',
          date: '2026-10-03',
          dayOfWeek: 'วันเสาร์',
          isHoliday: true,
          holidayName: 'วันหยุดราชการประจำสัปดาห์',
          officers: [],
          notes: 'ศาลปิดทำการ',
        },
        {
          id: 'duty_2026_10_04',
          date: '2026-10-04',
          dayOfWeek: 'วันอาทิตย์',
          isHoliday: true,
          holidayName: 'วันหยุดราชการประจำสัปดาห์',
          officers: [],
          notes: 'ศาลปิดทำการ',
        },
        {
          id: 'duty_2026_10_05',
          date: '2026-10-05',
          dayOfWeek: 'วันจันทร์',
          isHoliday: false,
          dutyType: 'เวรชี้สองฝ่าย',
          officers: [
            {
              name: 'นายพีระวัฒน์ ชัยมงคล',
              role: 'อัยการประจำกอง (เวรชี้ 1)',
              courtRoom: 'ห้องพิจารณาคดี 804',
              session: 'ตลอดวัน',
              contact: 'ต่อ 4108',
            },
            {
              name: 'นางสาวสุดารัตน์ เจริญสุข',
              role: 'อัยการประจำกอง (เวรชี้ 2)',
              courtRoom: 'ห้องพิจารณาคดี 805',
              session: 'ตลอดวัน',
              contact: 'ต่อ 4109',
            },
          ],
          notes: 'นัดตรวจพยานหลักฐานและชี้สองฝ่าย',
        },
        {
          id: 'duty_2026_10_06',
          date: '2026-10-06',
          dayOfWeek: 'วันอังคาร',
          isHoliday: false,
          dutyType: 'เวรชี้คดีทั่วไป',
          officers: [
            {
              name: 'นายวรวิทย์ สันติภาพ',
              role: 'อัยการพิเศษ (เวรชี้ 1)',
              courtRoom: 'ห้องพิจารณาคดี 901',
              session: 'ตลอดวัน',
            },
          ],
        },
        {
          id: 'duty_2026_10_13',
          date: '2026-10-13',
          dayOfWeek: 'วันอังคาร',
          isHoliday: true,
          holidayName: 'วันนวมินทรมหาราช',
          officers: [],
          notes: 'วันหยุดราชการ',
        },
        {
          id: 'duty_2026_10_23',
          date: '2026-10-23',
          dayOfWeek: 'วันศุกร์',
          isHoliday: true,
          holidayName: 'วันปิยมหาราช',
          officers: [],
          notes: 'วันหยุดราชการ',
        },
      ],
    },
    {
      id: 'roster_2026_09',
      monthYear: '2026-09',
      monthNameThai: 'กันยายน 2569',
      title: 'ตารางเวรชี้คดีและเวรศาล ประจำเดือนกันยายน 2569',
      uploadedFileName: 'ตารางเวรชี้_กันยายน_2569.pdf',
      uploadedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      totalDays: 30,
      notes: 'ตารางเวรชี้คดีประจำเดือนกันยายน 2569',
      duties: [
        {
          id: 'duty_2026_09_15',
          date: '2026-09-15',
          dayOfWeek: 'วันอังคาร',
          isHoliday: false,
          dutyType: 'เวรชี้สองฝ่าย',
          officers: [
            {
              name: 'นายกิตติคุณ นิตยากร',
              role: 'อัยการประจำกอง (เวรชี้ 1)',
              courtRoom: 'ห้องพิจารณา 701',
              session: 'ตลอดวัน',
            },
            {
              name: 'นางสาวพิมพ์ใจ รักษ์ธรรม',
              role: 'รองอัยการจังหวัด (เวรชี้ 2)',
              courtRoom: 'ห้องพิจารณา 702',
              session: 'ตลอดวัน',
            },
          ],
        },
        {
          id: 'duty_2026_09_25',
          date: '2026-09-25',
          dayOfWeek: 'วันศุกร์',
          isHoliday: false,
          dutyType: 'เวรชี้สองฝ่าย',
          officers: [
            {
              name: 'นายธีระพล ศักดิ์สิทธิ์',
              role: 'อัยการจังหวัดประจำสำนักงาน',
              courtRoom: 'ห้องพิจารณา 803',
              session: 'ตลอดวัน',
            },
          ],
        },
      ],
    },
  ];
}

/**
 * ตัวอย่างข้อมูลเริ่มต้นเสมือนจริงตามบริบทคดีความในศาลไทย
 */
function getInitialSampleCases(): AppealCase[] {
  return [
    {
      id: 'case_sample_1',
      filingDate: '2026-06-15',
      blackCaseNo: 'อ.452/2569',
      redCaseNo: 'อ.891/2569',
      receivedNumberS1: '124/2569',
      filingNumberS4: '45/2569',
      prosecutorName: 'นายธนพล บุญเจริญ',
      court: 'ศาลอาญา (รัชดา)',
      plaintiff: 'พนักงานอัยการ สำนักงานอัยการพิเศษฝ่ายคดีอาญา 4',
      defendant: 'นายสมชาย มั่นคง และพวก (จำเลยที่ 1-2)',
      caseType: 'อาญา (ฉ้อโกงประชาชน)',
      hasJudgment: true,
      judgmentDate: '2026-09-04',
      appealDeadline: '2026-10-05', // 1 เดือน (เลื่อนจาก 4 ต.ค. วันอาทิตย์ เป็น 5 ต.ค.)
      isCompleted: false, // ยังไม่เสร็จสิ้น -> เหลือ ~3-4 วัน เตือนด่วนมาก!
      judgmentOutcome: 'จำคุกจำเลยที่ 1 มีกำหนด 3 ปี ปรับ 60,000 บาท ยกฟ้องจำเลยที่ 2',
      responsiblePerson: 'นิติกร นราธิป / อัยการเจ้าของสำนวน',
      notes: 'จำเลยที่ 2 ยกฟ้อง ต้องตรวจสอบว่าจะอุทธรณ์คำพิพากษาในส่วนจำเลยที่ 2 หรือไม่ รีบตรวจร่าง',
      createdAt: '2026-09-04T10:00:00Z',
      updatedAt: '2026-09-04T10:00:00Z',
    },
    {
      id: 'case_sample_rights_protection',
      filingDate: '2026-10-01',
      blackCaseNo: 'อ.780/2569',
      receivedNumberS1: '256/2569',
      filingNumberS4: '89/2569',
      prosecutorName: 'นางสาวกานดา ยุติธรรม',
      court: 'ศาลอาญา',
      plaintiff: 'พนักงานอัยการ สำนักงานอัยการพิเศษฝ่ายคดีอาญา 2',
      defendant: 'นายกิตติศักดิ์ พรหมมินทร์ (จำเลย)',
      caseType: 'อาญา',
      hasJudgment: false,
      defendantPlea: 'denied',
      isCompleted: false,
      appointmentType: 'rights_protection',
      appointmentDate: '2026-10-15',
      appointmentTime: '09:00 น.',
      appointmentCourtRoom: 'ห้องพิจารณาคดี 802',
      appointmentNotes: 'นัดคุ้มครองสิทธิ จำเลยให้การปฏิเสธ ขอปรึกษาทนายความ',
      subsequentAppointments: [
        {
          id: 'sub_appt_1',
          type: 'pre_trial',
          date: '2026-11-10',
          time: '09:00 น.',
          courtRoom: 'ห้อง 802',
          notes: 'นัดพร้อมตรวจพยานหลักฐาน (จำเลยให้การปฏิเสธ)',
        },
        {
          id: 'sub_appt_2',
          type: 'witness_examination',
          date: '2026-12-05',
          time: '09:00 น.',
          courtRoom: 'ห้อง 802',
          notes: 'นัดสืบพยานโจทก์ 3 ปาก',
        },
      ],
      judgmentOutcome: 'อยู่ระหว่างนัดคุ้มครองสิทธิ (จำเลยให้การปฏิเสธ)',
      responsiblePerson: 'อัยการกานดา ยุติธรรม',
      notes: 'จำเลยให้การปฏิเสธ ศาลกำหนดนัดคุ้มครองสิทธิและนัดตรวจพยานหลักฐาน',
      createdAt: '2026-10-01T09:30:00Z',
      updatedAt: '2026-10-01T09:30:00Z',
    },
    {
      id: 'case_sample_2',
      filingDate: '2026-07-20',
      blackCaseNo: 'พ.1205/2569',
      redCaseNo: 'พ.2140/2569',
      receivedNumberS1: '310/2569',
      filingNumberS4: '102/2569',
      court: 'ศาลแพ่งกรุงเทพใต้',
      plaintiff: 'บริษัท สยามพาณิชย์ จำกัด',
      defendant: 'นายธนา รัตนโชติ (จำเลย)',
      caseType: 'แพ่ง (ผิดสัญญาจ้างทำของ)',
      hasJudgment: true,
      judgmentDate: '2026-09-08',
      appealDeadline: '2026-10-08',
      isCompleted: false, // เหลือ 7 วัน!
      judgmentOutcome: 'ให้จำเลยชำระเงิน 1,450,000 บาท พร้อมดอกเบี้ยร้อยละ 5 ต่อปี',
      responsiblePerson: 'ทนายณัฐพล ภักดี',
      notes: 'รอปรึกษาลูกความเรื่องการยื่นอุทธรณ์ประเด็นค่าเสียหายส่วนเกิน',
      createdAt: '2026-09-08T11:30:00Z',
      updatedAt: '2026-09-08T11:30:00Z',
    },
    {
      id: 'case_sample_3',
      filingDate: '2026-08-01',
      blackCaseNo: 'ผบ.339/2569',
      redCaseNo: 'ผบ.512/2569',
      receivedNumberS1: '412/2569',
      filingNumberS4: '135/2569',
      court: 'ศาลแขวงดุสิต',
      plaintiff: 'ธนาคารไทยมั่นคง จำกัด (มหาชน)',
      defendant: 'นางสาวกัญญารัตน์ สุขใจ',
      caseType: 'ผู้บริโภค (สินเชื่อบุคคล)',
      hasJudgment: true,
      judgmentDate: '2026-09-24',
      appealDeadline: '2026-10-26', // เลื่อนเนื่องจาก 24 ต.ค. วันเสาร์
      isCompleted: false,
      judgmentOutcome: 'พิพากษาตามยอมตามสัญญาประนีประนอมยอมความ',
      responsiblePerson: 'นิติกร ปิยวัฒน์',
      notes: 'ระยะเวลาอุทธรณ์ยังเหลืออีกกว่า 20 วัน อยู่ระหว่างร่างตรวจทาน',
      createdAt: '2026-09-24T09:00:00Z',
      updatedAt: '2026-09-24T09:00:00Z',
    },
    {
      id: 'case_sample_4',
      filingDate: '2026-05-10',
      blackCaseNo: 'อ.198/2569',
      redCaseNo: 'อ.310/2569',
      receivedNumberS1: '180/2569',
      filingNumberS4: '62/2569',
      court: 'ศาลจังหวัดนนทบุรี',
      plaintiff: 'พนักงานอัยการจังหวัดนนทบุรี',
      defendant: 'นายวิชัย สุวรรณภูมิ',
      caseType: 'อาญา (พ.ร.บ.จราจรทางบก)',
      hasJudgment: true,
      judgmentDate: '2026-08-20',
      appealDeadline: '2026-09-21',
      isCompleted: true, // เสร็จสิ้นแล้ว -> สำนวนนี้ไม่ต้องแจ้งเตือนอีกต่อไป!
      completedDate: '2026-09-18',
      completionReason: 'no_appeal',
      judgmentOutcome: 'ปรับ 10,000 บาท จำคุก 3 เดือน รอการลงโทษ 2 ปี',
      responsiblePerson: 'อัยการ สมเกียรติ',
      notes: 'ผู้บังคับบัญชามีคำสั่งเด็ดขาดไม่อุทธรณ์ คดีถึงที่สุดเรียบร้อย ไม่ต้องแจ้งเตือนอีก',
      createdAt: '2026-08-20T14:00:00Z',
      updatedAt: '2026-09-18T10:00:00Z',
    },
  ];
}

function getInitialSampleFollowUps(): DailyJudgmentFollowUp[] {
  return [
    {
      id: 'followup_1',
      followUpDate: '2026-10-01', // วันนี้
      caseNumber: 'อ.612/2569 (ศาลอาญา)',
      court: 'ศาลอาญา บัลลังก์ 802',
      plaintiff: 'พนักงานอัยการ',
      defendant: 'นายอัครเดช มีทรัพย์',
      responsiblePerson: 'นิติกร นราธิป',
      hearingTime: '09:00 น.',
      status: 'pending',
      judgmentSummary: 'รอฟังคำพิพากษาเช้านี้',
      transferredToAppealTracker: false,
      notes: 'หากศาลพิพากษาแล้ว ให้นำข้อมูลเข้าสู่ระบบคุมอุทธรณ์ 1 เดือนทันที',
      createdAt: '2026-10-01T08:00:00Z',
    },
    {
      id: 'followup_2',
      followUpDate: '2026-10-01',
      caseNumber: 'พ.489/2569 (ศาลแพ่ง)',
      court: 'ศาลแพ่ง บัลลังก์ 504',
      plaintiff: 'บจก. เอกทวีทรัพย์',
      defendant: 'ห้างหุ้นส่วนจำกัด บุญเจริญ',
      responsiblePerson: 'ทนายณัฐพล',
      hearingTime: '13:30 น.',
      status: 'delivered',
      judgmentSummary: 'ศาลพิพากษาให้จำเลยชำระเงินตามฟ้อง 850,000 บาท',
      transferredToAppealTracker: true,
      notes: 'ลงบันทึกใน Google Sheets เรียบร้อย',
      createdAt: '2026-10-01T14:00:00Z',
    },
    {
      id: 'followup_3',
      followUpDate: '2026-10-02', // วันพรุ่งนี้
      caseNumber: 'ผบ.890/2569 (ศาลแขวงพระนครเหนือ)',
      court: 'ศาลแขวงพระนครเหนือ บัลลังก์ 3',
      plaintiff: 'ธนาคารกรุงสยาม',
      defendant: 'นายสมพร มีชัย',
      responsiblePerson: 'นิติกร ปิยวัฒน์',
      hearingTime: '09:30 น.',
      status: 'pending',
      judgmentSummary: 'เตรียมนัดฟังคำพิพากษาพรุ่งนี้เช้า',
      transferredToAppealTracker: false,
      notes: 'เตรียมประสานงานเจ้าหน้าที่ศาลเพื่อคัดสำเนาคำพิพากษา',
      createdAt: '2026-10-01T16:00:00Z',
    }
  ];
}
