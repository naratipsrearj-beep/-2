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
  Users,
  KeyRound,
  BarChart3
} from 'lucide-react';

import { AppealCase, DailyJudgmentFollowUp, SheetConfig, CaseCompletionReason, MonthlyDutyRoster, DailyDutyRecord, ActivityLog, ActivityActionType } from './types/appeal';
import { initAuth, googleSignIn, logout, getAccessToken, AppAuthUser, loginWithAdminPin, getSavedPinAdminSession, clearPinAdminSession } from './services/auth';
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
  getSavedActivityLogs,
  saveActivityLogs,
} from './services/storageService';
import { getTodayDuty } from './services/dutyService';
import {
  getUserRole,
  canUserEdit,
  canUserComplete,
  ProjectSettings,
  PermissionRequest,
  DEFAULT_SETTINGS,
  DEFAULT_ADMIN_PIN,
  ADMIN_EMAIL,
  updateAdminPin,
  subscribeToCases,
  subscribeToDutyRosters,
  subscribeToFollowUps,
  subscribeToProjectSettings,
  subscribeToPermissionRequests,
  subscribeToActivityLogs,
  saveActivityLogToFirestore,
  recordCriticalActivity,
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
  addAllowedAppealOfficer,
  removeAllowedAppealOfficer,
  seedInitialFirestoreDataIfEmpty,
  uploadAllLocalDataToFirestore,
  testConnectionStatus,
  FIREBASE_PROJECT_ID,
} from './services/firestoreService';

import { Header } from './components/Header';
import { StatsSummary } from './components/StatsSummary';
import { UrgentAlertBanner } from './components/UrgentAlertBanner';
import { CaseTable } from './components/CaseTable';
import { DailyFilingByDateView } from './components/DailyFilingByDateView';
import { DutyRosterView } from './components/DutyRosterView';
import { MonthlyProsecutorSummaryView } from './components/MonthlyProsecutorSummaryView';
import { DutyRosterEntryModal } from './components/DutyRosterEntryModal';
import { AddCaseModal } from './components/AddCaseModal';
import { CompleteModal } from './components/CompleteModal';
import { ExtendDeadlineModal } from './components/ExtendDeadlineModal';
import { formatThaiDate, getTodayString } from './utils/dateUtils';
import { SpreadsheetModal } from './components/SpreadsheetModal';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { VoiceSearchBar } from './components/VoiceSearchBar';
import { JudgmentDocModal } from './components/JudgmentDocModal';
import { EmailAlertModal } from './components/EmailAlertModal';
import { CourtAppointmentModal } from './components/CourtAppointmentModal';
import { CourtPetitionModal } from './components/CourtPetitionModal';
import { EditCaseModal } from './components/EditCaseModal';
import { RecordJudgmentModal } from './components/RecordJudgmentModal';
import { JudgmentRecheckModal } from './components/JudgmentRecheckModal';
import { LoginScreen } from './components/LoginScreen';
import { UserPermissionsModal } from './components/UserPermissionsModal';
import { RequestEditModal } from './components/RequestEditModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { FirebaseRulesGuideModal } from './components/FirebaseRulesGuideModal';
import { createDailyFilingDoc } from './services/docsService';
import { checkAndSendAutomaticEmailAlerts } from './services/gmailService';
import { CourtAppointmentType, CaseAppointment } from './types/appeal';
import { getAppointmentLabel, isCaseConfessed } from './utils/appointmentUtils';
import { downloadApplicationJsonBackup } from './utils/backupUtils';
import { BackupViewerModal } from './components/BackupViewerModal';
import { MonthlyProsecutorHearingScheduleView } from './components/MonthlyProsecutorHearingScheduleView';
import { SubmitToDutyModal } from './components/SubmitToDutyModal';
import { ActivityLogModal } from './components/ActivityLogModal';

