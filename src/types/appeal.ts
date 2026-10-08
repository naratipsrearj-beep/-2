export type AppealUrgency = 'overdue' | 'critical' | 'warning' | 'normal' | 'completed' | 'pending_trial';

export type CaseCompletionReason = 
  | 'appealed'        // ยื่นอุทธรณ์แล้ว
  | 'no_appeal'       // มีคำสั่งไม่อุทธรณ์ / ยุติ
  | 'finalized'       // คดีถึงที่สุดแล้ว
  | 'settled'         // คู่ความตกลงยอมความกันได้
  | 'other';          // อื่นๆ

export type CourtAppointmentType = 
  | 'none'                  // ไม่มีนัด
  | 'rights_protection'     // นัดคุ้มครองสิทธิ
  | 'investigation'         // นัดสืบเสาะ
  | 'judgment'              // นัดฟังคำพิพากษา / คำสั่ง
  | 'mediation'             // นัดไกล่เกลี่ย
  | 'pre_trial'             // นัดพร้อม / ตรวจพยานหลักฐาน
  | 'witness_examination'   // นัดสืบพยาน
  | 'requisition'           // นัดเบิกฟ้อง / สำนวนเบิกฟ้อง
  | 'other';                // นัดอื่นๆ

export interface CaseAppointment {
  id: string;
  type: CourtAppointmentType;
  typeName?: string;
  date: string;               // YYYY-MM-DD
  time?: string;              // e.g. "09:00 น."
  courtRoom?: string;         // e.g. "ห้องพิจารณาคดี 802", "บัลลังก์ 5"
  notes?: string;             // เช่น "นัดสืบพยานโจทก์ 3 ปาก", "ตรวจพยานหลักฐาน"
}

export interface AppealCase {
  id: string;
  filingDate: string;           // วันที่ฟ้อง (YYYY-MM-DD) สำหรับแยกสำนวนรายวัน
  blackCaseNo: string;         // เลขคดีดำ เช่น อ.124/2567
  redCaseNo?: string;          // เลขคดีแดง เช่น อ.456/2567 (อาจยังไม่มีหากยังไม่มีคำพิพากษา)
  receivedNumberS1?: string;   // ข้อมูลเลขรับ ส.1 เช่น 124/2569 หรือ ส.1 124/2569
  filingNumberS4?: string;     // ข้อมูลเลขฟ้อง ส.4 เช่น 45/2569 หรือ ส.4 45/2569
  prosecutorName?: string;     // ชื่ออัยการเจ้าของสำนวน เช่น นายธนพล บุญเจริญ, อัยการจังหวัดประจำสำนักงาน
  court: string;               // ศาล เช่น ศาลอาญา, ศาลจังหวัดเชียงใหม่
  plaintiff: string;           // โจทก์
  defendant: string;           // จำเลย
  caseType: string;            // ประเภทคดี (อาญา, แพ่ง, ผู้บริโภค, คดีปกครอง, แรงงาน)
  
  // สถานะคำพิพากษาและคำให้การจำเลย
  hasJudgment?: boolean;       // จริง = มีคำพิพากษาแล้ว (คุมระยะเวลาอุทธรณ์ 1 เดือน), เท็จ = ยังไม่มีคำพิพากษา (อยู่ระหว่างพิจารณา/จำเลยปฏิเสธ)
  defendantPlea?: 'denied' | 'confessed' | 'pending'; // คำให้การจำเลย: ปฏิเสธ / รับสารภาพ / รอนัด

  judgmentDate?: string;       // วันที่พิพากษา (YYYY-MM-DD) (ไม่บังคับหากมีนัด/จำเลยปฏิเสธ)
  appealDeadline?: string;     // วันครบกำหนดอุทธรณ์ 1 เดือน (YYYY-MM-DD) (คำนวณเมื่อมีคำพิพากษา)
  extendedDeadline?: string;   // วันที่ขอขยายเวลาอุทธรณ์ไว้ (ถ้ามี)
  extensionCount?: number;     // ขยายครั้งที่
  isCompleted: boolean;        // สถานะ: เสร็จสิ้นแล้วหรือไม่ (ถ้าจริง จะหยุดเตือนทันที)
  completedDate?: string;      // วันที่กดเสร็จสิ้น
  completionReason?: CaseCompletionReason;
  judgmentOutcome?: string;    // ผลคำพิพากษาโดยย่อ (เช่น ยกฟ้อง, ลงโทษตามฟ้อง, จำคุก 2 ปี)
  responsiblePerson: string;   // อัยการเจ้าของสำนวน
  notes?: string;              // หมายเหตุเพิ่มเติม
  
