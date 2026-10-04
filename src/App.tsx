import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  Scale,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  FolderOpen,
  Filter,
  Layers,
  Sparkles,
  Download,
  CalendarCheck,
  UserCheck,
  Eye,
  ShieldAlert,
  Users
} from 'lucide-react';

import { AppealCase, DailyJudgmentFollowUp, SheetConfig, CaseCompletionReason, MonthlyDutyRoster, DailyDutyRecord } from './types/appeal';
import { initAuth, googleSignIn, logout, getAccessToken } from './services/auth';
import {
  fetchAppealCases,
  appendAppealCase,
  updateAppealCaseInSheet,
  fetchDailyFollowUps,
  appendFollowUpToSheet,
  updateFollowUpInSheet,
} from './services/sheetsService';
import { createAppealCalendarEvent } from './services/calendarService';
import {
  getSavedCases,
  saveCases,
  getSavedFollowUps,
  saveFollowUps,
  getSavedSheetConfig,
  saveSheetConfig,
  getSavedDutyRosters,
  saveDutyRosters,
} from './services/storageService';
import { getTodayDuty } from './services/dutyService';
import {
  getUserRole,
  canUserEdit,
  ProjectSettings,
  PermissionRequest,
  DEFAULT_SETTINGS,
  ADMIN_EMAIL,
  subscribeToCases,
  subscribeToDutyRosters,
  subscribeToFollowUps,
  subscribeToProjectSettings,
  subscribeToPermissionRequests,
  saveCaseToFirestore,
  saveCasesBatchToFirestore,
  deleteCaseFromFirestore,
  saveDutyRosterToFirestore,
  deleteDutyRosterFromFirestore,
  saveFollowUpToFirestore,
  deleteFollowUpFromFirestore,
  requestEditPermission,
  approveEditPermission,
  rejectEditPermission,
  addAllowedEditor,
  removeAllowedEditor,
  seedInitialFirestoreDataIfEmpty,
  uploadAllLocalDataToFirestore,
} from './services/firestoreService';

import { Header } from './components/Header';
import { StatsSummary } from './components/StatsSummary';
import { UrgentAlertBanner } from './components/UrgentAlertBanner';
import { CaseTable } from './components/CaseTable';
import { DailyFilingByDateView } from './components/DailyFilingByDateView';
import { DutyRosterView } from './components/DutyRosterView';
import { UploadDutyRosterModal } from './components/UploadDutyRosterModal';
import { AddCaseModal } from './components/AddCaseModal';
import { CompleteModal } from './components/CompleteModal';
import { ExtendDeadlineModal } from './components/ExtendDeadlineModal';
import { SpreadsheetModal } from './components/SpreadsheetModal';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { VoiceSearchBar } from './components/VoiceSearchBar';
import { JudgmentDocModal } from './components/JudgmentDocModal';
import { EmailAlertModal } from './components/EmailAlertModal';
import { CourtAppointmentModal } from './components/CourtAppointmentModal';
import { EditCaseModal } from './components/EditCaseModal';
import { RecordJudgmentModal } from './components/RecordJudgmentModal';
import { LoginScreen } from './components/LoginScreen';
import { UserPermissionsModal } from './components/UserPermissionsModal';
import { RequestEditModal } from './components/RequestEditModal';
import { createDailyFilingDoc } from './services/docsService';
import { checkAndSendAutomaticEmailAlerts } from './services/gmailService';
import { CourtAppointmentType, CaseAppointment } from './types/appeal';
import { getAppointmentLabel } from './utils/appointmentUtils';