export default function App() {
  // Auth & Roles state
  const [user, setUser] = useState<User | AppAuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false);

  // Firestore Project Settings & Permissions
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS);
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequest[]>([]);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [isRequestEditModalOpen, setIsRequestEditModalOpen] = useState(false);
  const [isBackupViewerOpen, setIsBackupViewerOpen] = useState(false);
  const [isProcessingPermissions, setIsProcessingPermissions] = useState(false);
  const [isPushingLocal, setIsPushingLocal] = useState(false);

  // Real-time Firestore Connection State
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'connecting'>('connecting');
  const [isRulesGuideOpen, setIsRulesGuideOpen] = useState(false);

  const checkConnection = async (): Promise<boolean> => {
    setConnectionStatus('connecting');
    const res = await testConnectionStatus();
    if (res.success) {
      setConnectionStatus('connected');
      return true;
    } else {
      setConnectionStatus('error');
      return false;
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  // RBAC Roles: Admin (naratipsrearj@gmail.com / Admin PIN) | Editor | Appeal Officer | Viewer
  const isPinAdmin = Boolean((user as AppAuthUser)?.isPinAdmin);
  const isPinAppealOfficer = Boolean((user as AppAuthUser)?.isPinAppealOfficer);
  const userRole = React.useMemo(
    () => getUserRole(user?.email, projectSettings, isPinAdmin, isPinAppealOfficer),
    [user?.email, projectSettings, isPinAdmin, isPinAppealOfficer]
  );
  const canEdit = React.useMemo(() => canUserEdit(userRole), [userRole]);
  const canComplete = React.useMemo(() => canUserComplete(userRole), [userRole]);

  // Main data state
  const [cases, setCases] = useState<AppealCase[]>([]);
  const [followUps, setFollowUps] = useState<DailyJudgmentFollowUp[]>([]);
  const [sheetConfig, setSheetConfig] = useState<SheetConfig | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Duty Rosters (ตารางเวรชี้ประจำเดือน)
  const [dutyRosters, setDutyRosters] = useState<MonthlyDutyRoster[]>([]);
  const [activeDutyRosterId, setActiveDutyRosterId] = useState<string | undefined>();
  const [isUploadDutyModalOpen, setIsUploadDutyModalOpen] = useState(false);
  const [dutyRosterEditTargetId, setDutyRosterEditTargetId] = useState<string | undefined>();
  const [addCaseInitialResponsiblePerson, setAddCaseInitialResponsiblePerson] = useState<string | undefined>();

  // Navigation tabs: 'all' | 'filing_date' | 'duty_roster' | 'monthly_prosecutor' | 'prosecutor_hearings'
  const [activeTab, setActiveTab] = useState<'all' | 'filing_date' | 'duty_roster' | 'monthly_prosecutor' | 'prosecutor_hearings'>('all');
  const [monthlySummaryInitialMonth, setMonthlySummaryInitialMonth] = useState<string | undefined>();
  const [statsFilter, setStatsFilter] = useState<string>('all');
  const [globalVoiceQuery, setGlobalVoiceQuery] = useState<string>('');

  // Modals state
  const [isAddCaseOpen, setIsAddCaseOpen] = useState(false);
  const [addCaseInitialFilingDate, setAddCaseInitialFilingDate] = useState<string | undefined>();
  const [selectedCaseForComplete, setSelectedCaseForComplete] = useState<AppealCase | null>(null);
  const [selectedCaseForSubmitDuty, setSelectedCaseForSubmitDuty] = useState<AppealCase | null>(null);
  const [selectedCaseForExtend, setSelectedCaseForExtend] = useState<AppealCase | null>(null);
  const [selectedCaseForCourtPetition, setSelectedCaseForCourtPetition] = useState<{
    caseItem: AppealCase;
    newDeadline?: string;
    extensionCount?: number;
  } | null>(null);
  const [selectedCaseForJudgmentDoc, setSelectedCaseForJudgmentDoc] = useState<AppealCase | null>(null);
  const [selectedCaseForEmailAlert, setSelectedCaseForEmailAlert] = useState<AppealCase | null>(null);
  const [selectedCaseForAppointment, setSelectedCaseForAppointment] = useState<AppealCase | null>(null);
  const [selectedCaseForEdit, setSelectedCaseForEdit] = useState<AppealCase | null>(null);
  const [isEditCaseOpen, setIsEditCaseOpen] = useState(false);
  const [selectedCaseForRecordJudgment, setSelectedCaseForRecordJudgment] = useState<AppealCase | null>(null);
  const [isRecordJudgmentOpen, setIsRecordJudgmentOpen] = useState(false);
  const [recheckTarget, setRecheckTarget] = useState<{
    type: 'case' | 'followup';
    data: AppealCase | DailyJudgmentFollowUp;
  } | null>(null);
  const [isRecheckModalOpen, setIsRecheckModalOpen] = useState(false);
  const [sentAlertHistory, setSentAlertHistory] = useState<Record<string, { lastSentDate: string; daysLeft: number }>>(() => {
    try {
      const raw = localStorage.getItem('sent_email_alert_history');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);

  // Activity Log (ประวัติการทำงานและตรวจสอบความรับผิดชอบ)
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => getSavedActivityLogs());
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityLogCaseFilter, setActivityLogCaseFilter] = useState<string | undefined>();

  // Log critical activity for accountability and audit trail
  const logAction = async (
    actionType: ActivityActionType,
    actionLabel: string,
    targetTitle: string,
    details: string,
    metadata?: Record<string, any>,
    targetId?: string
  ) => {
    let actorName = 'ผู้ใช้งานทั่วไป';
    let actorRole: 'admin' | 'editor' | 'appeal_officer' | 'viewer' = 'viewer';
    let actorEmail: string | undefined;

    if (isPinAdmin) {
      actorName = 'ผู้ดูแลระบบ (Admin PIN)';
      actorRole = 'admin';
    } else if (isPinAppealOfficer) {
      actorName = 'เจ้าหน้าที่คุมอุทธรณ์ (PIN)';
      actorRole = 'appeal_officer';
    } else if (user) {
      actorName = user.displayName || user.email || 'ผู้ใช้งาน';
      actorEmail = user.email || undefined;
      actorRole = userRole;
    }

    try {
      const newLog = await recordCriticalActivity({
        actionType,
        actionLabel,
        actorName,
        actorEmail,
        actorRole,
        targetId,
        targetTitle,
        details,
        metadata,
      });

      setActivityLogs((prev) => {
        const updated = [newLog, ...prev.filter((l) => l.id !== newLog.id)];
        saveActivityLogs(updated);
        return updated;
      });
    } catch (err) {
      console.warn('logAction error:', err);
    }
  };

  // Open Activity Log modal (Accessible strictly by Admin only)
  const handleOpenActivityLog = (caseNumber?: string) => {
    if (userRole !== 'admin') {
      showToast('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถดูประวัติกิจกรรมได้');
      return;
    }
    setActivityLogCaseFilter(caseNumber);
    setIsActivityLogOpen(true);
  };

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

    // Initialize Auth Listener & Check Saved PIN Session
    const savedPinSession = getSavedPinAdminSession();
    if (savedPinSession) {
      setUser(savedPinSession);
      setAuthInitializing(false);
    }

    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken || null);
        setAuthInitializing(false);
      },
      () => {
        if (!getSavedPinAdminSession()) {
          setUser(null);
          setToken(null);
        }
        setAuthInitializing(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Real-time Firestore Subscriptions (active for all users, live sync across all devices)
  useEffect(() => {
    // Immediate seed if Firestore is empty on first boot
    seedInitialFirestoreDataIfEmpty(
      getSavedCases(),
      getSavedDutyRosters(),
      getSavedFollowUps(),
      getSavedActivityLogs()
    ).catch((e) => console.warn('First-boot seed error:', e));

    // 1. Real-time subscribe to all cases (all clients sync instantly)
    const unsubCases = subscribeToCases(
      (remoteCases) => {
        setConnectionStatus('connected');
        if (remoteCases.length > 0) {
          setCases(remoteCases);
          saveCases(remoteCases);
        } else {
          // If remote is empty, seed local cases to Firestore so all clients get them
          const localCases = getSavedCases();
          if (localCases.length > 0) {
            saveCasesBatchToFirestore(localCases).catch((e) =>
              console.warn('Auto-seed cases to Firestore failed:', e)
            );
          }
        }
      },
      (err) => {
        console.warn('Real-time cases sync error:', err);
        setConnectionStatus('error');
      }
    );

    // 2. Real-time subscribe to monthly duty rosters
    const unsubRosters = subscribeToDutyRosters(
      (remoteRosters) => {
        if (remoteRosters.length > 0) {
          setDutyRosters(remoteRosters);
          saveDutyRosters(remoteRosters);
          if (!activeDutyRosterId && remoteRosters[0]) {
            setActiveDutyRosterId(remoteRosters[0].id);
          }
        } else {
          const localRosters = getSavedDutyRosters();
          if (localRosters.length > 0) {
            for (const r of localRosters) {
              saveDutyRosterToFirestore(r).catch((e) =>
                console.warn('Auto-seed duty roster to Firestore failed:', e)
              );
            }
          }
        }
      },
      (err) => {
        console.warn('Real-time duty rosters sync error:', err);
        setConnectionStatus('error');
      }
    );

    // 3. Real-time subscribe to daily follow-ups
    const unsubFollowUps = subscribeToFollowUps(
      (remoteFollowUps) => {
        if (remoteFollowUps.length > 0) {
          setFollowUps(remoteFollowUps);
          saveFollowUps(remoteFollowUps);
        } else {
          const localFollowUps = getSavedFollowUps();
          if (localFollowUps.length > 0) {
            for (const f of localFollowUps) {
              saveFollowUpToFirestore(f).catch((e) =>
                console.warn('Auto-seed follow-up to Firestore failed:', e)
              );
            }
          }
        }
      },
      (err) => {
        console.warn('Real-time followups sync error:', err);
        setConnectionStatus('error');
      }
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

    // 6. Real-time subscribe to activity logs (ประวัติการทำงาน)
    const unsubLogs = subscribeToActivityLogs(
      (remoteLogs) => {
        if (remoteLogs && remoteLogs.length > 0) {
          setActivityLogs(remoteLogs);
          saveActivityLogs(remoteLogs);
        } else {
          const localLogs = getSavedActivityLogs();
          if (localLogs.length > 0) {
            for (const log of localLogs) {
              saveActivityLogToFirestore(log).catch((e) =>
                console.warn('Auto-seed activity log to Firestore failed:', e)
              );
            }
          }
        }
      },
      (err) => console.warn('Real-time activity logs sync error:', err)
    );

    return () => {
      unsubCases();
      unsubRosters();
      unsubFollowUps();
      unsubSettings();
      if (unsubRequests) unsubRequests();
      unsubLogs();
    };
  }, [user]);

  // Save to localStorage whenever data changes
  useEffect(() => {
    saveCases(cases);
  }, [cases]);

  useEffect(() => {
    if (activityLogs.length > 0) {
      saveActivityLogs(activityLogs);
    }
  }, [activityLogs]);

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

  const handlePinLogin = (pin: string) => {
    try {
      const pinUser = loginWithAdminPin(pin, projectSettings.adminPin || DEFAULT_ADMIN_PIN);
      setUser(pinUser);
      if (pinUser.isPinAppealOfficer || pin.trim() === '000111') {
        showToast('เข้าสู่ระบบสำเร็จในฐานะ: เจ้าหน้าที่คุมอุทธรณ์ (มีอำนาจในการกดเสร็จสิ้น และตรวจดูสำนวนในระบบ)');
      } else {
        showToast('เข้าสู่ระบบในสถานะแอดมินเรียบร้อยแล้ว (มีสิทธิ์แก้ไขข้อมูลทั้งหมด)');
      }
    } catch (err: any) {
      showToast(err.message || 'รหัส PIN ไม่ถูกต้อง');
    }
  };

  const handleGuestLogin = () => {
    setUser({
      uid: 'viewer-guest',
      email: null,
      displayName: 'ผู้เยี่ยมชม (Viewer)',
      photoURL: null,
      isPinAdmin: false,
    });
    showToast('เข้าชมในโหมดดูข้อมูลทั่วไป (Read-only)');
  };

  const handleLogout = async () => {
    await logout();
    clearPinAdminSession();
    setUser(null);
    setToken(null);
    showToast('ออกจากระบบเรียบร้อยแล้ว');
  };

  const handleUpdateAdminPin = async (newPin: string) => {
    if (!user || userRole !== 'admin') return;
    try {
      const updated = await updateAdminPin(newPin, projectSettings, user.displayName || user.email || 'admin');
      setProjectSettings(updated);
      logAction(
        'admin_pin_changed',
        'เปลี่ยนรหัส PIN ผู้ดูแลระบบ',
        'Admin PIN',
        'ทำการเปลี่ยนรหัสผ่าน PIN ผู้ดูแลระบบ'
      );
      showToast(`อัปเดตรหัส PIN แอดมินสำเร็จ`);
    } catch (err: any) {
      console.error('Update PIN failed', err);
      showToast('บันทึกรหัส PIN ไม่สำเร็จ: ' + err.message);
      throw err;
    }
  };

  // Permission Request & Management Handlers
  const handleRequestEdit = async (
    note: string,
    requestedRole: 'editor' | 'appeal_officer' = 'appeal_officer'
  ) => {
    if (!user || !user.email) return;
    try {
      await requestEditPermission(
        {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        },
        note,
        requestedRole
      );
      showToast(
        requestedRole === 'appeal_officer'
          ? 'ส่งคำขอสิทธิ์เจ้าหน้าที่คุมอุทธรณ์ไปยังแอดมินแล้ว'
          : 'ส่งคำขอสิทธิ์ผู้ร่วมแก้ไขข้อมูลไปยังแอดมินแล้ว'
      );
    } catch (err: any) {
      console.error('Request edit failed:', err);
      showToast('ส่งคำขอไม่สำเร็จ: ' + err.message);
    }
  };

  const handleApproveRequest = async (
    requestId: string,
    userEmail: string,
    role: 'editor' | 'appeal_officer' = 'appeal_officer'
  ) => {
    if (!user?.email) return;
    setIsProcessingPermissions(true);
    try {
      await approveEditPermission(requestId, userEmail, projectSettings, user.email, role);
      logAction(
        'permission_approved',
        'อนุมัติคำขอสิทธิ์',
        userEmail,
        `อนุมัติคำขอสิทธิ์เข้าใช้งานในบทบาท ${role === 'appeal_officer' ? 'เจ้าหน้าที่คุมอุทธรณ์ (ดูสำนวนและกดเสร็จสิ้นเท่านั้น)' : 'ผู้ร่วมแก้ไข'} ให้แก่ ${userEmail}`,
        {
          userEmail,
          approvedRole: role,
          requestId,
        }
      );
      showToast(
        role === 'appeal_officer'
          ? `อนุมัติสิทธิ์เจ้าหน้าที่คุมอุทธรณ์ให้ "${userEmail}" เรียบร้อยแล้ว (ดูสำนวนและกดเสร็จสิ้นเท่านั้น)`
          : `อนุมัติสิทธิ์ผู้ร่วมแก้ไขให้ "${userEmail}" เรียบร้อยแล้ว`
      );
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
      logAction(
        'permission_rejected',
        'ปฏิเสธคำขอสิทธิ์',
        `คำขอ ${requestId}`,
        'ปฏิเสธคำขอสิทธิ์เข้าใช้งานระบบ',
        { requestId }
      );
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
      logAction(
        'permission_changed',
        'เพิ่มสิทธิ์ผู้ร่วมแก้ไข',
        email,
        `เพิ่มสิทธิ์ผู้ร่วมแก้ไข (Editor) ให้แก่ ${email}`,
        { email, grantedRole: 'editor' }
      );
      showToast(`เพิ่มสิทธิ์ผู้ร่วมแก้ไขให้ "${email}" สำเร็จ`);
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
      logAction(
        'permission_changed',
        'เพิกถอนสิทธิ์ผู้ร่วมแก้ไข',
        email,
        `เพิกถอนสิทธิ์ผู้ร่วมแก้ไขของ ${email}`,
        { email, removedRole: 'editor' }
      );
      showToast(`เพิกถอนสิทธิ์ผู้ร่วมแก้ไขของ "${email}" เรียบร้อยแล้ว`);
    } catch (err: any) {
      console.error('Remove editor failed:', err);
      showToast('ไม่สามารถเพิกถอนสิทธิ์ได้: ' + err.message);
    } finally {
      setIsProcessingPermissions(false);
    }
  };

  const handleAddAppealOfficer = async (email: string) => {
    if (!user?.email) return;
    setIsProcessingPermissions(true);
    try {
      await addAllowedAppealOfficer(email, projectSettings, user.email);
      logAction(
        'permission_changed',
        'เพิ่มสิทธิ์จนท.คุมอุทธรณ์',
        email,
        `แต่งตั้งสิทธิ์เจ้าหน้าที่คุมอุทธรณ์ให้แก่ ${email} (มีอำนาจกดเสร็จสิ้นและตรวจดูสำนวน)`,
        { email, grantedRole: 'appeal_officer' }
      );
      showToast(`เพิ่มสิทธิ์เจ้าหน้าที่คุมอุทธรณ์ให้ "${email}" เรียบร้อยแล้ว (ดูสำนวนและกดเสร็จสิ้นเท่านั้น)`);
    } catch (err: any) {
      console.error('Add appeal officer failed:', err);
      showToast('ไม่สามารถเพิ่มผู้ใช้งานได้: ' + err.message);
    } finally {
      setIsProcessingPermissions(false);
    }
  };

  const handleRemoveAppealOfficer = async (email: string) => {
    if (!user?.email) return;
    setIsProcessingPermissions(true);
    try {
      await removeAllowedAppealOfficer(email, projectSettings, user.email);
      logAction(
        'permission_changed',
        'เพิกถอนสิทธิ์จนท.คุมอุทธรณ์',
        email,
        `เพิกถอนสิทธิ์เจ้าหน้าที่คุมอุทธรณ์ของ ${email}`,
        { email, removedRole: 'appeal_officer' }
      );
      showToast(`เพิกถอนสิทธิ์เจ้าหน้าที่คุมอุทธรณ์ของ "${email}" เรียบร้อยแล้ว`);
    } catch (err: any) {
      console.error('Remove appeal officer failed:', err);
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

  // Download JSON Backup (สำหรับแอดมินดาวน์โหลดข้อมูลทั้งหมด สำนวน, ตารางเวรชี้, รายการติดตาม ไปเก็บออฟไลน์)
  const handleDownloadJsonBackup = () => {
    if (userRole !== 'admin') {
      showToast('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถดาวน์โหลดไฟล์สำรองข้อมูลได้');
      return;
    }

    try {
      const result = downloadApplicationJsonBackup({
        cases,
        dutyRosters,
        followUps,
        userEmail: user?.email || (isPinAdmin ? 'Admin (PIN)' : 'Admin'),
      });

      if (result.success) {
        showToast(
          `ดาวน์โหลดไฟล์สำรองข้อมูล "${result.filename}" เรียบร้อยแล้ว (${result.counts.cases} สำนวน, ${result.counts.dutyRosters} ตารางเวรชี้, ${result.counts.followUps} รายการติดตาม)`
        );
      }
    } catch (err: any) {
      console.error('Download backup failed:', err);
      showToast(`การดาวน์โหลดไฟล์สำรองข้อมูลขัดข้อง: ${err?.message || 'กรุณาลองใหม่อีกครั้ง'}`);
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
    if (!canEdit) {
      showToast('เฉพาะแอดมินหรือผู้ร่วมแก้ไขเท่านั้นที่สามารถเพิ่มสำนวนได้ (เจ้าหน้าที่คุมอุทธรณ์ไม่มีสิทธิ์เพิ่มสำนวน)');
      return;
    }
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

    logAction(
      'case_created',
      'เพิ่มสำนวนคดีใหม่',
      `คดีดำ ${newCase.blackCaseNo}`,
      `เพิ่มสำนวนคดีดำ ${newCase.blackCaseNo} เข้าสู่ระบบ (ศาล: ${newCase.court}, อัยการ: ${newCase.responsiblePerson || '-'})`,
      {
        blackCaseNo: newCase.blackCaseNo,
        redCaseNo: newCase.redCaseNo,
        court: newCase.court,
        prosecutorName: newCase.responsiblePerson,
      },
      newId
    );

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
    notes?: string,
    isNoAppealConfirmed?: boolean
  ) => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return;

    const updatedCase: AppealCase = {
      ...targetCase,
      isCompleted: true, // ปิดการแจ้งเตือนถาวร (ยกเว้น อ.กุลชาติ หากยังไม่ยืนยันไม่อุทธรณ์ จะเตือนก่อนครบ 5 วัน)
      completedDate,
      completionReason: reason,
      notes: notes || targetCase.notes,
      isNoAppealConfirmed: isNoAppealConfirmed !== undefined ? isNoAppealConfirmed : targetCase.isNoAppealConfirmed,
      noAppealConfirmedAt: isNoAppealConfirmed ? new Date().toISOString() : targetCase.noAppealConfirmedAt,
      updatedAt: new Date().toISOString(),
    };

    const newCases = cases.map((c) => (c.id === caseId ? updatedCase : c));
    setCases(newCases);
    saveCases(newCases);
    saveCaseToFirestore(updatedCase).catch((e) => console.warn('Firestore update case error:', e));

    const reasonLabel =
      reason === 'appealed'
        ? 'ยื่นอุทธรณ์แล้ว'
        : reason === 'no_appeal'
        ? 'มีคำสั่งไม่อุทธรณ์ / ยุติ'
        : reason === 'finalized'
        ? 'คดีถึงที่สุดแล้ว'
        : reason === 'settled'
        ? 'คู่ความตกลงยอมความกันได้'
        : 'อื่นๆ';

    logAction(
      'case_completed',
      'กดเสร็จสิ้นสำนวน',
      `คดีดำ ${targetCase.blackCaseNo}`,
      `บันทึกเสร็จสิ้นสำนวน: ${reasonLabel}${notes ? ` (หมายเหตุ: ${notes})` : ''}`,
      {
        blackCaseNo: targetCase.blackCaseNo,
        redCaseNo: targetCase.redCaseNo,
        court: targetCase.court,
        prosecutorName: targetCase.prosecutorName || targetCase.responsiblePerson,
        reason,
        completionReason: reasonLabel,
        completedDate,
      },
      caseId
    );

    showToast(`สำนวน ${targetCase.blackCaseNo} บันทึกเสร็จสิ้นแล้ว${isNoAppealConfirmed ? ' (ยืนยันไม่อุทธรณ์แล้ว)' : ''}`);

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

  // Confirm No Appeal (เฉพาะกรณีเจ้าของสำนวนเป็น อ.กุลชาติ: หยุดการเตือนตอนก่อนครบอุทธรณ์ 5 วัน)
  const handleConfirmNoAppeal = async (caseId: string) => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return;

    const updatedCase: AppealCase = {
      ...targetCase,
      isNoAppealConfirmed: true,
      noAppealConfirmedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newCases = cases.map((c) => (c.id === caseId ? updatedCase : c));
    setCases(newCases);
    saveCases(newCases);
    saveCaseToFirestore(updatedCase).catch((e) => console.warn('Firestore no appeal confirm error:', e));

    logAction(
      'case_completed',
      'ยืนยันไม่อุทธรณ์',
      `คดีดำ ${targetCase.blackCaseNo}`,
      `ยืนยันสำนวนไม่อุทธรณ์แล้ว (หยุดการแจ้งเตือน)`,
      {
        blackCaseNo: targetCase.blackCaseNo,
        prosecutorName: targetCase.prosecutorName || targetCase.responsiblePerson,
        court: targetCase.court,
      },
      caseId
    );

    showToast(`ยืนยันสำนวน ${targetCase.blackCaseNo} ไม่อุทธรณ์แล้ว (หยุดการแจ้งเตือนเรียบร้อย)`);

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

    logAction(
      'case_completion_undone',
      'ยกเลิกเสร็จสิ้นสำนวน',
      `คดีดำ ${targetCase.blackCaseNo}`,
      `เปิดสำนวนใหม่และเริ่มการติดตามแจ้งเตือนอีกครั้ง`,
      {
        blackCaseNo: targetCase.blackCaseNo,
        redCaseNo: targetCase.redCaseNo,
        court: targetCase.court,
      },
      caseId
    );

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

  // ปรับปุ่มเวรชี้: แค่กดแล้วขึ้นว่าเสนอเวรชี้ทันที โดยไม่ต้องเข้าไปกรอกข้อมูลอะไร
  // และให้สามารถแก้ไขหรือยกเลิกได้หากกดเสนอเวรชี้ไปแล้ว
  const handleToggleSubmitToDuty = async (caseItem: AppealCase) => {
    if (!canEdit) {
      showToast('เฉพาะแอดมินหรือผู้ร่วมแก้ไขเท่านั้นที่สามารถเสนอเวรชี้ได้');
      return;
    }

    if (!caseItem.isSubmittedToDuty) {
      // 1. ยังไม่เสนอเวรชี้: แค่กดแล้วบันทึกสถานะเสนอเวรชี้ทันที ไม่ต้องกรอกอะไร
      const submissionDate = getTodayString();
      const dutyOfficer = caseItem.prosecutorName || todayDutyOfficer || '';

      const updatedCase: AppealCase = {
        ...caseItem,
        isSubmittedToDuty: true,
        submittedToDutyDate: submissionDate,
        submittedToDutyOfficer: dutyOfficer,
        updatedAt: new Date().toISOString(),
      };

      const newCases = cases.map((c) => (c.id === caseItem.id ? updatedCase : c));
      setCases(newCases);
      saveCases(newCases);
      saveCaseToFirestore(updatedCase).catch((e) => console.warn('Firestore submit to duty error:', e));

      logAction(
        'duty_submitted',
        'เสนอเวรชี้',
        `คดีดำ ${caseItem.blackCaseNo}`,
        `เสนอสำนวนให้อัยการเวรชี้ (${dutyOfficer || 'เวรชี้'})`,
        {
          blackCaseNo: caseItem.blackCaseNo,
          dutyOfficer,
        },
        caseItem.id
      );

      showToast(`สำนวน ${caseItem.blackCaseNo} เสนอเวรชี้แล้ว เรียบร้อย`);

      const currentToken = token || (await getAccessToken());
      if (sheetConfig && currentToken && updatedCase.sheetRowIndex) {
        try {
          await updateAppealCaseInSheet(currentToken, sheetConfig.spreadsheetId, updatedCase);
        } catch (err) {
          console.error('Failed to update Google Sheet', err);
        }
      }
    } else {
      // 2. หากเสนอเวรชี้ไปแล้ว: ให้เปิดหน้าต่างแก้ไขข้อมูลเวรชี้ หรือกดยกเลิกสถานะได้
      setSelectedCaseForSubmitDuty(caseItem);
    }
  };

  // เสนอเวรชี้ (หากกดแล้วยังคงคุมระยะเวลาอุทธรณ์อยู่จนกว่าจะกดเสร็จสิ้น)
  const handleConfirmSubmitToDuty = async (
    caseId: string,
    dutyOfficer: string,
    submissionDate: string,
    notes?: string
  ) => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return;

    const updatedCase: AppealCase = {
      ...targetCase,
      isSubmittedToDuty: true,
      submittedToDutyDate: submissionDate,
      submittedToDutyOfficer: dutyOfficer,
      submittedToDutyNotes: notes !== undefined ? notes : targetCase.submittedToDutyNotes,
      updatedAt: new Date().toISOString(),
      // ข้อกำหนดสำคัญ: ยังคงคุมระยะเวลาอุทธรณ์อยู่จนกว่าจะกดเสร็จสิ้น (isCompleted ยังคงเป็นค่าเดิม)
    };

    const newCases = cases.map((c) => (c.id === caseId ? updatedCase : c));
    setCases(newCases);
    saveCases(newCases);
    saveCaseToFirestore(updatedCase).catch((e) => console.warn('Firestore submit to duty error:', e));

    logAction(
      'duty_submitted',
      'เสนอเวรชี้',
      `คดีดำ ${targetCase.blackCaseNo}`,
      `เสนอสำนวนให้อัยการเวรชี้ (${dutyOfficer}) วันที่ ${formatThaiDate(submissionDate)}${notes ? ` (หมายเหตุ: ${notes})` : ''}`,
      {
        blackCaseNo: targetCase.blackCaseNo,
        dutyOfficer,
        submissionDate,
        notes,
      },
      caseId
    );

    showToast(`สำนวน ${targetCase.blackCaseNo} เสนอเวรชี้ (${dutyOfficer}) แล้ว (ยังคงคุมระยะเวลาอุทธรณ์ตามปกติ)`);

    const currentToken = token || (await getAccessToken());
    if (sheetConfig && currentToken && updatedCase.sheetRowIndex) {
      try {
        await updateAppealCaseInSheet(currentToken, sheetConfig.spreadsheetId, updatedCase);
      } catch (err) {
        console.error('Failed to update Google Sheet', err);
      }
    }
  };

  // ยกเลิกสถานะเสนอเวรชี้
  const handleCancelSubmitToDuty = async (caseId: string) => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return;

    const updatedCase: AppealCase = {
      ...targetCase,
      isSubmittedToDuty: false,
      submittedToDutyDate: undefined,
      submittedToDutyOfficer: undefined,
      submittedToDutyNotes: undefined,
      updatedAt: new Date().toISOString(),
    };

    const newCases = cases.map((c) => (c.id === caseId ? updatedCase : c));
    setCases(newCases);
    saveCases(newCases);
    saveCaseToFirestore(updatedCase).catch((e) => console.warn('Firestore cancel submit to duty error:', e));

    logAction(
      'duty_cancelled',
      'ยกเลิกเสนอเวรชี้',
      `คดีดำ ${targetCase.blackCaseNo}`,
      `ยกเลิกสถานะเสนอเวรชี้สำหรับสำนวน ${targetCase.blackCaseNo}`,
      {
        blackCaseNo: targetCase.blackCaseNo,
      },
      caseId
    );

    showToast(`ยกเลิกสถานะเสนอเวรชี้สำหรับสำนวน ${targetCase.blackCaseNo} เรียบร้อยแล้ว`);

    const currentToken = token || (await getAccessToken());
    if (sheetConfig && currentToken && updatedCase.sheetRowIndex) {
      try {
        await updateAppealCaseInSheet(currentToken, sheetConfig.spreadsheetId, updatedCase);
      } catch (err) {
        console.error('Failed to update Google Sheet', err);
      }
    }
  };

  // Extend / Edit / Revert Appeal Deadline
  const handleConfirmExtend = async (
    caseId: string,
    newDeadline: string | null,
    extensionCount: number,
    notes?: string
  ) => {
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return;

    let updatedCase: AppealCase;
    if (!newDeadline) {
      const { extendedDeadline: _ed, extensionCount: _ec, ...rest } = targetCase;
      updatedCase = {
        ...rest,
        notes: notes ? `${targetCase.notes || ''} | ${notes}` : targetCase.notes,
        updatedAt: new Date().toISOString(),
      };
      delete updatedCase.extendedDeadline;
      delete updatedCase.extensionCount;

      logAction(
        'deadline_reverted',
        'ยกเลิกการขยายเวลา',
        `คดีดำ ${targetCase.blackCaseNo}`,
        `ยกเลิกการขยายเวลาอุทธรณ์ คืนค่าวันครบกำหนดเดิม (${formatThaiDate(targetCase.appealDeadline || '')})`,
        {
          blackCaseNo: targetCase.blackCaseNo,
          court: targetCase.court,
          previousValue: targetCase.extendedDeadline,
        },
        caseId
      );

      showToast(`ยกเลิกการขยายเวลาสำนวน ${targetCase.blackCaseNo} คืนค่าวันครบกำหนดเดิมเรียบร้อยแล้ว`);
    } else {
      updatedCase = {
        ...targetCase,
        extendedDeadline: newDeadline,
        extensionCount,
        notes: notes ? `${targetCase.notes || ''} | ${notes}` : targetCase.notes,
        updatedAt: new Date().toISOString(),
      };

      logAction(
        'deadline_extended',
        'ขยายระยะเวลาอุทธรณ์',
        `คดีดำ ${targetCase.blackCaseNo}`,
        `ขยายระยะเวลาอุทธรณ์ครั้งที่ ${extensionCount} เป็น ${formatThaiDate(newDeadline)}${notes ? ` (เหตุผล: ${notes})` : ''}`,
        {
          blackCaseNo: targetCase.blackCaseNo,
          court: targetCase.court,
          previousValue: targetCase.extendedDeadline || targetCase.appealDeadline,
          newValue: newDeadline,
          extensionCount,
          reason: notes,
        },
        caseId
      );

      showToast(`บันทึกวันขยายเวลาอุทธรณ์สำนวน ${targetCase.blackCaseNo} เป็น ${formatThaiDate(newDeadline)} (ครั้งที่ ${extensionCount}) เรียบร้อยแล้ว`);
    }

    const newCases = cases.map((c) => (c.id === caseId ? updatedCase : c));
    setCases(newCases);
    saveCases(newCases);
    saveCaseToFirestore(updatedCase).catch((e) => console.warn('Firestore extend error:', e));

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
    if (!canEdit) {
      showToast('เฉพาะแอดมินหรือผู้ร่วมแก้ไขเท่านั้นที่สามารถลบสำนวนได้ (เจ้าหน้าที่คุมอุทธรณ์ไม่มีสิทธิ์ลบสำนวน)');
      return;
    }
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

        logAction(
          'case_deleted',
          'ลบสำนวนคดี',
          `คดีดำ ${targetCase.blackCaseNo}`,
          `ลบสำนวนคดีดำ ${targetCase.blackCaseNo} ออกจากระบบ`,
          {
            blackCaseNo: targetCase.blackCaseNo,
            redCaseNo: targetCase.redCaseNo,
            court: targetCase.court,
          },
          caseId
        );

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
    const targetCase = updated.find((c) => c.id === caseId);
    if (targetCase) {
      saveCaseToFirestore(targetCase).catch((e) => console.warn('Firestore judgment save error:', e));
      logAction(
        'judgment_recorded',
        'บันทึกคำพิพากษา',
        `คดีดำ ${targetCase.blackCaseNo}`,
        `บันทึกคำพิพากษาฉบับเต็มของสำนวนคดีดำ ${targetCase.blackCaseNo}`,
        {
          blackCaseNo: targetCase.blackCaseNo,
          court: targetCase.court,
          prosecutorName: targetCase.prosecutorName || targetCase.responsiblePerson,
        },
        caseId
      );
    }
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
      isRequisitionCase?: boolean;
      requisitionDate?: string;
    },
    syncToCalendar?: boolean
  ) => {
    const updated = cases.map((c) => {
      if (c.id !== caseId) return c;
      const isConfessed = isCaseConfessed(c);
      const safeType = isConfessed && appointmentData.appointmentType === 'rights_protection'
        ? 'none'
        : appointmentData.appointmentType;
      const safeDate = isConfessed && appointmentData.appointmentType === 'rights_protection'
        ? undefined
        : appointmentData.appointmentDate;
      const safeSubsequent = isConfessed
        ? (appointmentData.subsequentAppointments || []).filter((a) => a.type !== 'rights_protection')
        : appointmentData.subsequentAppointments;

      return {
        ...c,
        ...appointmentData,
        appointmentType: safeType,
        appointmentDate: safeDate,
        subsequentAppointments: safeSubsequent,
        updatedAt: new Date().toISOString(),
      };
    });
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
    if (!canEdit) {
      showToast('เฉพาะแอดมินหรือผู้ร่วมแก้ไขเท่านั้นที่สามารถแก้ไขข้อมูลคดีได้ (เจ้าหน้าที่คุมอุทธรณ์สามารถกดได้เฉพาะเสร็จสิ้นสำนวน)');
      return;
    }
    const newCases = cases.map((c) => (c.id === updatedCase.id ? updatedCase : c));
    setCases(newCases);
    saveCases(newCases);
    saveCaseToFirestore(updatedCase).catch((e) => console.warn('Firestore update case error:', e));

    logAction(
      'case_updated',
      'แก้ไขข้อมูลสำนวน',
      `คดีดำ ${updatedCase.blackCaseNo}`,
      `แก้ไขข้อมูลสำนวนคดีดำ ${updatedCase.blackCaseNo} (อัยการ: ${updatedCase.prosecutorName || updatedCase.responsiblePerson || '-'}, ศาล: ${updatedCase.court})`,
      {
        blackCaseNo: updatedCase.blackCaseNo,
        redCaseNo: updatedCase.redCaseNo,
        court: updatedCase.court,
        prosecutorName: updatedCase.prosecutorName || updatedCase.responsiblePerson,
      },
      updatedCase.id
    );

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
    if (!canEdit) {
      showToast('เฉพาะแอดมินหรือผู้ร่วมแก้ไขเท่านั้นที่สามารถกำหนดเวรชี้ได้');
      return;
    }
    const targetCase = cases.find((c) => c.id === caseId);
    if (!targetCase) return;

    const updatedCase: AppealCase = {
      ...targetCase,
      prosecutorName: officerName,
      // Do not overwrite responsiblePerson (อัยการเจ้าของสำนวน) with duty officer
      responsiblePerson: targetCase.responsiblePerson || '',
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
    if (!canEdit) {
      showToast('เฉพาะแอดมินหรือผู้ร่วมแก้ไขเท่านั้นที่สามารถกำหนดเวรชี้ได้');
      return;
    }
    const unassignedCases = cases.filter(
      (c) => c.filingDate === filingDate && (!c.prosecutorName || !c.prosecutorName.trim())
    );
    if (unassignedCases.length === 0) {
      showToast('ทุกสำนวนในวันนี้มีชื่ออัยการเวรชี้แล้ว');
      return;
    }

    const updatedCases = cases.map((c) => {
      if (c.filingDate === filingDate && (!c.prosecutorName || !c.prosecutorName.trim())) {
        return {
          ...c,
          prosecutorName: officerName,
          // Do not overwrite responsiblePerson (อัยการเจ้าของสำนวน) with duty officer
          responsiblePerson: c.responsiblePerson || '',
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

  // Quick Change Plea Status (เปลี่ยนสถานะคำให้การจำเลยเป็น รับสารภาพ, ปฏิเสธ, เบิกฟ้อง, หรือรอนัด)
  const handleQuickChangePleaStatus = async (
    caseItem: AppealCase,
    newStatus: 'confessed' | 'denied' | 'pending' | 'requisition' | 'unspecified'
  ) => {
    if (!canEdit) {
      showToast('เฉพาะแอดมินหรือผู้ร่วมแก้ไขเท่านั้นที่สามารถแก้ไขคำให้การได้');
      return;
    }
    let updatedCase: AppealCase;
    if (newStatus === 'confessed') {
      updatedCase = {
        ...caseItem,
        isUnspecifiedStage: false,
        courtStageStatus: 'confessed',
        defendantPlea: 'confessed',
        isRequisitionCase: false,
        appointmentType: (caseItem.appointmentType === 'requisition' || caseItem.appointmentType === 'rights_protection') ? 'none' : caseItem.appointmentType,
        updatedAt: new Date().toISOString(),
      };
      if (updatedCase.subsequentAppointments) {
        updatedCase.subsequentAppointments = updatedCase.subsequentAppointments.filter((a) => a.type !== 'rights_protection');
      }
      showToast(`เลือกสถานะสำนวนคดีดำ ${caseItem.blackCaseNo} เป็น "จำเลยรับสารภาพ" (สีเหลือง) เรียบร้อยแล้ว`);
    } else if (newStatus === 'denied') {
      updatedCase = {
        ...caseItem,
        isUnspecifiedStage: false,
        courtStageStatus: 'rights_protection',
        defendantPlea: 'denied',
        isRequisitionCase: false,
        hasJudgment: false,
        judgmentDate: undefined,
        judgmentOutcome: 'อยู่ระหว่างนัดคุ้มครองสิทธิ (จำเลยให้การปฏิเสธ)',
        appealDeadline: undefined,
        extendedDeadline: undefined,
        extensionCount: undefined,
        appointmentType: (!caseItem.appointmentType || caseItem.appointmentType === 'none' || caseItem.appointmentType === 'requisition') ? 'rights_protection' : caseItem.appointmentType,
        appointmentTypeName: (!caseItem.appointmentType || caseItem.appointmentType === 'none' || caseItem.appointmentType === 'requisition') ? 'นัดคุ้มครองสิทธิ' : caseItem.appointmentTypeName,
        appointmentDate: caseItem.appointmentDate || getTodayString(),
        updatedAt: new Date().toISOString(),
      };
      showToast(`เลือกสถานะสำนวนคดีดำ ${caseItem.blackCaseNo} เป็น "จำเลยให้การปฏิเสธ / คุ้มครองสิทธิ" (สีส้ม) เรียบร้อยแล้ว`);
    } else if (newStatus === 'requisition') {
      updatedCase = {
        ...caseItem,
        isUnspecifiedStage: false,
        courtStageStatus: 'requisition',
        isRequisitionCase: true,
        appointmentType: 'requisition',
        appointmentTypeName: 'สำนวนเบิกฟ้อง',
        appointmentDate: caseItem.appointmentDate || getTodayString(),
        requisitionDate: caseItem.requisitionDate || caseItem.appointmentDate || getTodayString(),
        defendantPlea: 'pending',
        hasJudgment: false,
        judgmentDate: undefined,
        judgmentOutcome: 'สำนวนเบิกฟ้อง (รอเบิกตัวมาฟ้อง / ยังไม่ทราบคำให้การ)',
        appealDeadline: undefined,
        extendedDeadline: undefined,
        extensionCount: undefined,
        updatedAt: new Date().toISOString(),
      };
      showToast(`เลือกสถานะสำนวนคดีดำ ${caseItem.blackCaseNo} เป็น "สำนวนมีเบิกฟ้อง" (สีเขียว) เรียบร้อยแล้ว`);
    } else if (newStatus === 'unspecified') {
      updatedCase = {
        ...caseItem,
        isUnspecifiedStage: true,
        courtStageStatus: 'unspecified',
        defendantPlea: undefined,
        appointmentType: 'none',
        hasJudgment: false,
        judgmentDate: undefined,
        judgmentOutcome: '',
        appealDeadline: undefined,
        extendedDeadline: undefined,
        extensionCount: undefined,
        isRequisitionCase: false,
        updatedAt: new Date().toISOString(),
      };
      showToast(`ปรับสถานะสำนวนคดีดำ ${caseItem.blackCaseNo} เป็น "ยังไม่เลือกสถานะ (คุมสำนวนฟ้องไว้ก่อน)" (สีแดงเตือน) เรียบร้อยแล้ว`);
    } else {
      updatedCase = {
        ...caseItem,
        isUnspecifiedStage: false,
        courtStageStatus: 'other',
        defendantPlea: 'pending',
        isRequisitionCase: false,
        updatedAt: new Date().toISOString(),
      };
      showToast(`เลือกสถานะสำนวนคดีดำ ${caseItem.blackCaseNo} เป็น "มีนัดอื่นๆ / ยังไม่ทราบคำให้การ" (สีฟ้า) เรียบร้อยแล้ว`);
    }

    const newCases = cases.map((c) => (c.id === caseItem.id ? updatedCase : c));
    setCases(newCases);
    saveCases(newCases);
    saveCaseToFirestore(updatedCase).catch((e: any) => console.warn('Firestore update case error:', e));

    const currentToken = token || (await getAccessToken());
    if (sheetConfig && currentToken && updatedCase.sheetRowIndex) {
      try {
        await updateAppealCaseInSheet(currentToken, sheetConfig.spreadsheetId, updatedCase);
      } catch (err) {
        console.error('Failed to update case status in Google Sheet', err);
      }
    }
  };

  // Quick Change Requisition Case Status (รองรับการเรียกใช้เดิม)
  const handleQuickChangeRequisitionStatus = async (caseItem: AppealCase, newStatus: 'confessed' | 'denied') => {
    return handleQuickChangePleaStatus(caseItem, newStatus);
  };

  // สลับสถานะสำนวนจำหน่ายคดีออกจากสารบบชั่วคราวเนื่องจากจำเลยหลบหนี
  // หากเป็น true -> จำหน่ายคดีชั่วคราว ไม่ต้องคุมอุทธรณ์ระหว่างหลบหนี
  // หากเป็น false -> จับกุมตัวได้แล้ว กลับมาคุมอุทธรณ์ตามเดิมทันที
  const handleToggleTemporaryDischarge = async (
    caseItem: AppealCase,
    isDischarged: boolean,
    recapturedDate?: string
  ) => {
    if (!canEdit) {
      showToast('เฉพาะแอดมินหรือผู้ร่วมแก้ไขเท่านั้นที่สามารถเปลี่ยนสถานะจำหน่ายชั่วคราวได้');
      return;
    }

    const updatedCase: AppealCase = {
      ...caseItem,
      isTemporarilyDischarged: isDischarged,
      temporaryDischargeDate: isDischarged ? (caseItem.temporaryDischargeDate || getTodayString()) : caseItem.temporaryDischargeDate,
      recapturedDate: !isDischarged ? (recapturedDate || getTodayString()) : undefined,
      courtStageStatus: isDischarged ? 'temporarily_discharged' : (caseItem.courtStageStatus === 'temporarily_discharged' ? 'confessed' : caseItem.courtStageStatus),
      updatedAt: new Date().toISOString(),
    };

    const newCases = cases.map((c) => (c.id === caseItem.id ? updatedCase : c));
    setCases(newCases);
    saveCases(newCases);
    saveCaseToFirestore(updatedCase).catch((e: any) => console.warn('Firestore toggle temp discharge error:', e));

    if (isDischarged) {
      showToast(`สำนวนคดีดำ ${caseItem.blackCaseNo} จำหน่ายคดีออกจากสารบบชั่วคราวแล้ว (ไม่ต้องคุมอุทธรณ์)`);
    } else {
      showToast(`🟢 จำเลยสำนวนคดีดำ ${caseItem.blackCaseNo} ถูกจับกุมตัวแล้ว — กลับมาคุมอุทธรณ์ตามเดิมเรียบร้อย`);
    }

    const currentToken = token || (await getAccessToken());
    if (sheetConfig && currentToken && updatedCase.sheetRowIndex) {
      try {
        await updateAppealCaseInSheet(currentToken, sheetConfig.spreadsheetId, updatedCase);
      } catch (err) {
        console.error('Failed to update Google Sheet', err);
      }
    }
  };

  // Record Judgment for case transitioning from pending hearings to appeal tracking
  const handleSaveJudgmentDate = async (
    caseId: string,
    judgmentData: {
      judgmentDate: string;
      redCaseNo?: string;
      judgmentOutcome: string;
      appealDeadline: string;
      fullJudgmentText?: string;
      judgmentPhotoUrl?: string | null;
      judgmentPhotoName?: string;
      judgmentVerified?: boolean;
      judgmentVerifiedBy?: string;
      judgmentRecheckNotes?: string;
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
      fullJudgmentText:
        judgmentData.fullJudgmentText !== undefined ? judgmentData.fullJudgmentText : target.fullJudgmentText,
      appealDeadline: judgmentData.appealDeadline,
      judgmentPhotoUrl:
        judgmentData.judgmentPhotoUrl !== undefined ? judgmentData.judgmentPhotoUrl : target.judgmentPhotoUrl,
      judgmentPhotoName:
        judgmentData.judgmentPhotoName !== undefined ? judgmentData.judgmentPhotoName : target.judgmentPhotoName,
      judgmentVerified:
        judgmentData.judgmentVerified !== undefined ? judgmentData.judgmentVerified : target.judgmentVerified,
      judgmentVerifiedBy:
        judgmentData.judgmentVerifiedBy !== undefined ? judgmentData.judgmentVerifiedBy : target.judgmentVerifiedBy,
      judgmentRecheckNotes:
        judgmentData.judgmentRecheckNotes !== undefined ? judgmentData.judgmentRecheckNotes : target.judgmentRecheckNotes,
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

  // Recheck handlers: Save verified judgment text & screenshot photo
  const handleSaveCaseRecheck = async (
    caseId: string,
    judgmentText: string,
    photoUrl?: string,
    photoName?: string,
    isVerified?: boolean,
    verifiedBy?: string,
    notes?: string
  ) => {
    const target = cases.find((c) => c.id === caseId);
    if (!target) return;

    const updatedCase: AppealCase = {
      ...target,
      fullJudgmentText: judgmentText,
      judgmentOutcome: target.judgmentOutcome || (judgmentText.slice(0, 80) + (judgmentText.length > 80 ? '...' : '')),
      judgmentPhotoUrl: photoUrl !== undefined ? photoUrl : target.judgmentPhotoUrl,
      judgmentPhotoName: photoName !== undefined ? photoName : target.judgmentPhotoName,
      judgmentVerified: isVerified !== undefined ? isVerified : target.judgmentVerified,
      judgmentVerifiedBy: verifiedBy || target.judgmentVerifiedBy,
      judgmentRecheckNotes: notes !== undefined ? notes : target.judgmentRecheckNotes,
      updatedAt: new Date().toISOString(),
    };

    const newCases = cases.map((c) => (c.id === caseId ? updatedCase : c));
    setCases(newCases);
    saveCases(newCases);
    saveCaseToFirestore(updatedCase).catch((e) => console.warn('Firestore save recheck error:', e));
    showToast(`บันทึกการตรวจทานคำพิพากษาคดีดำ ${target.blackCaseNo} เรียบร้อยแล้ว`);
  };

  const handleSaveFollowUpRecheck = async (
    followUpId: string,
    judgmentSummary: string,
    photoUrl?: string,
    photoName?: string,
    isVerified?: boolean,
    verifiedBy?: string,
    notes?: string
  ) => {
    const target = followUps.find((f) => f.id === followUpId);
    if (!target) return;

    const updatedFollowUp: DailyJudgmentFollowUp = {
      ...target,
      judgmentSummary,
      judgmentPhotoUrl: photoUrl !== undefined ? photoUrl : target.judgmentPhotoUrl,
      judgmentPhotoName: photoName !== undefined ? photoName : target.judgmentPhotoName,
      judgmentVerified: isVerified !== undefined ? isVerified : target.judgmentVerified,
      judgmentVerifiedBy: verifiedBy || target.judgmentVerifiedBy,
      notes: notes !== undefined ? notes : target.notes,
    };

    const newFollowUps = followUps.map((f) => (f.id === followUpId ? updatedFollowUp : f));
    setFollowUps(newFollowUps);
    saveFollowUps(newFollowUps);
    saveFollowUpToFirestore(updatedFollowUp).catch((e) => console.warn('Firestore save follow-up recheck error:', e));
    showToast(`บันทึกการตรวจทานคำพิพากษาคดี ${target.caseNumber} เรียบร้อยแล้ว`);
  };

  const handleOpenCaseRecheck = (caseItem: AppealCase) => {
    setRecheckTarget({ type: 'case', data: caseItem });
    setIsRecheckModalOpen(true);
  };

  const handleOpenFollowUpRecheck = (followUp: DailyJudgmentFollowUp) => {
    setRecheckTarget({ type: 'followup', data: followUp });
    setIsRecheckModalOpen(true);
  };

  // Clear Judgment (ปรับสถานะเป็นยังไม่กรอกคำพิพากษา)
  const handleClearJudgment = async (caseId: string) => {
    const target = cases.find((c) => c.id === caseId);
    if (!target) return;

    const updatedCase: AppealCase = {
      ...target,
      hasJudgment: false,
      judgmentDate: undefined,
      judgmentOutcome: undefined,
      fullJudgmentText: undefined,
      appealDeadline: undefined,
      extendedDeadline: undefined,
      extensionCount: undefined,
      updatedAt: new Date().toISOString(),
    };

    const newCases = cases.map((c) => (c.id === caseId ? updatedCase : c));
    setCases(newCases);
    saveCases(newCases);
    saveCaseToFirestore(updatedCase).catch((e) => console.warn('Firestore clear judgment error:', e));
    showToast(`ปรับสถานะสำนวนดำ ${target.blackCaseNo} เป็น "ยังไม่กรอกคำพิพากษา" เรียบร้อยแล้ว`);

    const currentToken = token || (await getAccessToken());
    if (sheetConfig && currentToken && updatedCase.sheetRowIndex) {
      try {
        await updateAppealCaseInSheet(currentToken, sheetConfig.spreadsheetId, updatedCase);
      } catch (err) {
        console.error('Failed to update Google Sheet', err);
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

    logAction(
      'roster_uploaded',
      'อัปโหลดตารางเวรชี้',
      newRoster.monthNameThai,
      `อัปโหลดตารางเวรชี้ประจำเดือน ${newRoster.monthNameThai} (${newRoster.totalDays} วัน)`,
      { monthYear: newRoster.monthYear, totalDays: newRoster.totalDays }
    );

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
        onPinLogin={handlePinLogin}
        onGuestLogin={handleGuestLogin}
        isLoggingIn={isLoggingIn}
        loginError={loginError}
        adminPin={projectSettings.adminPin || DEFAULT_ADMIN_PIN}
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
        onOpenAdminPinLogin={() => setIsAdminPinModalOpen(true)}
        onLogout={handleLogout}
        onOpenSheetSettings={() => setIsSheetModalOpen(true)}
        onOpenPermissionsModal={() => setIsPermissionsModalOpen(true)}
        onRequestEditPermission={() => setIsRequestEditModalOpen(true)}
        onSync={handleSyncWithSheet}
        isSyncing={isSyncing}
        onPushLocalToCloud={handlePushLocalToCloud}
        isPushingLocal={isPushingLocal}
        onDownloadBackup={userRole === 'admin' ? handleDownloadJsonBackup : undefined}
        onOpenBackupViewer={() => setIsBackupViewerOpen(true)}
        onOpenActivityLog={userRole === 'admin' ? () => handleOpenActivityLog() : undefined}
        activityLogsCount={userRole === 'admin' ? activityLogs.length : 0}
        connectionStatus={connectionStatus}
        firebaseProjectId={FIREBASE_PROJECT_ID}
        onOpenRulesGuide={() => setIsRulesGuideOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Firebase Permission Warning Banner if Rules Block Access */}
        {connectionStatus === 'error' && (
          <div className="mb-5 bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 text-white rounded-2xl p-4 border border-rose-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-in fade-in">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center flex-shrink-0 border border-rose-500/30">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white font-['Prompt']">
                    การซิงค์เรียลไทม์กับ Firebase ({FIREBASE_PROJECT_ID}) ยังติดสิทธิ์ (Permission Denied)
                  </span>
                  <span className="bg-rose-500/20 text-rose-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-rose-500/30">
                    เครื่องอื่นจะไม่เห็นข้อมูล
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  ฐานข้อมูล Firebase ของโปรเจ็กต์ <strong className="text-white font-mono">{FIREBASE_PROJECT_ID}</strong> ยังไม่ได้เปิด Security Rules ให้อนุญาตอ่าน/เขียน ทำให้เครื่องอื่นถูกปฏิเสธการเชื่อมต่อ
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsRulesGuideOpen(true)}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>คลิกดูวิธีเปิดสิทธิ์ใน Firebase Console (1 นาที)</span>
              </button>
            </div>
          </div>
        )}

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
                  ข้อมูลสำนวนคดีและตารางเวรชี้อัปเดตเป็นปัจจุบันแบบเรียลไทม์จากแอดมิน ({ADMIN_EMAIL}) หากมีรหัส PIN แอดมิน สามารถกดปลดล็อคสิทธิ์แก้ไขได้ทันที
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsAdminPinModalOpen(true)}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>🔑 ปลดล็อคแอดมินด้วย PIN</span>
              </button>
              <button
                type="button"
                onClick={() => setIsRequestEditModalOpen(true)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-semibold px-3.5 py-2.5 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4 text-blue-400" />
                <span>ขอสิทธิ์แก้ไข</span>
              </button>
            </div>
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
          onConfirmNoAppeal={handleConfirmNoAppeal}
          onSyncCalendar={handleSyncCalendarSingle}
          onSendEmailAlert={(caseItem) => setSelectedCaseForEmailAlert(caseItem)}
          onSendAllUrgentEmails={handleSendAllUrgentEmails}
          onQuickChangeRequisitionStatus={handleQuickChangeRequisitionStatus}
          onRecordJudgment={(caseItem) => {
            setSelectedCaseForRecordJudgment(caseItem);
            setIsRecordJudgmentOpen(true);
          }}
          onEditCase={(caseItem) => {
            setSelectedCaseForEdit(caseItem);
            setIsEditCaseOpen(true);
          }}
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

            {/* Tab 3: ตารางเวรชี้ประจำเดือน */}
            <button
              onClick={() => setActiveTab('duty_roster')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'duty_roster'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>ตารางเวรชี้ประจำเดือน</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'duty_roster' ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-700'}`}>
                {dutyRosters.length} รอบเดือน
              </span>
            </button>

            {/* Tab 4: สรุปสิ้นเดือน (แยกรายอัยการ) */}
            <button
              onClick={() => setActiveTab('monthly_prosecutor')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'monthly_prosecutor'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-emerald-300" />
              <span>สรุปสิ้นเดือน (แยกรายอัยการ)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === 'monthly_prosecutor' ? 'bg-emerald-900 text-amber-300' : 'bg-emerald-50 text-emerald-800'}`}>
                รับสารภาพ/ปฏิเสธ
              </span>
            </button>

            {/* Tab 5: สรุปวันนัดศาลรายเดือน (คุ้มครองสิทธิ • สืบเสาะ • นัดสืบประกอบรับสารภาพ) */}
            <button
              onClick={() => setActiveTab('prosecutor_hearings')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'prosecutor_hearings'
                  ? 'bg-blue-800 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Calendar className="w-4 h-4 text-amber-300" />
              <span>วันนัดศาลรายเดือน (อัยการ)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === 'prosecutor_hearings' ? 'bg-blue-950 text-amber-300' : 'bg-blue-50 text-blue-800'}`}>
                คุ้มครองสิทธิ/สืบเสาะ
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setAddCaseInitialFilingDate(undefined);
                  setAddCaseInitialResponsiblePerson(undefined);
                  setIsAddCaseOpen(true);
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
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
            canComplete={canComplete}
            initialFilter={statsFilter}
            externalSearchTerm={globalVoiceQuery}
            onMarkComplete={(caseItem) => setSelectedCaseForComplete(caseItem)}
            onExtendDeadline={(caseItem) => setSelectedCaseForExtend(caseItem)}
            onConfirmNoAppeal={handleConfirmNoAppeal}
            onRecordJudgment={(caseItem) => {
              setSelectedCaseForRecordJudgment(caseItem);
              setIsRecordJudgmentOpen(true);
            }}
            onOpenJudgmentRecheck={handleOpenCaseRecheck}
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
            onOpenCourtPetition={(caseItem) => setSelectedCaseForCourtPetition({ caseItem })}
            onQuickChangeRequisitionStatus={handleQuickChangeRequisitionStatus}
            onQuickChangePleaStatus={handleQuickChangePleaStatus}
            onOpenSubmitToDuty={handleToggleSubmitToDuty}
            onToggleTemporaryDischarge={handleToggleTemporaryDischarge}
            onOpenActivityLog={userRole === 'admin' ? handleOpenActivityLog : undefined}
            onToast={showToast}
          />
        )}

        {/* Tab 2: วันที่ฟ้อง (เลือกวันที่ต้องการ แล้วปรากฎจำนวนคดีที่ฟ้องในวันนั้น) */}
        {activeTab === 'filing_date' && (
          <DailyFilingByDateView
            cases={cases}
            dutyRosters={dutyRosters}
            canEdit={canEdit}
            canComplete={canComplete}
            token={token}
            sheetConfig={sheetConfig}
            initialSelectedDate={addCaseInitialFilingDate}
            externalDateSearch={globalVoiceQuery}
            onMarkComplete={(caseItem) => setSelectedCaseForComplete(caseItem)}
            onConfirmNoAppeal={handleConfirmNoAppeal}
            onExtendDeadline={(caseItem) => setSelectedCaseForExtend(caseItem)}
            onEditCase={(caseItem) => {
              setSelectedCaseForEdit(caseItem);
              setIsEditCaseOpen(true);
            }}
            onRecordJudgment={(caseItem) => {
              setSelectedCaseForRecordJudgment(caseItem);
              setIsRecordJudgmentOpen(true);
            }}
            onOpenJudgmentRecheck={handleOpenCaseRecheck}
            onOpenJudgmentDoc={(caseItem) => setSelectedCaseForJudgmentDoc(caseItem)}
            onExportDailyDoc={handleExportDailyDoc}
            onOpenAppointmentModal={(caseItem) => setSelectedCaseForAppointment(caseItem)}
            onAddNewCaseForDate={(dateStr) => {
              setAddCaseInitialFilingDate(dateStr);
              setIsAddCaseOpen(true);
            }}
            onQuickAssignOfficer={handleQuickAssignOfficer}
            onBatchAssignOfficerToDate={handleBatchAssignOfficerToDate}
            onDeleteCase={handleDeleteCase}
            onOpenCourtPetition={(caseItem) => setSelectedCaseForCourtPetition({ caseItem })}
            onQuickChangeRequisitionStatus={handleQuickChangeRequisitionStatus}
            onQuickChangePleaStatus={handleQuickChangePleaStatus}
            onOpenMonthlyProsecutorSummary={(yearMonth) => {
              setMonthlySummaryInitialMonth(yearMonth);
              setActiveTab('monthly_prosecutor');
            }}
            onOpenSubmitToDuty={handleToggleSubmitToDuty}
            onToggleTemporaryDischarge={handleToggleTemporaryDischarge}
            onToast={showToast}
          />
        )}

        {/* Tab 3: Monthly Duty Roster (พิมพ์กรอกตารางเวรชี้ประจำเดือน) */}
        {activeTab === 'duty_roster' && (
          <DutyRosterView
            rosters={dutyRosters}
            activeRosterId={activeDutyRosterId}
            canEdit={canEdit}
            onSelectRoster={(id) => setActiveDutyRosterId(id)}
            onOpenUploadModal={() => {
              setDutyRosterEditTargetId(undefined);
              setIsUploadDutyModalOpen(true);
            }}
            onOpenEditRosterModal={(id) => {
              setDutyRosterEditTargetId(id);
              setIsUploadDutyModalOpen(true);
            }}
            onDeleteRoster={handleDeleteDutyRoster}
            onUpdateDutyRecord={handleUpdateDutyRecord}
            onUseOfficerForNewCase={handleUseOfficerForNewCase}
            onFilterCasesByOfficer={handleFilterCasesByOfficer}
            showToast={showToast}
          />
        )}

        {/* Tab 4: Monthly Prosecutor Filing Summary (ทุกสิ้นเดือน สรุปปริมาณคดีแยกรายอัยการ พร้อมรับสารภาพ/ปฏิเสธ) */}
        {activeTab === 'monthly_prosecutor' && (
          <MonthlyProsecutorSummaryView
            cases={cases}
            initialYearMonth={monthlySummaryInitialMonth}
            onSelectCase={(caseItem) => {
              setSelectedCaseForEdit(caseItem);
              setIsEditCaseOpen(true);
            }}
            onUpdateCase={handleSaveEditedCase}
            onQuickChangePleaStatus={handleQuickChangePleaStatus}
            onToast={showToast}
          />
        )}

        {/* Tab 5: Monthly Prosecutor Court Hearing Schedule (คุ้มครองสิทธิ • สืบเสาะ • นัดสืบประกอบรับสารภาพ) */}
        {activeTab === 'prosecutor_hearings' && (
          <MonthlyProsecutorHearingScheduleView
            cases={cases}
            initialYearMonth={monthlySummaryInitialMonth}
            onSelectCase={(caseItem) => {
              setSelectedCaseForEdit(caseItem);
              setIsEditCaseOpen(true);
            }}
            onOpenSubmitToDuty={handleToggleSubmitToDuty}
            onToast={showToast}
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
            เชื่อมต่อ Google Sheets และระบบตารางเวรชี้อัยการประจำเดือน • ซิงค์แบบเรียลไทม์
          </div>
        </div>
      </footer>

      {/* Modals */}
      {isAddCaseOpen && (
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
          existingCases={cases}
        />
      )}

      {isUploadDutyModalOpen && (
        <DutyRosterEntryModal
          isOpen={isUploadDutyModalOpen}
          onClose={() => {
            setIsUploadDutyModalOpen(false);
            setDutyRosterEditTargetId(undefined);
          }}
          onSuccess={handleRosterUploaded}
          existingRosters={dutyRosters}
          existingCases={cases}
          initialRosterId={dutyRosterEditTargetId}
          showToast={showToast}
        />
      )}

      <CompleteModal
        isOpen={!!selectedCaseForComplete}
        caseItem={selectedCaseForComplete}
        onClose={() => setSelectedCaseForComplete(null)}
        onConfirmComplete={handleConfirmComplete}
        onReopenCase={handleReopenCase}
      />

      <SubmitToDutyModal
        isOpen={!!selectedCaseForSubmitDuty}
        caseItem={selectedCaseForSubmitDuty}
        dutyRosters={dutyRosters}
        existingCases={cases}
        onClose={() => setSelectedCaseForSubmitDuty(null)}
        onConfirmSubmitToDuty={handleConfirmSubmitToDuty}
        onCancelSubmitToDuty={handleCancelSubmitToDuty}
        onToast={showToast}
      />

      <ExtendDeadlineModal
        isOpen={!!selectedCaseForExtend}
        caseItem={selectedCaseForExtend}
        onClose={() => setSelectedCaseForExtend(null)}
        onConfirmExtend={handleConfirmExtend}
        token={token}
        onToast={showToast}
        onOpenCourtPetition={(caseItem, newDeadline, extensionCount) => {
          setSelectedCaseForExtend(null);
          setSelectedCaseForCourtPetition({ caseItem, newDeadline, extensionCount });
        }}
      />

      <CourtPetitionModal
        isOpen={!!selectedCaseForCourtPetition}
        caseItem={selectedCaseForCourtPetition?.caseItem || null}
        defaultNewDeadline={selectedCaseForCourtPetition?.newDeadline}
        defaultExtensionCount={selectedCaseForCourtPetition?.extensionCount}
        token={token}
        onToast={showToast}
        onClose={() => setSelectedCaseForCourtPetition(null)}
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
        readOnly={!canEdit}
        onClose={() => {
          setIsEditCaseOpen(false);
          setSelectedCaseForEdit(null);
        }}
        onSave={handleSaveEditedCase}
        onOpenCourtPetition={(caseItem: AppealCase, newDeadline?: string, extensionCount?: number) => {
          setIsEditCaseOpen(false);
          setSelectedCaseForEdit(null);
          setSelectedCaseForCourtPetition({ caseItem, newDeadline, extensionCount });
        }}
        suggestedDutyOfficer={todayDutyOfficer}
        dutyRosters={dutyRosters}
        existingCases={cases}
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
        onClearJudgment={handleClearJudgment}
        onOpenFullRecheckModal={(c) => handleOpenCaseRecheck(c)}
        onOpenCourtPetition={(caseItem, newDeadline, extensionCount) => {
          setIsRecordJudgmentOpen(false);
          setSelectedCaseForRecordJudgment(null);
          setSelectedCaseForCourtPetition({ caseItem, newDeadline, extensionCount });
        }}
      />

      {/* Judgment Recheck Modal (ตรวจทานเทียบเคียงข้อความคำพิพากษากับภาพถ่าย/แคปหน้าจอต้นฉบับ แบบแบ่ง 2 ฝั่ง) */}
      <JudgmentRecheckModal
        isOpen={isRecheckModalOpen && !!recheckTarget}
        target={recheckTarget}
        onClose={() => {
          setIsRecheckModalOpen(false);
          setRecheckTarget(null);
        }}
        token={token}
        onSaveCaseRecheck={handleSaveCaseRecheck}
        onSaveFollowUpRecheck={handleSaveFollowUpRecheck}
        onLoginPrompt={handleLogin}
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
        onAddAppealOfficer={handleAddAppealOfficer}
        onRemoveAppealOfficer={handleRemoveAppealOfficer}
        onUpdateAdminPin={handleUpdateAdminPin}
        onDownloadBackup={userRole === 'admin' ? handleDownloadJsonBackup : undefined}
        onOpenBackupViewer={() => setIsBackupViewerOpen(true)}
        backupCounts={{ cases: cases.length, dutyRosters: dutyRosters.length, followUps: followUps.length }}
        isProcessing={isProcessingPermissions}
      />

      {/* JSON Backup Viewer Modal */}
      <BackupViewerModal
        isOpen={isBackupViewerOpen}
        onClose={() => setIsBackupViewerOpen(false)}
        currentCases={cases}
        currentDutyRosters={dutyRosters}
        currentFollowUps={followUps}
        userEmail={user?.email || (isPinAdmin ? 'Admin (PIN)' : undefined)}
        onToast={showToast}
      />

      {/* Activity Log (ประวัติการทำงาน) Modal - เข้าดูได้เฉพาะแอดมินเท่านั้น */}
      {userRole === 'admin' && (
        <ActivityLogModal
          isOpen={isActivityLogOpen}
          onClose={() => setIsActivityLogOpen(false)}
          logs={activityLogs}
          initialCaseFilter={activityLogCaseFilter}
          onSelectCase={(caseNumber) => {
            setGlobalVoiceQuery(caseNumber);
            setActiveTab('all');
          }}
          onRefresh={() => {
            showToast('รีเฟรชประวัติกิจกรรมเรียบร้อย');
          }}
        />
      )}

      {/* Admin PIN Login Modal (Quick Unlock for Viewers or Guests) */}
      <AdminLoginModal
        isOpen={isAdminPinModalOpen}
        onClose={() => setIsAdminPinModalOpen(false)}
        onSuccess={handlePinLogin}
        adminPin={projectSettings.adminPin || DEFAULT_ADMIN_PIN}
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

      <FirebaseRulesGuideModal
        isOpen={isRulesGuideOpen}
        onClose={() => setIsRulesGuideOpen(false)}
        projectId={FIREBASE_PROJECT_ID}
        onRetryConnection={checkConnection}
      />
    </div>
  );
}