  // สำนวนเบิกฟ้อง และวันนัดเบิกฟ้อง
  isRequisitionCase?: boolean;        // เป็นสำนวนเบิกฟ้องหรือไม่
  requisitionDate?: string;          // วันที่เบิกฟ้อง (YYYY-MM-DD)
  requisitionNotes?: string;         // หมายเหตุการเบิกฟ้อง เช่น เบิกตัวจากเรือนจำ

  // สำนวนที่ศาลแยกฟ้อง (Severed / Split Prosecution Case)
  isSeveredCase?: boolean;           // เป็นสำนวนที่ศาลสั่งแยกฟ้องหรือไม่
  severedFromCaseId?: string;        // ID ของสำนวนคดีเดิมที่ถูกศาลสั่งแยกฟ้อง
  originalBlackCaseNo?: string;      // เลขคดีดำเดิมที่ศาลสั่งแยกฟ้อง เช่น อ.120/2569
  originalRedCaseNo?: string;        // เลขคดีแดงเดิม (ถ้ามี)
  originalReceivedNumberS1?: string;// เลขรับ ส.1 ของสำนวนเดิม
  originalFilingNumberS4?: string;  // เลขฟ้อง ส.4 ของสำนวนเดิม
  severedOrderDate?: string;         // วันที่ศาลมีคำสั่งให้แยกฟ้อง
  severedDeadlineDate?: string;      // กำหนดเวลายื่นฟ้องใหม่ตามคำสั่งศาล (เช่น ภายใน 15 วัน)
  severedNotes?: string;             // หมายเหตุการแยกฟ้อง เช่น จำเลยที่ 2 ให้การปฏิเสธ ศาลสั่งให้แยกฟ้อง

  // นัดของศาลในสำนวน (นัดแรก / นัดปัจจุบัน เช่น นัดคุ้มครองสิทธิ)
  appointmentType?: CourtAppointmentType;
  appointmentTypeName?: string;        // ชื่อระบุกรณีเลือก "นัดอื่นๆ"
  appointmentDate?: string;            // วันที่นัด (YYYY-MM-DD)
  appointmentTime?: string;            // เวลานัด เช่น 09:00 น.
  appointmentCourtRoom?: string;       // ห้องพิจารณา/บัลลังก์
  appointmentNotes?: string;           // รายละเอียดของนัด

  // รายการวันนัดต่อๆ ไป (Subsequent Court Appointments)
  subsequentAppointments?: CaseAppointment[];

  sheetRowIndex?: number;      // ตำแหน่งแถวใน Google Sheets (ถ้าเชื่อมต่อ)
  googleCalendarEventId?: string; // รหัสนัดหมายใน Google Calendar
  googleDocId?: string;        // รหัสเอกสาร Google Docs
  googleDocUrl?: string;       // ลิงก์เปิด Google Docs
  fullJudgmentText?: string;   // เนื้อหาคำพิพากษาฉบับเต็มที่กรอกลง Google Docs
  
  // การตรวจทานและภาพถ่ายคำพิพากษา
  judgmentPhotoUrl?: string | null;     // ภาพถ่ายคำพิพากษา (data URL / object URL)
  judgmentPhotoName?: string;          // ชื่อไฟล์ภาพถ่าย
  judgmentVerified?: boolean;          // ยืนยันการตรวจทานแล้วหรือไม่
  judgmentVerifiedBy?: string;         // ผู้ตรวจทานคำพิพากษา
  judgmentRecheckNotes?: string;       // บันทึกการตรวจทาน
  
  createdAt: string;
  updatedAt: string;
}

export interface DailyFilingDocConfig {
  filingDate: string;
  docId: string;
  docTitle: string;
  docUrl: string;
  lastUpdatedAt: string;
}