export default function App() {
  // Auth & Roles state
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Firestore Project Settings & Permissions
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS);
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequest[]>([]);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [isRequestEditModalOpen, setIsRequestEditModalOpen] = useState(false);
  const [isProcessingPermissions, setIsProcessingPermissions] = useState(false);
  const [isPushingLocal, setIsPushingLocal] = useState(false);

  // RBAC Roles: Admin (naratipsrearj@gmail.com) | Editor | Viewer
  const userRole = React.useMemo(
    () => getUserRole(user?.email, projectSettings),
    [user?.email, projectSettings]
  );
  const canEdit = React.useMemo(() => canUserEdit(userRole), [userRole]);

  // Main data state
  const [cases, setCases] = useState<AppealCase[]>([]);
  const [followUps, setFollowUps] = useState<DailyJudgmentFollowUp[]>([]);
  const [sheetConfig, setSheetConfig] = useState<SheetConfig | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Duty Rosters (ตารางเวรชี้ประจำเดือน)
  const [dutyRosters, setDutyRosters] = useState<MonthlyDutyRoster[]>([]);
  const [activeDutyRosterId, setActiveDutyRosterId] = useState<string | undefined>();
  const [isUploadDutyModalOpen, setIsUploadDutyModalOpen] = useState(false);
  const [addCaseInitialResponsiblePerson, setAddCaseInitialResponsiblePerson] = useState<string | undefined>();

  // Navigation tabs: 'all' | 'filing_date' | 'duty_roster'
  const [activeTab, setActiveTab] = useState<'all' | 'filing_date' | 'duty_roster'>('all');
  const [statsFilter, setStatsFilter] = useState<string>('all');
  const [globalVoiceQuery, setGlobalVoiceQuery] = useState<string>('');

  // Modals state
  const [isAddCaseOpen, setIsAddCaseOpen] = useState(false);
  const [addCaseInitialFilingDate, setAddCaseInitialFilingDate] = useState<string | undefined>();
  const [selectedCaseForComplete, setSelectedCaseForComplete] = useState<AppealCase | null>(null);
  const [selectedCaseForExtend, setSelectedCaseForExtend] = useState<AppealCase | null>(null);
  const [selectedCaseForJudgmentDoc, setSelectedCaseForJudgmentDoc] = useState<AppealCase | null>(null);
  const [selectedCaseForEmailAlert, setSelectedCaseForEmailAlert] = useState<AppealCase | null>(null);
  const [selectedCaseForAppointment, setSelectedCaseForAppointment] = useState<AppealCase | null>(null);
  const [selectedCaseForEdit, setSelectedCaseForEdit] = useState<AppealCase | null>(null);
  const [isEditCaseOpen, setIsEditCaseOpen] = useState(false);
  const [selectedCaseForRecordJudgment, setSelectedCaseForRecordJudgment] = useState<AppealCase | null>(null);
  const [isRecordJudgmentOpen, setIsRecordJudgmentOpen] = useState(false);
  const [sentAlertHistory, setSentAlertHistory] = useState<Record<string, { lastSentDate: string; daysLeft: number }>>(() => {
    try {
      const raw = localStorage.getItem('sent_email_alert_history');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);

  // Confirmation dialog state (Workspace skill requirement for destructive/mutating operations)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Initial Load from localStorage & Initialize Auth
  useEffect(() => {
    const loadedCases = getSavedCases();
    setCases(loadedCases);

    const loadedFollowUps = getSavedFollowUps();
    setFollowUps(loadedFollowUps);

    const loadedConfig = getSavedSheetConfig();
    setSheetConfig(loadedConfig);

    const loadedRosters = getSavedDutyRosters();
    setDutyRosters(loadedRosters);
    if (loadedRosters.length > 0) {
      setActiveDutyRosterId(loadedRosters[0].id);
    }

    // Initialize Auth Listener
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken || null);
        setAuthInitializing(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setAuthInitializing(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Real-time Firestore Subscriptions (active for all users, live sync across all devices)
  useEffect(() => {
    // 1. Real-time subscribe to all cases (all clients sync instantly)
    const unsubCases = subscribeToCases(
      (remoteCases) => {
        setCases(remoteCases);
        saveCases(remoteCases);
      },
      (err) => console.warn('Real-time cases sync error:', err)
    );

    // 2. Real-time subscribe to monthly duty rosters
    const unsubRosters = subscribeToDutyRosters(
      (remoteRosters) => {
        setDutyRosters(remoteRosters);
        saveDutyRosters(remoteRosters);
        if (!activeDutyRosterId && remoteRosters[0]) {
          setActiveDutyRosterId(remoteRosters[0].id);
        } else if (remoteRosters.length === 0) {
          setActiveDutyRosterId(undefined);
        }
      },
      (err) => console.warn('Real-time duty rosters sync error:', err)
    );

    // 3. Real-time subscribe to daily follow-ups
    const unsubFollowUps = subscribeToFollowUps(
      (remoteFollowUps) => {
        setFollowUps(remoteFollowUps);
        saveFollowUps(remoteFollowUps);
      },
      (err) => console.warn('Real-time followups sync error:', err)
    );

    // 4. Real-time subscribe to project permissions
    const unsubSettings = subscribeToProjectSettings(
      (settings) => {
        setProjectSettings(settings);
      },
      (err) => console.warn('Real-time settings sync error:', err)
    );

    // 5. Permission requests (only when user is logged in)
    let unsubRequests: (() => void) | undefined;
    if (user) {
      unsubRequests = subscribeToPermissionRequests(
        (reqs) => {
          setPermissionRequests(reqs);
        },
        (err) => console.warn('Real-time permission requests error:', err)
      );
    }

    return () => {
      unsubCases();
      unsubRosters();
      unsubFollowUps();
      unsubSettings();
      if (unsubRequests) unsubRequests();
    };
  }, [user]);

  // Seed initial sample data to cloud if admin and first time
  useEffect(() => {
    if (user && userRole === 'admin') {
      seedInitialFirestoreDataIfEmpty(
        getSavedCases(),
        getSavedDutyRosters(),
        getSavedFollowUps()
      );
    }
  }, [user, userRole]);

  // Save to localStorage whenever data changes
  useEffect(() => {
    saveCases(cases);
  }, [cases]);

  useEffect(() => {
    if (followUps.length > 0) {
      saveFollowUps(followUps);
    }
  }, [followUps]);

  useEffect(() => {
    if (dutyRosters.length > 0) {
      saveDutyRosters(dutyRosters);
    }
  }, [dutyRosters]);

  useEffect(() => {
    saveSheetConfig(sheetConfig);
  }, [sheetConfig]);

  // Compute today's duty officer from loaded duty rosters
  const todayDutyOfficer = React.useMemo(() => {
    const todayInfo = getTodayDuty(dutyRosters);
    if (!todayInfo || todayInfo.duty.isHoliday || !todayInfo.duty.officers.length) {
      return undefined;
    }
    return todayInfo.duty.officers[0]?.name;
  }, [dutyRosters]);

  // Auth Handlers
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        showToast(`ยินดีต้อนรับ ${result.user.displayName || result.user.email}`);
      }
    } catch (err: any) {
      console.error('Login error', err);
      let errorMsg = err.message || 'ไม่สามารถเข้าสู่ระบบ Google ได้ โปรดลองอีกครั้ง';
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
      
      if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain')) {
        errorMsg = `auth/unauthorized-domain: โดเมน "${currentHost}" ยังไม่ได้รับการเพิ่มใน Authorized domains ของ Firebase Console`;
      } else if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
        errorMsg = 'auth/operation-not-allowed: โปรดไปที่ Firebase Console > Authentication > Sign-in method แล้วเปิดใช้งาน (Enable) "Google"';
      } else if (err.code === 'auth/popup-blocked' || err.message?.includes('popup-blocked')) {
        errorMsg = 'auth/popup-blocked: เบราว์เซอร์ของคุณบล็อกหน้าต่างป๊อปอัป โปรดกดอนุญาตป๊อปอัป (Pop-up allowed) ที่แถบ URL ด้านบน แล้วลองอีกครั้ง';
      } else if (err.code === 'auth/popup-closed-by-user') {
        errorMsg = 'หน้าต่างเข้าสู่ระบบถูกปิดก่อนทำรายการเสร็จสิ้น โปรดลองใหม่อีกครั้ง';
      } else if (err.code === 'auth/network-request-failed') {
        errorMsg = 'การเชื่อมต่อเครือข่ายขัดข้อง โปรดตรวจสอบอินเทอร์เน็ต';
      } else {
        errorMsg = `เกิดข้อผิดพลาด (${err.code || 'error'}): ${err.message || ''}`;
      }
      
      setLoginError(errorMsg);
      showToast('ไม่สามารถเข้าสู่ระบบได้ โปรดตรวจสอบข้อความแจ้งเตือน');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    showToast('ออกจากระบบเรียบร้อยแล้ว');
  };

  // Permission Request & Management Handlers
  const handleRequestEdit = async (note: string) => {
    if (!user || !user.email) return;
    try {
      await requestEditPermission(
        {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        },
        note
      );
      showToast('ส่งคำขอสิทธิ์แก้ไขข้อมูลไปยังแอดมินแล้ว');
    } catch (err: any) {
      console.error('Request edit failed:', err);
      showToast('ส่งคำขอไม่สำเร็จ: ' + err.message);
    }
  };

  const handleApproveRequest = async (requestId: string, userEmail: string) => {
    if (!user?.email) return;
    setIsProcessingPermissions(true);
    try {
      await approveEditPermission(requestId, userEmail, projectSettings, user.email);
      showToast(`อนุมัติสิทธิ์แก้ไขให้ "${userEmail}" เรียบร้อยแล้ว`);
    } catch (err: any) {
      console.error('Approve failed:', err);
      showToast('อนุมัติไม่สำเร็จ: ' + err.message);
    } finally {
      setIsProcessingPermissions(false);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setIsProcessingPermissions(true);
    try {
      await rejectEditPermission(requestId);
      showToast('ปฏิเสธคำขอสิทธิ์เรียบร้อยแล้ว');
    } catch (err: any) {
      console.error('Reject failed:', err);
      showToast('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsProcessingPermissions(false);
    }
  };

  const handleAddEditor = async (email: string) => {
    if (!user?.email) return;
    setIsProcessingPermissions(true);
    try {
      await addAllowedEditor(email, projectSettings, user.email);
      showToast(`เพิ่มสิทธิ์แก้ไขให้ "${email}" สำเร็จ`);
    } catch (err: any) {
      console.error('Add editor failed:', err);
      showToast('ไม่สามารถเพิ่มผู้ใช้งานได้: ' + err.message);
    } finally {
      setIsProcessingPermissions(false);
    }
  };

  const handleRemoveEditor = async (email: string) => {
    if (!user?.email) return;
    setIsProcessingPermissions(true);
    try {
      await removeAllowedEditor(email, projectSettings, user.email);
      showToast(`เพิกถอนสิทธิ์ของ "${email}" เรียบร้อยแล้ว`);
    } catch (err: any) {
      console.error('Remove editor failed:', err);
      showToast('ไม่สามารถเพิกถอนสิทธิ์ได้: ' + err.message);
    } finally {
      setIsProcessingPermissions(false);
    }
  };

  // Push all local data from this machine to Firestore
  const handlePushLocalToCloud = async () => {
    if (!user || userRole !== 'admin') return;
    setIsPushingLocal(true);
    try {
      const res = await uploadAllLocalDataToFirestore(cases, dutyRosters, followUps);
      showToast(`ส่งข้อมูลขึ้น Cloud สำเร็จ (${res.casesCount} สำนวน, ${res.rostersCount} ตารางเวร, ${res.followUpsCount} รายการตามคำพิพากษา)`);
    } catch (err: any) {
      console.error('Push to cloud error:', err);
      showToast(`ส่งข้อมูลไม่สำเร็จ: ${err.message}`);
    } finally {
      setIsPushingLocal(false);
    }
  };

  // Synchronize live with Google Sheets
  const handleSyncWithSheet = async () => {
    if (!sheetConfig) {
      setIsSheetModalOpen(true);
      return;
    }
    const currentToken = token || (await getAccessToken());
    if (!currentToken) {
      showToast('โปรดเข้าสู่ระบบ Google เพื่อซิงค์กับ Google Sheets');
      handleLogin();
      return;
    }

    setIsSyncing(true);
    try {
      // 1. ดึงสำนวนคุมอุทธรณ์
      const remoteCases = await fetchAppealCases(currentToken, sheetConfig.spreadsheetId);
      if (remoteCases.length > 0) {
        setCases(remoteCases);
        saveCases(remoteCases);
      }

      // 2. ดึงรายการติดตามคำพิพากษารายวัน
      const remoteFollowUps = await fetchDailyFollowUps(currentToken, sheetConfig.spreadsheetId);
      if (remoteFollowUps.length > 0) {
        setFollowUps(remoteFollowUps);
        saveFollowUps(remoteFollowUps);
      }

      setSheetConfig({
        ...sheetConfig,
        lastSyncedAt: new Date().toISOString(),
      });

      showToast('ซิงค์ข้อมูลกับ Google Sheets สำเร็จเรียบร้อย');
    } catch (err: any) {
      console.error('Sync failed', err);
      showToast(`การซิงค์ขัดข้อง: ${err.message || 'กรุณาลองใหม่อีกครั้ง'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Add new appeal case
  const handleSaveNewCase = async (
    caseData: Omit<AppealCase, 'id' | 'createdAt' | 'updatedAt'>,
    saveToCalendar: boolean
  ) => {
    const newId = `case_${Date.now()}`;
    const newCase: AppealCase = {
      ...caseData,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update state immediately
    const updated = [newCase, ...cases];
    setCases(updated);
    saveCases(updated);
    saveCaseToFirestore(newCase).catch((e) => console.warn('Firestore save case error:', e));
    showToast(`เพิ่มสำนวนดำ ${newCase.blackCaseNo} ครบกำหนด 1 เดือนเรียบร้อยแล้ว`);

    // Synchronize to Google Sheets if connected
    const currentToken = token || (await getAccessToken());
    if (sheetConfig && currentToken) {
      try {
        const nextIndex = cases.length + 1;
        const rowIndex = await appendAppealCase(currentToken, sheetConfig.spreadsheetId, newCase, nextIndex);
        // update rowIndex locally
        setCases((prev) =>
          prev.map((c) => (c.id === newId ? { ...c, sheetRowIndex: rowIndex } : c))
        );
      } catch (err) {
        console.error('Failed to append case to Google Sheet', err);
      }
    }

    // Add to Google Calendar if requested
    if (saveToCalendar && currentToken) {
      try {
        const eventId = await createAppealCalendarEvent(currentToken, newCase);
        setCases((prev) =>
          prev.map((c) => (c.id === newId ? { ...c, googleCalendarEventId: eventId } : c))
        );
        showToast('เพิ่มการแจ้งเตือนลงใน Google Calendar เรียบร้อยแล้ว');
      } catch (err: any) {
        console.error('Calendar error', err);
      }
    }
  };

  // Mark Case as Complete (CRITICAL requirement: สำนวนที่เสร็จสิ้นแล้วไม่ต้องแจ้งเตือนอีกต่อไป)
  const handleConfirmComplete = async (
    caseId: string,
    reason: CaseCompletionReason,
    completedDate: string,
    notes?: string
  ) => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return;

    const updatedCase: AppealCase = {
      ...targetCase,
      isCompleted: true, // ปิดการแจ้งเตือนถาวร!
      completedDate,
      completionReason: reason,
      notes: notes || targetCase.notes,
      updatedAt: new Date().toISOString(),
    };

    const newCases = cases.map((c) => (c.id === caseId ? updatedCase : c));
    setCases(newCases);
    saveCases(newCases);
    saveCaseToFirestore(updatedCase).catch((e) => console.warn('Firestore update case error:', e));

    showToast(`สำนวน ${targetCase.blackCaseNo} บันทึกเสร็จสิ้นแล้ว (หยุดการแจ้งเตือน)`);

    // Update in Google Sheet if connected
    const currentToken = token || (await getAccessToken());
    if (sheetConfig && currentToken && updatedCase.sheetRowIndex) {
      try {
        await updateAppealCaseInSheet(currentToken, sheetConfig.spreadsheetId, updatedCase);
      } catch (err) {
        console.error('Failed to update Google Sheet', err);
      }
    }
  };

  // Reopen Case if marked complete by mistake
  const handleReopenCase = async (caseId: string) => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return;

    const updatedCase: AppealCase = {
      ...targetCase,
      isCompleted: false, // กลับมาแจ้งเตือนใหม่
      completedDate: undefined,
      completionReason: undefined,
      updatedAt: new Date().toISOString(),
    };

    const newCases = cases.map((c) => (c.id === caseId ? updatedCase : c));
    setCases(newCases);
    saveCases(newCases);
    saveCaseToFirestore(updatedCase).catch((e) => console.warn('Firestore reopen error:', e));
    showToast(`เปิดสำนวน ${targetCase.blackCaseNo} ใหม่ (เริ่มการติดตามและแจ้งเตือนอีกครั้ง)`);

    const currentToken = token || (await getAccessToken());
    if (sheetConfig && currentToken && updatedCase.sheetRowIndex) {
      try {
        await updateAppealCaseInSheet(currentToken, sheetConfig.spreadsheetId, updatedCase);
      } catch (err) {
        console.error('Failed to update sheet', err);
      }
    }
  };

  // Extend Deadline
  const handleConfirmExtend = async (
    caseId: string,
    newDeadline: string,
    extensionCount: number,
    notes?: string
  ) => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return;

    const updatedCase: AppealCase = {
      ...targetCase,
      extendedDeadline: newDeadline,
      extensionCount,
      notes: notes ? `${targetCase.notes || ''} | ${notes}` : targetCase.notes,
      updatedAt: new Date().toISOString(),
    };

    const newCases = cases.map((c) => (c.id === caseId ? updatedCase : c));
    setCases(newCases);
    saveCases(newCases);
    saveCaseToFirestore(updatedCase).catch((e) => console.warn('Firestore extend error:', e));
    showToast(`ขยายเวลาอุทธรณ์สำนวน ${targetCase.blackCaseNo} ถึง ${newDeadline} เรียบร้อยแล้ว`);

    const currentToken = token || (await getAccessToken());
    if (sheetConfig && currentToken && updatedCase.sheetRowIndex) {
      try {
        await updateAppealCaseInSheet(currentToken, sheetConfig.spreadsheetId, updatedCase);
      } catch (err) {
        console.error('Failed to update sheet', err);
      }
    }
  };

  // Delete Case with confirmation modal (MANDATORY per Workspace skill destructive operation rule)
  const handleDeleteCase = (caseId: string) => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return;

    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันการลบสำนวนคุมอุทธรณ์',
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบสำนวนคดีดำ ${targetCase.blackCaseNo} (แดง ${targetCase.redCaseNo}) ออกจากระบบ? การกระทำนี้ไม่สามารถย้อนกลับได้`,
      confirmText: 'ลบสำนวน',
      isDestructive: true,
      onConfirm: () => {
        const remaining = cases.filter((c) => c.id !== caseId);
        setCases(remaining);
        saveCases(remaining);
        deleteCaseFromFirestore(caseId).catch((e) => console.warn('Firestore delete error:', e));
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        showToast(`ลบสำนวน ${targetCase.blackCaseNo} เรียบร้อยแล้ว`);
      },
    });
  };

  // Calendar quick sync
  const handleSyncCalendarSingle = async (caseItem: AppealCase) => {
    const currentToken = token || (await getAccessToken());
    if (!currentToken) {
      showToast('โปรดเข้าสู่ระบบ Google เพื่อเพิ่มลง Google Calendar');
      handleLogin();
      return;
    }

    try {
      const eventId = await createAppealCalendarEvent(currentToken, caseItem);
      const newCases = cases.map((c) => (c.id === caseItem.id ? { ...c, googleCalendarEventId: eventId } : c));
      setCases(newCases);
      saveCases(newCases);
      showToast(`เพิ่มการแจ้งเตือนสำนวน ${caseItem.blackCaseNo} ลงใน Google Calendar เรียบร้อยแล้ว`);
    } catch (err: any) {
      showToast(`ไม่สามารถเพิ่มปฏิทินได้: ${err.message || 'เกิดข้อผิดพลาด'}`);
    }
  };

  // Google Docs Handlers for Daily Cases & Judgments
  const handleSaveJudgment = (caseId: string, judgmentText: string, docUrl?: string, docId?: string) => {
    const updated = cases.map((c) =>
      c.id === caseId
        ? {
            ...c,
            fullJudgmentText: judgmentText,
            googleDocUrl: docUrl || c.googleDocUrl,
            googleDocId: docId || c.googleDocId,
            updatedAt: new Date().toISOString(),
          }
        : c
    );
    setCases(updated);
    saveCases(updated);
    showToast('บันทึกคำพิพากษาและเชื่อมโยง Google Docs เรียบร้อยแล้ว');
  };

  const handleExportDailyDoc = async (filingDate: string, casesInGroup: AppealCase[]) => {
    const currentToken = token || (await getAccessToken());
    if (!currentToken) {
      showToast('โปรดเข้าสู่ระบบ Google เพื่อสร้าง Google Docs');
      handleLogin();
      return;
    }

    try {
      showToast('กำลังสร้างเอกสาร Google Docs สำหรับคดีที่ฟ้องในวันนี้...');
      const result = await createDailyFilingDoc(currentToken, filingDate, casesInGroup);
      showToast(`สร้างเอกสาร Google Docs สำเร็จ: "${result.docTitle}"`);
      // Update googleDocUrl for these cases
      const updated = cases.map((c) =>
        c.filingDate === filingDate
          ? {
              ...c,
              googleDocUrl: c.googleDocUrl || result.docUrl,
              googleDocId: c.googleDocId || result.docId,
            }
          : c
      );
      setCases(updated);
      saveCases(updated);
      window.open(result.docUrl, '_blank');
    } catch (err: any) {
      console.error('Failed to create daily filing doc', err);
      showToast(`เกิดข้อผิดพลาดในการสร้าง Google Doc: ${err.message}`);
    }
  };

  // Email Alert Handlers (3 days & 1 day in advance)
  const handleSendAllUrgentEmails = async () => {
    const currentToken = token || (await getAccessToken());
    if (!currentToken) {
      showToast('โปรดเข้าสู่ระบบ Google เพื่อส่งอีเมลแจ้งเตือนผ่าน Gmail');
      handleLogin();
      return;
    }

    const emailToSend = user?.email || 'naratipsrearj@gmail.com';
    showToast('กำลังตรวจสอบและส่งอีเมลแจ้งเตือนคดีใกล้ครบกำหนด (3 วัน / 1 วัน)...');

    try {
      const result = await checkAndSendAutomaticEmailAlerts(
        currentToken,
        emailToSend,
        cases,
        sentAlertHistory
      );

      setSentAlertHistory(result.updatedHistory);
      localStorage.setItem('sent_email_alert_history', JSON.stringify(result.updatedHistory));

      if (result.sentCount > 0) {
        showToast(`ส่งอีเมลแจ้งเตือนสำเร็จ ${result.sentCount} คดี ไปยัง ${emailToSend}`);
      } else {
        showToast('ไม่มีคดีใหม่ที่ตรงเงื่อนไขเตือน 3 วัน / 1 วันในวันนี้ หรือได้ส่งไปแล้ว');
      }
    } catch (err: any) {
      console.error('Failed to send email alerts', err);
      showToast(`การส่งอีเมลขัดข้อง: ${err.message || 'โปรดลองใหม่อีกครั้ง'}`);
    }
  };

  // Court Appointment Handlers (นัดคุ้มครองสิทธิ, สืบเสาะ หรืออื่นๆ)
  const handleSaveAppointment = async (
    caseId: string,
    appointmentData: {
      appointmentType: CourtAppointmentType;
      appointmentTypeName?: string;
      appointmentDate?: string;
      appointmentTime?: string;
      appointmentCourtRoom?: string;
      appointmentNotes?: string;
      subsequentAppointments?: CaseAppointment[];
    },
    syncToCalendar?: boolean
  ) => {
    const updated = cases.map((c) =>
      c.id === caseId
        ? {
            ...c,
            ...appointmentData,
            updatedAt: new Date().toISOString(),
          }
        : c
    );
    setCases(updated);
    saveCases(updated);

    const targetCase = updated.find((c) => c.id === caseId);
    if (targetCase) {
      saveCaseToFirestore(targetCase).catch((e) => console.warn('Firestore appointment error:', e));
    }
    showToast(`บันทึกขั้นตอนนัดของศาลสำหรับสำนวน ${targetCase?.blackCaseNo || ''} เรียบร้อยแล้ว`);

    // Update in Google Sheet if connected
    const currentToken = token || (await getAccessToken());
    if (sheetConfig && currentToken && targetCase && targetCase.sheetRowIndex) {
      try {
        await updateAppealCaseInSheet(currentToken, sheetConfig.spreadsheetId, targetCase);
      } catch (err) {
        console.error('Failed to update Google Sheet', err);
      }
    }

    if (syncToCalendar && appointmentData.appointmentDate && targetCase) {
      if (currentToken) {
        try {
          const apptLabel = getAppointmentLabel(appointmentData.appointmentType, appointmentData.appointmentTypeName);
          await createAppealCalendarEvent(currentToken, {
            ...targetCase,
            appealDeadline: appointmentData.appointmentDate,
            notes: `[นัดศาล: ${apptLabel}] ${appointmentData.appointmentNotes || ''}`,
          });
          showToast(`บันทึกวันนัดลงใน Google Calendar เรียบร้อยแล้ว`);
        } catch (err: any) {
          console.error('Failed to sync appointment to calendar', err);
        }
      }
    }
  };

  // Edit / Update Case Handlers (สำหรับเพิ่มเติมหรือแก้ไขข้อมูลสำนวนคดีที่ฟ้องในแต่ละวัน)
  const handleSaveEditedCase = async (updatedCase: AppealCase) => {
    const newCases = cases.map((c) => (c.id === updatedCase.id ? updatedCase : c));
    setCases(newCases);
    saveCases(newCases);
    saveCaseToFirestore(updatedCase).catch((e) => console.warn('Firestore update case error:', e));
    showToast(`บันทึกการแก้ไขข้อมูลสำนวน ${updatedCase.blackCaseNo} เรียบร้อยแล้ว`);

    // Update in Google Sheet if connected
    const currentToken = token || (await getAccessToken());
    if (sheetConfig && currentToken && updatedCase.sheetRowIndex) {
      try {
        await updateAppealCaseInSheet(currentToken, sheetConfig.spreadsheetId, updatedCase);
      } catch (err) {
        console.error('Failed to update Google Sheet', err);
      }
    }
  };

  // Quick Assign Duty Officer to Case (กำหนดเวรชี้ให้คดีจากตารางเวรชี้ประจำเดือน)
  const handleQuickAssignOfficer = async (caseId: string, officerName: string) => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return;

    const updatedCase: AppealCase = {
      ...targetCase,
      prosecutorName: officerName,
      responsiblePerson:
        targetCase.responsiblePerson && targetCase.responsiblePerson !== 'ผู้ดูแลสำนวน'
          ? targetCase.responsiblePerson
          : officerName,
      updatedAt: new Date().toISOString(),
    };

    const newCases = cases.map((c) => (c.id === caseId ? updatedCase : c));
    setCases(newCases);
    saveCases(newCases);
    saveCaseToFirestore(updatedCase).catch((e) => console.warn('Firestore assign officer error:', e));
    showToast(`กำหนดเวรชี้ "${officerName}" ให้สำนวนคดีดำ ${targetCase.blackCaseNo} เรียบร้อยแล้ว`);

    const currentToken = token || (await getAccessToken());
    if (sheetConfig && currentToken && updatedCase.sheetRowIndex) {
      try {
        await updateAppealCaseInSheet(currentToken, sheetConfig.spreadsheetId, updatedCase);
      } catch (err) {
        console.error('Failed to update officer in Google Sheet', err);
      }
    }
  };

  // Batch Assign Duty Officer to All Cases filed on Date that lack a prosecutor
  const handleBatchAssignOfficerToDate = async (filingDate: string, officerName: string) => {
    const unassignedCases = cases.filter(
      (c) => c.filingDate === filingDate && (!c.prosecutorName || !c.prosecutorName.trim())
    );
    if (unassignedCases.length === 0) {
      showToast('ทุกสำนวนในวันนี้มีชื่ออัยการเจ้าของสำนวน/เวรชี้แล้ว');
      return;
    }

    const updatedCases = cases.map((c) => {
      if (c.filingDate === filingDate && (!c.prosecutorName || !c.prosecutorName.trim())) {
        return {
          ...c,
          prosecutorName: officerName,
          responsiblePerson:
            c.responsiblePerson && c.responsiblePerson !== 'ผู้ดูแลสำนวน'
              ? c.responsiblePerson
              : officerName,
          updatedAt: new Date().toISOString(),
        };
      }
      return c;
    });

    setCases(updatedCases);
    saveCases(updatedCases);

    const changedCases = updatedCases.filter(
      (c) => c.filingDate === filingDate && c.prosecutorName === officerName
    );
    saveCasesBatchToFirestore(changedCases).catch((e: any) =>
      console.warn('Firestore batch assign error:', e)
    );

    showToast(`เชื่อมโยงอัยการเวรชี้ "${officerName}" ให้ ${unassignedCases.length} สำนวนเรียบร้อยแล้ว`);
  };

  // Record Judgment for case transitioning from pending hearings to appeal tracking
  const handleSaveJudgmentDate = async (
    caseId: string,
    judgmentData: {
      judgmentDate: string;
      redCaseNo?: string;
      judgmentOutcome: string;
      appealDeadline: string;
    },
    syncToCalendar: boolean
  ) => {
    const target = cases.find((c) => c.id === caseId);
    if (!target) return;

    const updatedCase: AppealCase = {
      ...target,
      hasJudgment: true,
      judgmentDate: judgmentData.judgmentDate,
      redCaseNo: judgmentData.redCaseNo || target.redCaseNo,
      judgmentOutcome: judgmentData.judgmentOutcome || target.judgmentOutcome,
      appealDeadline: judgmentData.appealDeadline,
      updatedAt: new Date().toISOString(),
    };

    const newCases = cases.map((c) => (c.id === caseId ? updatedCase : c));
    setCases(newCases);
    saveCases(newCases);
    saveCaseToFirestore(updatedCase).catch((e) => console.warn('Firestore record judgment error:', e));
    showToast(`บันทึกคำพิพากษาคดีดำ ${target.blackCaseNo} และเริ่มคุมอุทธรณ์ 1 เดือนแล้ว`);

    const currentToken = token || (await getAccessToken());
    if (sheetConfig && currentToken && updatedCase.sheetRowIndex) {
      try {
        await updateAppealCaseInSheet(currentToken, sheetConfig.spreadsheetId, updatedCase);
      } catch (err) {
        console.error('Failed to update Google Sheet', err);
      }
    }

    if (syncToCalendar && currentToken) {
      try {
        await createAppealCalendarEvent(currentToken, updatedCase);
        showToast('เพิ่มการแจ้งเตือนวันครบอุทธรณ์ 1 เดือนลงใน Google Calendar เรียบร้อยแล้ว');
      } catch (err) {
        console.error('Failed to sync to calendar', err);
      }
    }
  };

  // Daily Judgment Follow-Up Handlers
  const handleAddFollowUp = async (itemData: Omit<DailyJudgmentFollowUp, 'id' | 'createdAt'>) => {
    const newId = `followup_${Date.now()}`;
    const newItem: DailyJudgmentFollowUp = {
      ...itemData,
      id: newId,
      createdAt: new Date().toISOString(),
    };

    const updated = [newItem, ...followUps];
    setFollowUps(updated);
    saveFollowUps(updated);
    saveFollowUpToFirestore(newItem).catch((e) => console.warn('Firestore followup save error:', e));
    showToast(`บันทึกคดีตามคำพิพากษา ${newItem.caseNumber} ประจำวันที่ ${newItem.followUpDate} แล้ว`);

    // Synchronize to Google Sheets
    const currentToken = token || (await getAccessToken());
    if (sheetConfig && currentToken) {
      try {
        const nextIdx = followUps.length + 1;
        const rowIndex = await appendFollowUpToSheet(currentToken, sheetConfig.spreadsheetId, newItem, nextIdx);
        setFollowUps((prev) =>
          prev.map((f) => (f.id === newId ? { ...f, sheetRowIndex: rowIndex } : f))
        );
      } catch (err) {
        console.error('Failed to append follow-up to Google Sheets', err);
      }
    }
  };

  const handleUpdateFollowUp = async (item: DailyJudgmentFollowUp) => {
    const updated = followUps.map((f) => (f.id === item.id ? item : f));
    setFollowUps(updated);
    saveFollowUps(updated);
    saveFollowUpToFirestore(item).catch((e) => console.warn('Firestore update followup error:', e));
    showToast(`อัปเดตสถานะคดี ${item.caseNumber} เรียบร้อยแล้ว`);

    const currentToken = token || (await getAccessToken());
    if (sheetConfig && currentToken && item.sheetRowIndex) {
      try {
        await updateFollowUpInSheet(currentToken, sheetConfig.spreadsheetId, item);
      } catch (err) {
        console.error('Failed to update follow-up in sheet', err);
      }
    }
  };

  const handleDeleteFollowUp = (id: string) => {
    const target = followUps.find((f) => f.id === id);
    if (!target) return;

    setConfirmDialog({
      isOpen: true,
      title: 'ลบรายการตามคำพิพากษารายวัน',
      message: `ต้องการลบรายการคดี ${target.caseNumber} ประจำวันที่ ${target.followUpDate} หรือไม่?`,
      confirmText: 'ลบรายการ',
      isDestructive: true,
      onConfirm: () => {
        const remaining = followUps.filter((f) => f.id !== id);
        setFollowUps(remaining);
        saveFollowUps(remaining);
        deleteFollowUpFromFirestore(id).catch((e) => console.warn('Firestore delete followup error:', e));
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        showToast('ลบรายการตามคำพิพากษาเรียบร้อยแล้ว');
      },
    });
  };

  // Transfer from Daily Judgment Follow-up to 1-Month Appeal Tracker
  const handleTransferToAppealTracker = (item: DailyJudgmentFollowUp) => {
    // Open add case modal with pre-filled details
    setAddCaseInitialFilingDate(item.followUpDate);
    // Mark follow-up as transferred
    handleUpdateFollowUp({
      ...item,
      status: 'delivered',
      transferredToAppealTracker: true,
    });
    // Open Add Case Modal
    setIsAddCaseOpen(true);
    showToast(`นำข้อมูล ${item.caseNumber} มาเปิดฟอร์มคุมระยะเวลาอุทธรณ์ 1 เดือน`);
  };

  // Duty Roster Handlers (ตารางเวรชี้ประจำเดือน)
  const handleRosterUploaded = (newRoster: MonthlyDutyRoster) => {
    setDutyRosters((prev) => {
      const filtered = prev.filter((r) => r.monthYear !== newRoster.monthYear);
      return [newRoster, ...filtered];
    });
    setActiveDutyRosterId(newRoster.id);
    setActiveTab('duty_roster');
    saveDutyRosterToFirestore(newRoster).catch((e) => console.warn('Firestore roster save error:', e));
    showToast(`เพิ่มตารางเวรชี้ "${newRoster.monthNameThai}" เรียบร้อยแล้ว`);
  };

  const handleDeleteDutyRoster = (rosterId: string) => {
    const target = dutyRosters.find((r) => r.id === rosterId);
    if (!target) return;

    setConfirmDialog({
      isOpen: true,
      title: 'ลบตารางเวรชี้ประจำเดือน',
      message: `ต้องการลบข้อมูลตารางเวรชี้ของ "${target.monthNameThai}" หรือไม่?`,
      confirmText: 'ลบตารางเวร',
      isDestructive: true,
      onConfirm: () => {
        const remaining = dutyRosters.filter((r) => r.id !== rosterId);
        setDutyRosters(remaining);
        saveDutyRosters(remaining);
        deleteDutyRosterFromFirestore(rosterId).catch((e) => console.warn('Firestore roster delete error:', e));
        if (remaining.length > 0) {
          setActiveDutyRosterId(remaining[0].id);
        }
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        showToast('ลบตารางเวรชี้เรียบร้อยแล้ว');
      },
    });
  };

  const handleUpdateDutyRecord = (rosterId: string, updatedRecord: DailyDutyRecord) => {
    const updated = dutyRosters.map((r) => {
      if (r.id === rosterId) {
        return {
          ...r,
          duties: r.duties.map((d) => (d.id === updatedRecord.id || d.date === updatedRecord.date ? updatedRecord : d)),
        };
      }
      return r;
    });
    setDutyRosters(updated);
    saveDutyRosters(updated);
    const target = updated.find((r) => r.id === rosterId);
    if (target) {
      saveDutyRosterToFirestore(target).catch((e) => console.warn('Firestore duty record save error:', e));
    }
  };

  const handleUseOfficerForNewCase = (officerName: string, date: string) => {
    setAddCaseInitialFilingDate(date);
    setAddCaseInitialResponsiblePerson(officerName);
    setIsAddCaseOpen(true);
    showToast(`นำชื่อเวรชี้ "${officerName}" มาเปิดฟอร์มสร้างสำนวนใหม่`);
  };

  const handleFilterCasesByOfficer = (officerName: string) => {
    setGlobalVoiceQuery(officerName);
    setActiveTab('all');
    showToast(`กรองดูสำนวนของ: ${officerName}`);
  };

  // 1. Auth Initializing Loader
  if (authInitializing) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white font-['Sarabun',sans-serif]">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-4 animate-pulse">
          <Scale className="w-8 h-8" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold tracking-wide">กำลังเชื่อมต่อระบบและตรวจสอบสิทธิ์...</span>
        </div>
        <p className="text-xs text-slate-400 mt-2">ระบบคุมระยะเวลาอุทธรณ์ 1 เดือนและสารบบคดีประจำวัน</p>
      </div>
    );
  }

  // 2. Authentication Gate: If not logged in, show LoginScreen
  if (!user) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        isLoggingIn={isLoggingIn}
        loginError={loginError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-amber-100 selection:text-amber-900 font-['Sarabun',sans-serif]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2 animate-in slide-in-from-bottom-5">
          <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header
        user={user}
        token={token}
        role={userRole}
        pendingRequestsCount={permissionRequests.filter((r) => r.status === 'pending').length}
        sheetConfig={sheetConfig}
        todayDutyOfficer={todayDutyOfficer}
        onOpenDutyRoster={() => setActiveTab('duty_roster')}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onOpenSheetSettings={() => setIsSheetModalOpen(true)}
        onOpenPermissionsModal={() => setIsPermissionsModalOpen(true)}
        onRequestEditPermission={() => setIsRequestEditModalOpen(true)}
        onSync={handleSyncWithSheet}
        isSyncing={isSyncing}
        onPushLocalToCloud={handlePushLocalToCloud}
        isPushingLocal={isPushingLocal}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Viewer Mode Info Banner */}
        {userRole === 'viewer' && (
          <div className="mb-5 bg-gradient-to-r from-blue-900/90 via-slate-900 to-slate-900 text-white rounded-2xl p-4 border border-blue-500/30 shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center flex-shrink-0 border border-blue-400/30">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white font-['Prompt']">
                    คุณกำลังเข้าชมในโหมดดูข้อมูล (Read-Only)
                  </span>
                  <span className="bg-blue-400/20 text-blue-200 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-blue-400/30">
                    Real-time Active
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  ข้อมูลสำนวนคดีและตารางเวรชี้อัปเดตเป็นปัจจุบันแบบเรียลไทม์จากแอดมิน ({ADMIN_EMAIL}) หากต้องการเพิ่มหรือแก้ไขข้อมูล สามารถกดขอสิทธิ์แก้ไขได้
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsRequestEditModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition flex items-center justify-center gap-1.5 flex-shrink-0 cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>🙋 ขอสิทธิ์แก้ไขข้อมูลจากแอดมิน</span>
            </button>
          </div>
        )}

        {/* KPI Stats Overview */}
        <StatsSummary
          cases={cases}
          followUps={followUps}
          activeFilter={statsFilter}
          onSelectFilter={(filterId) => {
            setStatsFilter(filterId);
            if (filterId === 'followups' || filterId === 'today') {
              setActiveTab('filing_date');
            } else {
              setActiveTab('all');
            }
          }}
        />

        {/* Urgent Impending Deadline Alert Banner */}
        <UrgentAlertBanner
          cases={cases}
          onMarkComplete={(caseItem) => setSelectedCaseForComplete(caseItem)}
          onExtendDeadline={(caseItem) => setSelectedCaseForExtend(caseItem)}
          onSyncCalendar={handleSyncCalendarSingle}
          onSendEmailAlert={(caseItem) => setSelectedCaseForEmailAlert(caseItem)}
          onSendAllUrgentEmails={handleSendAllUrgentEmails}
        />

        {/* Voice-to-Text Search Bar */}
        <VoiceSearchBar
          currentQuery={globalVoiceQuery}
          onSearch={(query, type) => {
            setGlobalVoiceQuery(query);
            if (query.includes('เวร') || query.includes('เวรชี้')) {
              setActiveTab('duty_roster');
              showToast(`สลับไปที่ตารางเวรชี้ประจำเดือน: ${query}`);
            } else if (type === 'filing_date' || query.includes('ฟ้อง')) {
              setActiveTab('filing_date');
              showToast(`สลับไปแท็บ "วันที่ฟ้อง" เพื่อค้นหา: ${query}`);
            } else if (type === 'black' || type === 'red' || query.includes('ดำ') || query.includes('แดง')) {
              setActiveTab('all');
              showToast(`ค้นหาหมายเลขคดี: ${query}`);
            }
          }}
          onSelectFilingDate={(dateQuery) => {
            setGlobalVoiceQuery(dateQuery);
            setActiveTab('filing_date');
            showToast(`ค้นหาคดีที่ยื่นฟ้อง: ${dateQuery}`);
          }}
        />

        {/* Tab Navigation */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-200 pb-3 mb-5 gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>สำนวนคุมอุทธรณ์ทั้งหมด</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'all' ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-slate-600'}`}>
                {cases.length}
              </span>
            </button>

            {/* Tab 2: วันที่ฟ้อง (เลือกวันที่ต้องการ แล้วปรากฎจำนวนคดีที่ฟ้องในวันนั้น) */}
            <button
              onClick={() => setActiveTab('filing_date')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'filing_date'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>วันที่ฟ้อง</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'filing_date' ? 'bg-indigo-800 text-white' : 'bg-indigo-50 text-indigo-700'}`}>
                เลือกวันที่
              </span>
            </button>

            {/* Tab 3: ตารางเวรชี้ประจำเดือน (AI) */}
            <button
              onClick={() => setActiveTab('duty_roster')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'duty_roster'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>ตารางเวรชี้ประจำเดือน (AI)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'duty_roster' ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-700'}`}>
                {dutyRosters.length} รอบเดือน
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={() => {
                  setAddCaseInitialFilingDate(undefined);
                  setAddCaseInitialResponsiblePerson(undefined);
                  setIsAddCaseOpen(true);
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มสำนวนคุมอุทธรณ์ 1 เดือน</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: All Appeal Cases Table View */}
        {activeTab === 'all' && (
          <CaseTable
            cases={cases}
            canEdit={canEdit}
            initialFilter={statsFilter}
            externalSearchTerm={globalVoiceQuery}
            onMarkComplete={(caseItem) => setSelectedCaseForComplete(caseItem)}
            onExtendDeadline={(caseItem) => setSelectedCaseForExtend(caseItem)}
            onEditCase={(caseItem) => {
              setSelectedCaseForEdit(caseItem);
              setIsEditCaseOpen(true);
            }}
            onSyncCalendar={handleSyncCalendarSingle}
            onOpenJudgmentDoc={(caseItem) => setSelectedCaseForJudgmentDoc(caseItem)}
            onSendEmailAlert={(caseItem) => setSelectedCaseForEmailAlert(caseItem)}
            onOpenAppointmentModal={(caseItem) => setSelectedCaseForAppointment(caseItem)}
            onDeleteCase={handleDeleteCase}
            onAddNewCase={() => setIsAddCaseOpen(true)}
            onToast={showToast}
          />
        )}

        {/* Tab 2: วันที่ฟ้อง (เลือกวันที่ต้องการ แล้วปรากฎจำนวนคดีที่ฟ้องในวันนั้น) */}
        {activeTab === 'filing_date' && (
          <DailyFilingByDateView
            cases={cases}
            dutyRosters={dutyRosters}
            canEdit={canEdit}
            token={token}
            sheetConfig={sheetConfig}
            initialSelectedDate={addCaseInitialFilingDate}
            externalDateSearch={globalVoiceQuery}
            onMarkComplete={(caseItem) => setSelectedCaseForComplete(caseItem)}
            onExtendDeadline={(caseItem) => setSelectedCaseForExtend(caseItem)}
            onEditCase={(caseItem) => {
              setSelectedCaseForEdit(caseItem);
              setIsEditCaseOpen(true);
            }}
            onRecordJudgment={(caseItem) => {
              setSelectedCaseForRecordJudgment(caseItem);
              setIsRecordJudgmentOpen(true);
            }}
            onOpenJudgmentDoc={(caseItem) => setSelectedCaseForJudgmentDoc(caseItem)}
            onExportDailyDoc={handleExportDailyDoc}
            onOpenAppointmentModal={(caseItem) => setSelectedCaseForAppointment(caseItem)}
            onAddNewCaseForDate={(dateStr) => {
              setAddCaseInitialFilingDate(dateStr);
              setIsAddCaseOpen(true);
            }}
            onQuickAssignOfficer={handleQuickAssignOfficer}
            onBatchAssignOfficerToDate={handleBatchAssignOfficerToDate}
            onToast={showToast}
          />
        )}

        {/* Tab 3: Monthly Duty Roster (AI Analysis & Inspection) */}
        {activeTab === 'duty_roster' && (
          <DutyRosterView
            rosters={dutyRosters}
            activeRosterId={activeDutyRosterId}
            canEdit={canEdit}
            onSelectRoster={(id) => setActiveDutyRosterId(id)}
            onOpenUploadModal={() => setIsUploadDutyModalOpen(true)}
            onDeleteRoster={handleDeleteDutyRoster}
            onUpdateDutyRecord={handleUpdateDutyRecord}
            onUseOfficerForNewCase={handleUseOfficerForNewCase}
            onFilterCasesByOfficer={handleFilterCasesByOfficer}
            showToast={showToast}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-slate-700">ระบบคุมระยะเวลาอุทธรณ์ 1 เดือน</span>
            <span>(นับแต่วันมีคำพิพากษา ตาม ป.วิ.พ. ม.229 / ป.วิ.อ. ม.198)</span>
          </div>
          <div className="text-slate-400 text-[11px]">
            เชื่อมต่อ Google Sheets และวิเคราะห์ตารางเวรชี้ประจำเดือน (PDF/ภาพ) ด้วย AI • ซิงค์แบบเรียลไทม์
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AddCaseModal
        isOpen={isAddCaseOpen}
        onClose={() => {
          setIsAddCaseOpen(false);
          setAddCaseInitialResponsiblePerson(undefined);
        }}
        onSave={handleSaveNewCase}
        initialFilingDate={addCaseInitialFilingDate}
        initialResponsiblePerson={addCaseInitialResponsiblePerson}
        suggestedDutyOfficer={todayDutyOfficer}
        dutyRosters={dutyRosters}
        hasSheetConnected={!!sheetConfig}
      />

      <UploadDutyRosterModal
        isOpen={isUploadDutyModalOpen}
        onClose={() => setIsUploadDutyModalOpen(false)}
        onSuccess={handleRosterUploaded}
        showToast={showToast}
      />

      <CompleteModal
        isOpen={!!selectedCaseForComplete}
        caseItem={selectedCaseForComplete}
        onClose={() => setSelectedCaseForComplete(null)}
        onConfirmComplete={handleConfirmComplete}
        onReopenCase={handleReopenCase}
      />

      <ExtendDeadlineModal
        isOpen={!!selectedCaseForExtend}
        caseItem={selectedCaseForExtend}
        onClose={() => setSelectedCaseForExtend(null)}
        onConfirmExtend={handleConfirmExtend}
      />

      <JudgmentDocModal
        isOpen={!!selectedCaseForJudgmentDoc}
        caseItem={selectedCaseForJudgmentDoc}
        token={token}
        onClose={() => setSelectedCaseForJudgmentDoc(null)}
        onSaveJudgment={handleSaveJudgment}
        onLoginPrompt={handleLogin}
      />

      <EmailAlertModal
        isOpen={!!selectedCaseForEmailAlert}
        caseItem={selectedCaseForEmailAlert}
        currentUserEmail={user?.email || 'naratipsrearj@gmail.com'}
        token={token}
        onClose={() => setSelectedCaseForEmailAlert(null)}
        onLoginPrompt={handleLogin}
        onEmailSentSuccess={(caseItem, recipient) => {
          showToast(`ส่งอีเมลแจ้งเตือนคดีดำ ${caseItem.blackCaseNo} ไปยัง ${recipient} สำเร็จแล้ว`);
        }}
      />

      <CourtAppointmentModal
        isOpen={!!selectedCaseForAppointment}
        caseItem={selectedCaseForAppointment}
        onClose={() => setSelectedCaseForAppointment(null)}
        onSaveAppointment={handleSaveAppointment}
      />

      {/* Edit Case Modal (สำหรับแก้ไขเพื่อเพิ่มเติมข้อมูลหรือแก้ไขข้อมูลที่กรอกไปแล้ว) */}
      <EditCaseModal
        isOpen={isEditCaseOpen && !!selectedCaseForEdit}
        caseItem={selectedCaseForEdit}
        onClose={() => {
          setIsEditCaseOpen(false);
          setSelectedCaseForEdit(null);
        }}
        onSave={handleSaveEditedCase}
        suggestedDutyOfficer={todayDutyOfficer}
        dutyRosters={dutyRosters}
      />

      {/* Record Judgment Modal (สำหรับบันทึกคำพิพากษาและเริ่มคุมอุทธรณ์ 1 เดือนเมื่อศาลตัดสิน) */}
      <RecordJudgmentModal
        isOpen={isRecordJudgmentOpen && !!selectedCaseForRecordJudgment}
        caseItem={selectedCaseForRecordJudgment}
        onClose={() => {
          setIsRecordJudgmentOpen(false);
          setSelectedCaseForRecordJudgment(null);
        }}
        onSaveJudgmentDate={handleSaveJudgmentDate}
      />

      {/* User Permissions Management Modal (Admin only) */}
      <UserPermissionsModal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        settings={projectSettings}
        requests={permissionRequests}
        onApproveRequest={handleApproveRequest}
        onRejectRequest={handleRejectRequest}
        onAddEditor={handleAddEditor}
        onRemoveEditor={handleRemoveEditor}
        isProcessing={isProcessingPermissions}
      />

      {/* Request Edit Permission Modal (Viewers) */}
      {user && (
        <RequestEditModal
          isOpen={isRequestEditModalOpen}
          onClose={() => setIsRequestEditModalOpen(false)}
          user={user}
          onRequest={handleRequestEdit}
          existingRequestStatus={
            permissionRequests.find(
              (r) => r.email.toLowerCase() === (user.email || '').toLowerCase()
            )?.status || null
          }
        />
      )}

      <SpreadsheetModal
        isOpen={isSheetModalOpen}
        onClose={() => setIsSheetModalOpen(false)}
        token={token}
        currentConfig={sheetConfig}
        onConnectSpreadsheet={(cfg) => {
          setSheetConfig(cfg);
          showToast(`เชื่อมต่อ Google Sheets: "${cfg.spreadsheetTitle}" เรียบร้อยแล้ว`);
          handleSyncWithSheet();
        }}
        onDisconnectSpreadsheet={() => {
          setSheetConfig(null);
          showToast('ยกเลิกการเชื่อมต่อ Google Sheets เรียบร้อย');
        }}
        onLoginPrompt={handleLogin}
      />

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        isDestructive={confirmDialog.isDestructive}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
