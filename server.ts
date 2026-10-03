import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Support large base64 uploads for multi-page PDFs and high-resolution images
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ extended: true, limit: '30mb' }));

  // Initialize shared Gemini client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', hasGeminiKey: Boolean(apiKey) });
  });

  // POST /api/analyze-duty-roster: Multimodal extraction of Thai Court/Prosecutor Duty Roster from PDF or Image
  app.post('/api/analyze-duty-roster', async (req, res) => {
    try {
      const { fileData, mimeType, fileName, requestedMonth } = req.body;

      if (!fileData) {
        return res.status(400).json({ error: 'ไม่พบข้อมูลไฟล์ (fileData)' });
      }

      if (!mimeType) {
        return res.status(400).json({ error: 'ไม่พบประเภทไฟล์ (mimeType)' });
      }

      if (!apiKey) {
        return res.status(500).json({
          error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์ กรุณาตรวจสอบการตั้งค่า Secrets ใน AI Studio',
        });
      }

      // Clean base64 data if it contains data URI prefix
      const cleanBase64 = fileData.replace(/^data:[^;]+;base64,/, '');

      const promptText = `คุณเป็นผู้เชี่ยวชาญด้านงานสารบบคดีและธุรการศาลไทย กรุณาวิเคราะห์เอกสารภาพหรือ PDF ตารางเวรนี้อย่างละเอียด

เป้าหมาย:
1. วิเคราะห์ว่าเป็นตารางเวรชี้คดี / ตารางเวรศาล / ตารางเวรประจำวัน / บัญชีรายชื่อเวร ของรอบเดือนใด (เช่น "ตุลาคม 2569", "พฤศจิกายน 2569")
${requestedMonth ? `ผู้ใช้ระบุเดือนที่ต้องการตรวจสอบเพิ่มเติม: "${requestedMonth}"` : ''}
2. สกัดข้อมูลว่าในแต่ละวัน ใครเป็น "เวรชี้" (ชื่อ-นามสกุล, ตำแหน่ง/บทบาท เช่น อัยการเวรชี้ 1, อัยการเวรชี้ 2, ห้องพิจารณาคดี/บัลลังก์, รอบเวลาเช้าหรือบ่าย, หมายเหตุหรือการแทนเวร)
3. สำหรับวันหยุดราชการหรือเสาร์-อาทิตย์ ให้ระบุ isHoliday: true พร้อมชื่อวันหยุด (holidayName)
4. แปลงปี พ.ศ. เป็น ค.ศ. สำหรับฟิลด์ date (รูปแบบ YYYY-MM-DD เสมอ เช่น วันที่ 5 ตุลาคม 2569 -> "2026-10-05", 2568 -> 2025, 2567 -> 2024)
5. ระบุข้อกำหนด คำสั่ง หรือหมายเหตุสำคัญของตารางเวร เช่น เวลาปฏิบัติงาน หรือเงื่อนไขการสลับเวร

ชื่อไฟล์ที่อัปโหลด: ${fileName || 'เอกสารตารางเวร'}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64,
            },
          },
          {
            text: promptText,
          },
        ],
        config: {
          systemInstruction: `คุณคือระบบ AI ผู้เชี่ยวชาญการอ่านเอกสารทางกฎหมายและตารางเวรของศาลและสำนักงานอัยการในประเทศไทย
หน้าที่ของคุณคืออ่านเอกสารตารางเวรชี้คดี (Duty Roster) ไม่ว่าจะเป็นไฟล์รูปภาพหรือไฟล์ PDF ที่อาจมีรูปแบบเป็นตาราง ปฏิทิน รายชื่อประจำวัน หรือบันทึกข้อความ
สกัดข้อมูลอย่างแม่นยำ ครบถ้วนทุกวันที่มีในเอกสาร และแปลงปีเป็น ค.ศ. ในรูปแบบ YYYY-MM-DD เสมอ`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              monthYear: {
                type: Type.STRING,
                description: 'เดือนและปีในรูปแบบ YYYY-MM เช่น 2026-10 หรือ 2026-11',
              },
              monthNameThai: {
                type: Type.STRING,
                description: 'ชื่อเดือนและปีภาษาไทย เช่น ตุลาคม 2569',
              },
              title: {
                type: Type.STRING,
                description: 'ชื่อหรือหัวข้อตารางเวร เช่น ตารางเวรชี้คดีและเวรศาล ประจำเดือนตุลาคม 2569',
              },
              totalDays: {
                type: Type.INTEGER,
                description: 'จำนวนวันทั้งหมดที่มีข้อมูลในตาราง',
              },
              notes: {
                type: Type.STRING,
                description: 'ข้อกำหนดทั่วไป คำสั่ง หรือหมายเหตุท้ายตารางเวร',
              },
              duties: {
                type: Type.ARRAY,
                description: 'รายการเวรชี้แต่ละวันในเดือน',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: {
                      type: Type.STRING,
                      description: 'วันที่ในรูปแบบ YYYY-MM-DD เช่น 2026-10-02',
                    },
                    dayOfWeek: {
                      type: Type.STRING,
                      description: 'วันในสัปดาห์ เช่น วันจันทร์, วันอังคาร, วันศุกร์',
                    },
                    isHoliday: {
                      type: Type.BOOLEAN,
                      description: 'เป็นวันหยุดราชการหรือไม่มีเวรชี้หรือไม่',
                    },
                    holidayName: {
                      type: Type.STRING,
                      description: 'ชื่อวันหยุด (ถ้ามี)',
                    },
                    dutyType: {
                      type: Type.STRING,
                      description: 'ประเภทเวร เช่น เวรชี้สองฝ่าย, เวรชี้คดีอาญา, เวรศาล',
                    },
                    officers: {
                      type: Type.ARRAY,
                      description: 'รายชื่อเจ้าหน้าที่/อัยการที่เป็นเวรชี้ในวันนั้น',
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: {
                            type: Type.STRING,
                            description: 'ชื่อ-นามสกุล ของเวรชี้',
                          },
                          role: {
                            type: Type.STRING,
                            description: 'ตำแหน่งหรือบทบาท เช่น อัยการเวรชี้ 1, อัยการเวรชี้ 2, นิติกร',
                          },
                          courtRoom: {
                            type: Type.STRING,
                            description: 'ห้องพิจารณาคดีหรือบัลลังก์ศาล (ถ้ามีระบุ)',
                          },
                          session: {
                            type: Type.STRING,
                            description: 'รอบเวลา เช่น เช้า, บ่าย, ตลอดวัน',
                          },
                          contact: {
                            type: Type.STRING,
                            description: 'เบอร์ติดต่อภายในหรือเบอร์โทรศัพท์ (ถ้ามี)',
                          },
                          notes: {
                            type: Type.STRING,
                            description: 'หมายเหตุเฉพาะบุคคล เช่น สลับเวรกับ..., ปฏิบัติหน้าที่แทน',
                          },
                        },
                        required: ['name'],
                      },
                    },
                    notes: {
                      type: Type.STRING,
                      description: 'หมายเหตุประจำวัน',
                    },
                  },
                  required: ['date', 'officers'],
                },
              },
            },
            required: ['monthYear', 'monthNameThai', 'title', 'duties'],
          },
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error('ไม่ได้รับข้อมูลผลลัพธ์จาก Gemini AI');
      }

      const parsedData = JSON.parse(text);

      const rosterId = `roster_${parsedData.monthYear.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
      const finalRoster = {
        id: rosterId,
        monthYear: parsedData.monthYear,
        monthNameThai: parsedData.monthNameThai || 'ตารางเวรชี้',
        title: parsedData.title || `ตารางเวรชี้ประจำเดือน ${parsedData.monthNameThai || ''}`,
        uploadedFileName: fileName || 'ไฟล์ตารางเวร',
        uploadedAt: new Date().toISOString(),
        totalDays: parsedData.totalDays || (parsedData.duties ? parsedData.duties.length : 0),
        notes: parsedData.notes || '',
        duties: (parsedData.duties || []).map((duty: any, idx: number) => ({
          id: `duty_${duty.date || idx}_${idx}`,
          date: duty.date,
          dayOfWeek: duty.dayOfWeek || '',
          isHoliday: Boolean(duty.isHoliday),
          holidayName: duty.holidayName || '',
          dutyType: duty.dutyType || 'เวรชี้คดี',
          officers: (duty.officers || []).map((o: any) => ({
            name: o.name || '',
            role: o.role || '',
            courtRoom: o.courtRoom || '',
            session: o.session || 'ตลอดวัน',
            contact: o.contact || '',
            notes: o.notes || '',
          })),
          notes: duty.notes || '',
        })),
      };

      return res.json({ success: true, roster: finalRoster });
    } catch (err: any) {
      console.error('Error analyzing duty roster:', err);
      return res.status(500).json({
        error: `เกิดข้อผิดพลาดในการวิเคราะห์ตารางเวรชี้: ${err.message || String(err)}`,
      });
    }
  });

  // Serve static assets or mount Vite in development
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Duty Tracker Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