export type FollowUpStatus = 
  | 'pending'            // รอฟังคำพิพากษา
  | 'delivered'          // ศาลอ่านคำพิพากษาแล้ว
  | 'postponed'          // เลื่อนนัดอ่านคำพิพากษา
  | 'completed';         // ดำเนินการเรียบร้อย

export interface DailyJudgmentFollowUp {
  id: string;
  followUpDate: string;         // วันที่ต้องตามคำพิพากษา (YYYY-MM-DD)
  caseNumber: string;           // เลขคดีดำ/แดง
  court: string;                // ศาล
  plaintiff: string;            // โจทก์
  defendant: string;            // จำเลย
  responsiblePerson: string;    // ผู้รับผิดชอบ/เจ้าหน้าที่
  hearingTime?: string;         // เวลา เช่น 09:00 น.
  status: FollowUpStatus;       // สถานะ
  judgmentSummary?: string;     // ผลคำพิพากษาหรือผลการติดตาม
  appointmentType?: CourtAppointmentType; // นัดคุ้มครองสิทธิ, สืบเสาะ หรืออื่นๆ
  appointmentTypeName?: string;        // ระบุกรณีเลือกอื่นๆ
  appointmentDate?: string;            // วันที่นัด
  transferredToAppealTracker?: boolean; // ส่งต่อไปยังระบบคุมอุทธรณ์แล้วหรือยัง
  notes?: string;               // หมายเหตุ
  judgmentPhotoUrl?: string | null;     // ภาพถ่ายคำพิพากษา (data URL / object URL)
  judgmentPhotoName?: string;          // ชื่อไฟล์ภาพถ่าย
  judgmentVerified?: boolean;          // ยืนยันการตรวจทานแล้วหรือไม่
  judgmentVerifiedBy?: string;         // ผู้ตรวจทานคำพิพากษา
  judgmentRecheckNotes?: string;       // บันทึกการตรวจทาน
  sheetRowIndex?: number;
  createdAt: string;
}

export interface SheetConfig {
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  lastSyncedAt?: string;
}

// ==================== ตารางเวรชี้ (Duty Roster) ====================
export interface DutyOfficerEntry {
  name: string;                // ชื่อ-สกุล เช่น "นายสมชาย นิติการ"
  role?: string;               // เช่น "อัยการเวรชี้ 1", "อัยการเวรชี้ 2", "นิติกรเวร"
  courtRoom?: string;          // เช่น "ห้องพิจารณาคดี 8", "บัลลังก์ 4"
  session?: string;            // เช่น "เช้า", "บ่าย", "ตลอดวัน"
  contact?: string;            // เบอร์โทรศัพท์ / โทรภายใน
  notes?: string;              // หมายเหตุ เช่น "สลับเวรกับนาย...", "แทน"
}

export interface DailyDutyRecord {
  id: string;
  date: string;                // YYYY-MM-DD เช่น "2026-10-02"
  dayOfWeek?: string;          // เช่น "วันศุกร์"
  isHoliday?: boolean;         // วันหยุดราชการ / ศาลปิดทำการ
  holidayName?: string;        // เช่น "วันปิยมหาราช"
  dutyType?: string;           // เช่น "เวรชี้สองฝ่าย", "เวรชี้คดี", "เวรศาล"
  officers: DutyOfficerEntry[];// รายชื่อผู้เป็นเวรชี้ในวันนั้น
  notes?: string;              // หมายเหตุประจำวัน
}

export interface MonthlyDutyRoster {
  id: string;                  // รหัสประจำตารางเวร เช่น "roster_2026_10"
  monthYear: string;           // รหัสเดือน เช่น "2026-10"
  monthNameThai: string;       // ชื่อเดือนภาษาไทย เช่น "ตุลาคม 2569"
  title: string;               // หัวข้อตาราง เช่น "ตารางเวรชี้คดีและเวรศาล ประจำเดือนตุลาคม 2569"
  uploadedFileName?: string;   // ชื่อไฟล์ PDF / ภาพต้นฉบับ
  uploadedAt: string;          // วันที่และเวลาที่อัปโหลด/วิเคราะห์
  totalDays: number;           // จำนวนวันในตาราง
  duties: DailyDutyRecord[];   // ข้อมูลเวรชี้แต่ละวัน
  notes?: string;              // ข้อกำหนดทั่วไปหรือคำแนะนำจากตารางเวร
}
