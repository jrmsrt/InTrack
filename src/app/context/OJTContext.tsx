import { createRequirementChecklist } from '../domain/requirementChecklist';
import type { UploadedDocument } from '../lib/uploadedDocument';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth, AuthorizedStudent } from './AuthContext';
import { loadApiState, saveApiState } from '../lib/apiState';
import { initialAuthorizedStudents as uploadedAuthorizedStudents } from '../data/initialAuthorizedStudents';
import { moaStatuses, type MoaStatus } from '../domain/contracts';
import { canSetMoaStatus, moaIsAccepted } from '../domain/policy';
import { addedPreOJTRequirements, addedPostOJTRequirements, appendMissingRequirements } from '../domain/portfolioContents';

// Define OJT Stages
export type OJTStage = 'Stage 1: Pre-OJT' | 'Stage 2: During OJT' | 'Stage 3: Post-OJT' | 'Stage 4: Portfolio Completion';
export type CoordinatorReviewStatus = 'Pending' | 'Verified' | 'Needs Attention';
export type RequirementStage = 'pre' | 'during' | 'post';

export interface ReviewHistoryEntry {
  role: 'Student' | 'Adviser' | 'Coordinator';
  action: string;
  remarks: string;
  timestamp: string;
}

export interface RequirementItem {
  description?: string;
  name: string;
  status: 'Not Submitted' | 'Submitted' | 'Under Review' | 'Needs Revision' | 'Approved' | 'Rejected';
  fileName: string | null;
  file?: UploadedDocument | null;
  remarks: string;
  submittedAt?: string;
  reviewedAt?: string;
  revisionCount?: number;
  updatedAt?: string;
  coordinatorStatus?: CoordinatorReviewStatus;
  coordinatorRemarks?: string;
  coordinatorReviewedAt?: string;
  reviewHistory?: ReviewHistoryEntry[];
}

export interface MOAState {
  status: MoaStatus;
  pendingUpload?: { fileName: string; file: UploadedDocument | null; submittedAt: string };
  fileName: string | null;
  file?: UploadedDocument | null;
  remarks: string;
  timeline: { date: string; status: string; remarks: string }[];
  submittedAt?: string;
  reviewedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  timeIn: string;
  timeOut: string | null;
  totalHours: number;
  locationStatus: 'Location Verified' | 'Outside Deployment Area' | 'Location Permission Denied' | 'Invalid Location' | 'Attendance Recorded';
  gpsCoordinates: { lat: number; lng: number } | null;
  remarks: string;
  deviceInfo: string;
  attendanceStatus: 'Present' | 'Incomplete Time Out' | 'Location Verified' | 'Outside Deployment Area' | 'Late' | 'Absent';
  correction?: AttendanceCorrection;
}

export interface AttendanceCorrection {
  id: string;
  originalTimeIn: string;
  originalTimeOut: string | null;
  requestedTimeIn: string;
  requestedTimeOut: string | null;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  requestedAt: string;
  approver?: string;
  decidedAt?: string;
  decisionRemarks?: string;
  auditTrail: { action: string; actor: string; timestamp: string; details: string }[];
}

export interface DTRRecord {
  id: string;
  month: string;
  startDate: string;
  endDate: string;
  status: 'Draft' | 'Generated' | 'Submitted' | 'Under Review' | 'Needs Revision' | 'Revision Requested' | 'Approved';
  remarks: string;
  ojtAssignmentId?: string;
  adviserId?: string;
  generatedAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  includedAttendanceRecordIds?: string[];
  version?: number;
  revisionCount?: number;
  reviewHistory?: { action: string; remarks: string; timestamp: string }[];
  totalHours: number;
  logs: {
    attendanceRecordId?: string;
    date: string;
    timeIn: string;
    timeOut: string | null;
    totalHours: number;
    locationStatus: string;
    gpsCoordinates: { lat: number; lng: number } | null;
  }[];
}

export interface DailyTask {
  id: string;
  date: string;
  timeStarted: string;
  timeEnded: string;
  title: string;
  description: string;
  output: string;
  skillsApplied: string;
  problemsEncountered: string;
  attachmentName: string | null;
  status: 'Draft' | 'Submitted' | 'Reviewed' | 'Needs Revision' | 'Approved';
  remarks?: string;
}

export interface WeeklyJournal {
  id: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  tasks: DailyTask[];
  reflection: string;
  problems: string;
  totalHours: number;
  status: 'Draft' | 'Submitted' | 'Needs Revision' | 'Approved';
  remarks?: string;
  submittedAt?: string;
}

export interface EvaluationForm {
  id: string;
  program: string;
  title: string;
  criteria: { id: string; criteriaName: string; maxPoints: number; score: number }[];
  comments: string;
  ratingScale: number; // e.g., 5-point scale
  status: 'Draft' | 'Submitted';
  submittedAt?: string;
}

export interface Company {
  id: string;
  name: string;
  address: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  latitude: number;
  longitude: number;
  allowedRadius: number; // in meters
}

export interface HTEPartner {
  id: string;
  companyName: string;
  address: string;
  supervisorName: string;
  email: string;
  phone: string;
  dateNotarized: string;
  status: 'Active' | 'Pending' | 'Archived';
}

export interface StudentOJTProfile {
  studentId: string;
  studentNumber: string;
  name: string;
  email: string;
  program: string;
  section: string;
  adviserId: string; // references Adviser user ID
  adviserName: string;
  companyId: string; // references Company ID
  companyName: string;
  stage: OJTStage;
  totalHoursRendered: number;
  requiredHours: number;
  preOJTRequirements: RequirementItem[];
  moaState: MOAState;
  attendanceHistory: AttendanceRecord[];
  dtrHistory: DTRRecord[];
  dailyTasks: DailyTask[];
  weeklyJournals: WeeklyJournal[];
  duringOJTRequirements: RequirementItem[];
  postOJTRequirements: RequirementItem[];
  midtermEvaluation: EvaluationForm | null;
  finalEvaluation: EvaluationForm | null;
  portfolioApproved: boolean;
  portfolioRemarks: string;
  portfolioSubmitted: boolean;
  portfolioSubmittedAt?: string;
  portfolioAdviserReviewedAt?: string;
  coordinatorPortfolioStatus?: 'Pending' | 'Approved' | 'Needs Revision';
  coordinatorPortfolioRemarks?: string;
  coordinatorPortfolioReviewedAt?: string;
  portfolioReviewHistory?: ReviewHistoryEntry[];
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: 'Info' | 'Important' | 'Urgent';
  targetRole: 'all' | 'student' | 'adviser';
  section?: string;
  author: string;
  publishDate: string;
}

export interface Message {
  id: string;
  fromId: string;
  fromName: string;
  fromRole: string;
  toId: string;
  toName: string;
  message: string;
  timestamp: string;
  unread: boolean;
}

export interface Template {
  id: string;
  programId?: string;
  programCode?: string;
  revision?: number;
  backendTemplate?: boolean;
  name: string;
  category: 'Pre-OJT' | 'During-OJT' | 'Post-OJT' | 'Portfolio' | 'Evaluation';
  description: string;
  linkUrl: string;
  status: 'Published' | 'Disabled';
  lastUpdated: string;
}

export interface OJTContextType {
  isBackendConnected?: boolean;
  studentEnrollmentStatus?: 'not_enrolled' | 'enrolled';
  availableAdviserPaths?: string[];
  refreshStudentRecords?: () => void;
  uploadRequirementFile?: (stage: RequirementStage, name: string, file: File) => Promise<void>;
  submitPhysicalRequirement?: (stage: RequirementStage, name: string, note: string) => Promise<void>;
  savedNotifications?: {id:string;title:string;body:string;createdAt:string;unread:boolean}[];
  students: StudentOJTProfile[];
  companies: Company[];
  htePartners: HTEPartner[];
  announcements: Announcement[];
  messages: Message[];
  templates: Template[];
  evaluationFormConfigs: any[];
  systemSettings: {
    academicYear: string;
    semester: string;
    requiredHours: number;
    defaultRadius: number;
  };
  mockLocation: { lat: number; lng: number; accuracy: number };
  setMockLocation: (loc: { lat: number; lng: number; accuracy: number }) => void;
  // Core Functions
  timeIn: (studentId: string, mockGps: { lat: number; lng: number } | null, deviceInfo?: string) => { success: boolean; message: string };
  timeOut: (studentId: string, mockGps: { lat: number; lng: number } | null, deviceInfo?: string) => { success: boolean; message: string };
  requestAttendanceCorrection: (studentId: string, attendanceId: string, requestedTimeIn: string, requestedTimeOut: string | null, reason: string, requester: string) => { success: boolean; message: string };
  submitDailyTask: (studentId: string, task: Omit<DailyTask, 'id' | 'status'>) => void;
  deleteDailyTask: (studentId: string, taskId: string) => void;
  updateDailyTask: (studentId: string, task: DailyTask) => void;
  submitWeeklyJournal: (studentId: string, journal: Omit<WeeklyJournal, 'id' | 'status'>) => void;
  updateWeeklyJournal: (studentId: string, journalId: string, updates: Partial<WeeklyJournal>) => void;
  uploadPreOJTReq: (studentId: string, reqName: string, fileName: string, file?: UploadedDocument | null) => void;
  uploadDuringOJTReq: (studentId: string, reqName: string, fileName: string, file?: UploadedDocument | null) => void;
  uploadPostOJTReq: (studentId: string, reqName: string, fileName: string, file?: UploadedDocument | null) => void;
  uploadMOA: (studentId: string, fileName: string, file?: UploadedDocument | null) => void;
  submitPortfolio: (studentId: string) => void;
  generateDTR: (studentId: string, month: string, startDate: string, endDate: string, logs: DTRRecord['logs'], attendanceRecordIds: string[]) => DTRRecord | null;
  submitGeneratedDTR: (studentId: string, dtrId: string) => void;
  submitDTR: (studentId: string, month: string, startDate: string, endDate: string, logs: DTRRecord['logs']) => void;
  updateDTRStatus: (studentId: string, dtrId: string, status: DTRRecord['status'], remarks: string) => void;
  
  // Adviser Functions
  reviewPreOJTReq: (studentId: string, reqName: string, status: RequirementItem['status'], remarks: string) => void;
  reviewDuringOJTReq: (studentId: string, reqName: string, status: RequirementItem['status'], remarks: string) => void;
  reviewPostOJTReq: (studentId: string, reqName: string, status: RequirementItem['status'], remarks: string) => void;
  reviewMOA: (studentId: string, status: MOAState['status'], remarks: string) => { success: boolean; error?: string };
  reviewDailyTask: (studentId: string, taskId: string, status: DailyTask['status'], remarks: string) => void;
  reviewWeeklyJournal: (studentId: string, journalId: string, status: WeeklyJournal['status'], remarks: string) => void;
  reviewPortfolio: (studentId: string, status: 'Approved' | 'Needs Revision', remarks: string) => void;
  submitStudentEvaluation: (studentId: string, type: 'midterm' | 'final', evaluation: EvaluationForm) => void;
  reviewAttendanceCorrection: (studentId: string, attendanceId: string, decision: 'Approved' | 'Rejected', approver: string, remarks: string) => void;
  
  // Coordinator Functions
  reviewCoordinatorRequirement: (studentId: string, stage: RequirementStage, reqName: string, status: CoordinatorReviewStatus, remarks: string) => void;
  reviewCoordinatorPortfolio: (studentId: string, status: 'Approved' | 'Needs Revision', remarks: string) => void;
  addStudentProfile: (profile: Omit<StudentOJTProfile, 'stage' | 'preOJTRequirements' | 'moaState' | 'attendanceHistory' | 'dailyTasks' | 'weeklyJournals' | 'duringOJTRequirements' | 'postOJTRequirements' | 'midtermEvaluation' | 'finalEvaluation' | 'portfolioApproved' | 'portfolioRemarks' | 'portfolioSubmitted'>) => void;
  updateStudentProfile: (studentId: string, updates: Partial<StudentOJTProfile>) => void;
  addCompany: (comp: Omit<Company, 'id'>) => void;
  updateCompany: (compId: string, updates: Partial<Company>) => void;
  addHTEPartner: (partner: Omit<HTEPartner, 'id'>) => void;
  updateHTEPartner: (partnerId: string, updates: Partial<HTEPartner>) => void;
  addTemplate: (temp: Omit<Template, 'id' | 'lastUpdated'>) => void;
  updateTemplate: (tempId: string, updates: Partial<Template>) => void;
  addAnnouncement: (ann: Omit<Announcement, 'id' | 'publishDate'>) => void;
  deleteAnnouncement: (annId: string) => void;
  sendChatMessage: (toId: string, toName: string, toRole: string, text: string) => void;
  updateSystemSettings: (settings: any) => void;
  
  // Helper for simulation
  forceUnlockStage: (studentId: string, stage: OJTStage) => void;
  resetAllDemoData: () => void;
}

const OJTContext = createContext<OJTContextType | undefined>(undefined);

const OJT_STATE_KEY = 'ojt';

// Default checklists according to coordinator requirements
const defaultPreOJTChecklist: RequirementItem[] = createRequirementChecklist('pre');
const defaultDuringOJTChecklist: RequirementItem[] = createRequirementChecklist('during');
const defaultPostOJTChecklist: RequirementItem[] = createRequirementChecklist('post');

const defaultEvaluationCriteria = [
  { id: '1', criteriaName: 'Quality of Work / Accuracy', maxPoints: 20, score: 0 },
  { id: '2', criteriaName: 'Quantity of Work / Productivity', maxPoints: 20, score: 0 },
  { id: '3', criteriaName: 'Knowledge and Technical Skills', maxPoints: 20, score: 0 },
  { id: '4', criteriaName: 'Attendance and Punctuality', maxPoints: 20, score: 0 },
  { id: '5', criteriaName: 'Attitude and Professional Ethics', maxPoints: 20, score: 0 },
];

function formatNameWithMiddleInitial(fullName: string): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;
  
  const secondToLast = parts[parts.length - 2];
  if (secondToLast.length === 2 && secondToLast.endsWith('.')) {
    return fullName;
  }
  
  const lastName = parts[parts.length - 1];
  const middleName = parts[parts.length - 2];
  const firstName = parts.slice(0, parts.length - 2).join(' ');
  
  const middleInitial = middleName.charAt(0).toUpperCase();
  return `${firstName} ${middleInitial}. ${lastName}`;
}

function createStudentProfile(student: AuthorizedStudent): StudentOJTProfile {
  const isJaira = student.email.toLowerCase() === 'jairarmasarate@iskolarngbayan.pup.edu.ph';
  const isKate = student.email.toLowerCase() === 'kateheartvaguilon@iskolarngbayan.pup.edu.ph';
  const isFarhana = student.email.toLowerCase() === 'farhanasalim@iskolarngbayan.pup.edu.ph';
  const isMarion = student.email.toLowerCase() === 'marionoliviercatok@iskolarngbayan.pup.edu.ph';

  let stage: OJTStage = 'Stage 1: Pre-OJT';
  let totalHoursRendered = 0;
  let preOJTRequirements: RequirementItem[] = defaultPreOJTChecklist.map(req => ({ ...req }));
  let duringOJTRequirements: RequirementItem[] = defaultDuringOJTChecklist.map(req => ({ ...req }));
  let postOJTRequirements: RequirementItem[] = defaultPostOJTChecklist.map(req => ({ ...req }));
  let moaState: MOAState = {
    status: 'NO MOA',
    fileName: null,
    remarks: '',
    timeline: []
  };
  let weeklyJournals: WeeklyJournal[] = [];
  let portfolioSubmitted = false;
  let portfolioApproved = false;
  let portfolioRemarks = '';
  let portfolioSubmittedAt: string | undefined;
  let coordinatorPortfolioStatus: StudentOJTProfile['coordinatorPortfolioStatus'];

  if (isJaira) {
    preOJTRequirements = defaultPreOJTChecklist.map(req => {
      if (req.name === 'Certificate of Registration (COR)') {
        return { ...req, status: 'Submitted', fileName: 'COR_Jaira_Masarate.pdf', remarks: 'Please review my COR.' };
      }
      if (req.name === 'Resume') {
        return { ...req, status: 'Submitted', fileName: 'Resume_Jaira_Masarate.pdf', remarks: 'Latest updated resume.' };
      }
      return { ...req };
    });
    moaState = {
      status: 'FOR NOTARIZATION',
      fileName: 'MOA_Draft_Jaira_Masarate.pdf',
      remarks: 'Signed by HTE. Awaiting coordinator review.',
      timeline: [
        { date: '2026-06-20', status: 'FOR COMPANY REVIEW', remarks: 'Generated by coordinator.' },
        { date: '2026-06-24', status: 'FOR NOTARIZATION', remarks: 'Signed and uploaded.' }
      ]
    };
  } else if (isKate) {
    stage = 'Stage 2: During OJT';
    totalHoursRendered = 80;
    preOJTRequirements = defaultPreOJTChecklist.map(req => ({ ...req, status: 'Approved', remarks: 'Approved.' }));
    moaState = {
      status: 'SIGNED AND NOTARIZED',
      fileName: 'MOA_Kate_Aguilon.pdf',
      remarks: 'Verified copy.',
      timeline: [
        { date: '2026-06-01', status: 'SIGNED AND NOTARIZED', remarks: 'Fully notarized and approved.' }
      ]
    };
    weeklyJournals = [
      {
        id: 'wj_kate_1',
        weekNumber: 1,
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        tasks: [],
        reflection: 'Completed onboarding training and set up my dev tools.',
        problems: 'No major issues.',
        totalHours: 40,
        status: 'Submitted',
        remarks: '',
        submittedAt: '2026-06-05T17:00:00+08:00'
      },
      {
        id: 'wj_kate_2',
        weekNumber: 2,
        startDate: '2026-06-08',
        endDate: '2026-06-12',
        tasks: [],
        reflection: 'Worked on backend API route implementations and model schemas.',
        problems: 'Faced minor issues with MySQL connection pools.',
        totalHours: 40,
        status: 'Submitted',
        remarks: '',
        submittedAt: '2026-06-12T17:00:00+08:00'
      }
    ];
  } else if (isFarhana) {
    stage = 'Stage 3: Post-OJT';
    totalHoursRendered = 500;
    preOJTRequirements = defaultPreOJTChecklist.map(req => ({ ...req, status: 'Approved', remarks: 'Approved.' }));
    moaState = {
      status: 'SIGNED AND NOTARIZED',
      fileName: 'MOA_Farhana_Alim.pdf',
      remarks: 'Verified Copy',
      timeline: [{ date: '2026-06-01', status: 'SIGNED AND NOTARIZED', remarks: 'Approved.' }]
    };
    duringOJTRequirements = defaultDuringOJTChecklist.map(req => ({ ...req, status: 'Approved', remarks: 'Approved.' }));
    postOJTRequirements = defaultPostOJTChecklist.map(req => {
      if (req.name === 'Certificate of Completion') {
        return { ...req, status: 'Submitted', fileName: 'COC_Farhana_Alim.pdf', remarks: 'Finished 500 hours.' };
      }
      return { ...req };
    });
  } else if (isMarion) {
    stage = 'Stage 4: Portfolio Completion';
    totalHoursRendered = 500;
    preOJTRequirements = defaultPreOJTChecklist.map(req => ({ ...req, status: 'Approved', remarks: 'Approved.' }));
    moaState = {
      status: 'SIGNED AND NOTARIZED',
      fileName: 'MOA_Marion_Atok.pdf',
      remarks: 'Verified Copy',
      timeline: [{ date: '2026-06-01', status: 'SIGNED AND NOTARIZED', remarks: 'Approved.' }]
    };
    duringOJTRequirements = defaultDuringOJTChecklist.map(req => ({ ...req, status: 'Approved', remarks: 'Approved.' }));
    postOJTRequirements = defaultPostOJTChecklist.map(req => ({ ...req, status: 'Approved', remarks: 'Approved.' }));
    portfolioSubmitted = true;
    portfolioApproved = false;
    portfolioRemarks = 'Please review my completed portfolio compilation.';
    portfolioSubmittedAt = '2026-09-05T09:30:00+08:00';
    coordinatorPortfolioStatus = 'Pending';
  }

  return seedJairaDtrDemo({
    studentId: `student-${student.studentNumber}`,
    studentNumber: student.studentNumber,
    name: formatNameWithMiddleInitial(student.name),
    email: student.email,
    program: student.program,
    section: student.section,
    adviserId: '2',
    adviserName: 'Michael Chen',
    companyId: 'c1',
    companyName: 'TechCorp Inc.',
    stage,
    totalHoursRendered,
    requiredHours: 500,
    preOJTRequirements,
    moaState,
    attendanceHistory: [],
    dtrHistory: [],
    dailyTasks: [],
    weeklyJournals,
    duringOJTRequirements,
    postOJTRequirements,
    midtermEvaluation: null,
    finalEvaluation: null,
    portfolioApproved,
    portfolioRemarks,
    portfolioSubmitted,
    portfolioSubmittedAt,
    coordinatorPortfolioStatus,
  });
}

function seedJairaDtrDemo(profile: StudentOJTProfile): StudentOJTProfile {
  // Seed once; loading existing demo records must preserve coordinator decisions.
  if (profile.attendanceHistory.some(record => record.id.startsWith('jaira-dtr-demo-'))) return profile;
  if (profile.email.toLowerCase() !== 'jairarmasarate@iskolarngbayan.pup.edu.ph') return profile;

  const attendance = profile.attendanceHistory.some(record => record.id.startsWith('jaira-dtr-demo-')) ? profile.attendanceHistory : [
    ...profile.attendanceHistory,
    ...['2026-07-01', '2026-07-02', '2026-07-03', '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-09-01', '2026-09-02'].map((date, index): AttendanceRecord => ({
      id: `jaira-dtr-demo-${date}`,
      studentId: profile.studentId,
      date,
      timeIn: '08:00 AM',
      timeOut: '05:00 PM',
      totalHours: 8,
      locationStatus: 'Location Verified',
      gpsCoordinates: { lat: 14.55472, lng: 121.02444 },
      remarks: 'Verified demo attendance for DTR generation.',
      deviceInfo: 'Seeded DTR demo record',
      attendanceStatus: index === 1 ? 'Late' : 'Present',
    })),
    {
      id: 'jaira-dtr-demo-2026-09-03-incomplete', studentId: profile.studentId, date: '2026-09-03', timeIn: '08:05 AM', timeOut: null, totalHours: 0,
      locationStatus: 'Attendance Recorded', gpsCoordinates: { lat: 14.55472, lng: 121.02444 }, remarks: 'Missing time out — resolve before regenerating September DTR.', deviceInfo: 'Seeded DTR demo record', attendanceStatus: 'Incomplete Time Out',
    },
  ];
  const toLog = (record: AttendanceRecord): DTRRecord['logs'][number] => ({ attendanceRecordId: record.id, date: record.date, timeIn: record.timeIn, timeOut: record.timeOut, totalHours: record.totalHours, locationStatus: record.locationStatus, gpsCoordinates: record.gpsCoordinates });
  const history = profile.dtrHistory.some(dtr => dtr.id.startsWith('jaira-dtr-demo-')) ? profile.dtrHistory : [
    ...profile.dtrHistory,
    {
      id: 'jaira-dtr-demo-july-v1', month: 'July 2026', startDate: '2026-07-01', endDate: '2026-07-31', status: 'Needs Revision', remarks: 'Please correct the missing time-out record before resubmitting.', ojtAssignmentId: profile.companyId, adviserId: profile.adviserId, generatedAt: '2026-07-31T09:00:00.000Z', submittedAt: '2026-07-31T10:00:00.000Z', reviewedAt: '2026-08-01T02:00:00.000Z', includedAttendanceRecordIds: attendance.filter(record => record.date.startsWith('2026-07')).map(record => record.id), version: 1, revisionCount: 1, reviewHistory: [{ action: 'Generated', remarks: 'Generated from verified attendance.', timestamp: '2026-07-31T09:00:00.000Z' }, { action: 'Submitted', remarks: 'Submitted to adviser.', timestamp: '2026-07-31T10:00:00.000Z' }, { action: 'Needs Revision', remarks: 'Please correct the missing time-out record before resubmitting.', timestamp: '2026-08-01T02:00:00.000Z' }], totalHours: 24, logs: attendance.filter(record => record.date.startsWith('2026-07')).map(toLog),
    },
    {
      id: 'jaira-dtr-demo-august-v1', month: 'August 2026', startDate: '2026-08-01', endDate: '2026-08-31', status: 'Approved', remarks: 'Verified and approved by adviser.', ojtAssignmentId: profile.companyId, adviserId: profile.adviserId, generatedAt: '2026-08-31T09:00:00.000Z', submittedAt: '2026-08-31T10:00:00.000Z', reviewedAt: '2026-09-01T02:00:00.000Z', includedAttendanceRecordIds: attendance.filter(record => record.date.startsWith('2026-08')).map(record => record.id), version: 1, revisionCount: 0, reviewHistory: [{ action: 'Generated', remarks: 'Generated from verified attendance.', timestamp: '2026-08-31T09:00:00.000Z' }, { action: 'Submitted', remarks: 'Submitted to adviser.', timestamp: '2026-08-31T10:00:00.000Z' }, { action: 'Approved', remarks: 'Verified and approved by adviser.', timestamp: '2026-09-01T02:00:00.000Z' }], totalHours: 40, logs: attendance.filter(record => record.date.startsWith('2026-08')).map(toLog),
    },
  ];
  return {
    ...profile,
    stage: 'Stage 2: During OJT',
    totalHoursRendered: Math.max(profile.totalHoursRendered, attendance.filter(record => record.totalHours > 0).reduce((total, record) => total + record.totalHours, 0)),
    preOJTRequirements: profile.preOJTRequirements.map(requirement => addedPreOJTRequirements.some(name => name === requirement.name) ? requirement : ({ ...requirement, status: 'Approved', remarks: 'Approved for DTR lifecycle verification.' })),
    moaState: { ...profile.moaState, status: 'SIGNED AND NOTARIZED', remarks: 'Approved for DTR lifecycle verification.' },
    attendanceHistory: attendance,
    dtrHistory: history,
  };
}

export function OJTProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [databaseLoaded, setDatabaseLoaded] = useState(false);

  // Mock User Location - TechCorp is Makati (14.5547, 121.0244)
  // Let's set the initial mock location of student to be inside Makati (inside radius)
  const [mockLocation, setMockLocation] = useState({
    lat: 14.55472,
    lng: 121.02444,
    accuracy: 10,
  });

  const [state, setState] = useState<{
    students: StudentOJTProfile[];
    companies: Company[];
    htePartners: HTEPartner[];
    announcements: Announcement[];
    messages: Message[];
    templates: Template[];
    evaluationFormConfigs: any[];
    systemSettings: {
      academicYear: string;
      semester: string;
      requiredHours: number;
      defaultRadius: number;
    };
  }>(() => {
    // Initial seed used only when the MySQL app_state row is empty.
    const defaultCompanies: Company[] = [
      {
        id: 'c1',
        name: 'TechCorp Inc.',
        address: '14 Innovation Drive, Makati City',
        contactPerson: 'Michael Chen',
        contactNumber: '0917 555 0202',
        email: 'contact@techcorp.com',
        latitude: 14.5547, // Makati coordinates
        longitude: 121.0244,
        allowedRadius: 200, // 200 meters geo-fence
      },
      {
        id: 'c2',
        name: 'Northstar Analytics',
        address: '88 Cyber Boulevard, Quezon City',
        contactPerson: 'Anna Cruz',
        contactNumber: '0918 222 3344',
        email: 'hr@northstar.io',
        latitude: 14.6515,
        longitude: 121.0493,
        allowedRadius: 150,
      },
      {
        id: 'c3',
        name: 'City IT Office',
        address: 'Municipal Hall, Pasig City',
        contactPerson: 'Engr. Raul Gomez',
        contactNumber: '0905 888 1234',
        email: 'pasigit@pasig.gov.ph',
        latitude: 14.5583,
        longitude: 121.0617,
        allowedRadius: 300,
      }
    ];

    const defaultHTEPartners: HTEPartner[] = [
      {
        id: 'hte1',
        companyName: 'TechCorp Inc.',
        address: '14 Innovation Drive, Makati City',
        supervisorName: 'Michael Chen',
        email: 'contact@techcorp.com',
        phone: '0917 555 0202',
        dateNotarized: '2025-06-15',
        status: 'Active',
      },
      {
        id: 'hte2',
        companyName: 'Northstar Analytics',
        address: '88 Cyber Boulevard, Quezon City',
        supervisorName: 'Anna Cruz',
        email: 'hr@northstar.io',
        phone: '0918 222 3344',
        dateNotarized: '2025-08-20',
        status: 'Active',
      },
      {
        id: 'hte3',
        companyName: 'City IT Office',
        address: 'Municipal Hall, Pasig City',
        supervisorName: 'Engr. Raul Gomez',
        email: 'pasigit@pasig.gov.ph',
        phone: '0905 888 1234',
        dateNotarized: '2024-11-12',
        status: 'Active',
      },
      {
        id: 'hte4',
        companyName: 'Apex Digital Solutions',
        address: '22 Orchard Road, Pasig City',
        supervisorName: 'Mark Spencer',
        email: 'contact@apex.com',
        phone: '0988 777 6655',
        dateNotarized: 'PENDING REVIEW',
        status: 'Pending',
      },
      {
        id: 'hte5',
        companyName: 'OldTech Corporation',
        address: '99 Old Avenue, Manila',
        supervisorName: 'John Doe',
        email: 'oldtech@domain.com',
        phone: '0900 111 2222',
        dateNotarized: 'EXPIRED (2025-05-10)',
        status: 'Archived',
      },
    ];

    // Pre-populate Student profiles with some approved/submitted items
    const initialStudentProfiles: StudentOJTProfile[] = uploadedAuthorizedStudents.map(createStudentProfile);

    const defaultAnnouncements: Announcement[] = [
      {
        id: 'ann1',
        title: 'Pre-Deployment Orientation',
        message: 'All interns who have pending Pre-OJT documentations are required to attend the virtual check-up seminar this Friday at 2:00 PM via MS Teams.',
        priority: 'Urgent',
        targetRole: 'student',
        author: 'Dr. Emily Rodriguez',
        publishDate: '2026-06-22',
      },
      {
        id: 'ann2',
        title: 'Weekly Journal Template Notice',
        message: 'Please ensure that when generating the Weekly Journal, you use the official layout. Do not delete the signature slots for the Adviser.',
        priority: 'Important',
        targetRole: 'all',
        author: 'Dr. Emily Rodriguez',
        publishDate: '2026-06-20',
      }
    ];

    const defaultTemplates: Template[] = [
      { id: 't1', name: 'Pre-OJT Requirements Checklist', category: 'Pre-OJT', description: 'Checklist of requirements to complete before deployment.', linkUrl: 'https://drive.google.com/file/d/1cytqwLtfoy1hTMAtQQEQBgbxMOHDgK_f/view?usp=drive_link', status: 'Published', lastUpdated: '2026-05-10' },
      { id: 't2', name: 'Parent Consent & Waiver Form', category: 'Pre-OJT', description: 'Notarized parental permission template.', linkUrl: 'https://docs.google.com/document/d/1Tlob2HvS0RhAaZwYQszSypwBV8jndk8w/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true', status: 'Published', lastUpdated: '2026-05-12' },
      { id: 't3', name: 'Memorandum of Agreement (HTE Model)', category: 'Pre-OJT', description: 'MOA template for companies to review.', linkUrl: 'https://docs.google.com/document/d/1A_3zSLiUpLxNSmEYj03WWhszT1_W7rPb/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true', status: 'Published', lastUpdated: '2026-05-15' },
      { id: 't4', name: 'Weekly Journal Official Layout', category: 'During-OJT', description: 'Weekly accomplishment log template.', linkUrl: 'https://docs.google.com/document/d/1XzumsAU-vdbzNSx5PqMAi8IlwotT8Wyd/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true', status: 'Published', lastUpdated: '2026-05-20' },
      { id: 't5', name: 'Daily Time Record Log Sheet', category: 'During-OJT', description: 'Daily attendance record template for HTE verification.', linkUrl: 'https://docs.google.com/document/d/1BlNjqPliq7w4IvGHApA7Y9Wf0cZUEuyv/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true', status: 'Published', lastUpdated: '2026-05-22' },
      { id: 't6', name: 'HTE Evaluation Form', category: 'Post-OJT', description: 'Host Training Establishment evaluation form.', linkUrl: 'https://docs.google.com/document/d/1y70ljUvnhhcuphVlmu7flycEmHz0J8DM/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true', status: 'Published', lastUpdated: '2026-06-01' },
      { id: 't7', name: 'OJT Student Evaluation Form', category: 'Post-OJT', description: 'Student evaluation form for post-OJT completion.', linkUrl: 'https://docs.google.com/document/d/1rJV55UVuZgAEcioWRfeHRtC4vWjs_Kn5/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true', status: 'Published', lastUpdated: '2026-06-01' },
      { id: 't8', name: 'Final Portfolio Compiler Layout', category: 'Portfolio', description: 'Final compilation blueprint.', linkUrl: 'https://docs.google.com/document/d/1WGtNJmNtuu8aSH2p7ZMUKFvlJ3JifDzM/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true', status: 'Published', lastUpdated: '2026-06-05' },
      { id: 't9', name: 'Internship Agreement Template', category: 'Pre-OJT', description: 'Agreement template confirming student, university, and HTE responsibilities.', linkUrl: 'https://docs.google.com/document/d/1urYpXNmm3FEqohvttEHpibtJVAdPUHUR/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true', status: 'Published', lastUpdated: '2026-05-12' },
      { id: 't10', name: 'Endorsement/Recommendation Letter Template', category: 'Pre-OJT', description: 'Official endorsement letter template for internship applications.', linkUrl: 'https://docs.google.com/document/d/1stp4vDdC3jdBDrE-paRJK3D3A5rIj_YM/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true', status: 'Published', lastUpdated: '2026-05-12' },
      { id: 't11', name: 'Practicum Plan Letter Template', category: 'Pre-OJT', description: 'Template letter for practicum plan details.', linkUrl: 'https://docs.google.com/document/d/1qFO7wjDSz4X60fj-bbWM7DLnIK28Ebc2/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true', status: 'Published', lastUpdated: '2026-05-12' },
      { id: 't12', name: 'OJT Supervisor Evaluation Form - BSIT', category: 'Post-OJT', description: 'Supervisor evaluation form for BSIT students.', linkUrl: 'https://docs.google.com/document/d/1IxNeRF1LN-2OHjGWgjjW4ByBUXlygli0/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true', status: 'Published', lastUpdated: '2026-06-01' },
      { id: 't13', name: 'OJT Supervisor Evaluation Form - BSOA', category: 'Post-OJT', description: 'Supervisor evaluation form for BSOA students.', linkUrl: 'https://docs.google.com/document/d/1z7oW3u81_23HgmuQKaymbT8mIWesZuKU/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true', status: 'Published', lastUpdated: '2026-06-01' },
      { id: 't14', name: 'Self-Reflection Template', category: 'Post-OJT', description: 'Self-reflection template for post-OJT completion.', linkUrl: 'https://docs.google.com/document/d/1wMzLb6Nm65-mRxLc0GdfSJesnXZ5f7aS/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true', status: 'Published', lastUpdated: '2026-06-01' },
      { id: 't15', name: 'Reflective Journal Template', category: 'Post-OJT', description: 'Reflective journal template for internship learning and professional growth.', linkUrl: 'https://docs.google.com/document/d/1ipDpySKQK5TrdY9ymSGlRcrkK6Qc8S6C/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true', status: 'Published', lastUpdated: '2026-06-01' },
    ];

    const defaultMessages: Message[] = [
      {
        id: 'm1',
        fromId: '2',
        fromName: 'Michael Chen',
        fromRole: 'adviser',
        toId: 'student-2023-00007-PQ-0',
        toName: 'Jaira Rapanut Masarate',
        message: 'Hi Jaira, please update the notarized waiver with your parent\'s signature and re-upload.',
        timestamp: '2026-06-23 10:30 AM',
        unread: true,
      },
      {
        id: 'm2',
        fromId: '3',
        fromName: 'Dr. Emily Rodriguez',
        fromRole: 'coordinator',
        toId: 'student-2023-00007-PQ-0',
        toName: 'Jaira Rapanut Masarate',
        message: 'Your MOA is under review. I have pinged company HR.',
        timestamp: '2026-06-22 02:15 PM',
        unread: false,
      }
    ];

    const demoEmails = ['sarah.johnson@university.edu', 'david.martinez@university.edu', 'lisa.wang@university.edu'];
    const sanitizedStudentProfiles = initialStudentProfiles.filter(s => !demoEmails.includes(s.email.toLowerCase()));

    return {
      students: sanitizedStudentProfiles,
      companies: defaultCompanies,
      htePartners: defaultHTEPartners,
      announcements: defaultAnnouncements,
      messages: defaultMessages,
      templates: defaultTemplates,
      evaluationFormConfigs: [],
      systemSettings: {
        academicYear: '2025-2026',
        semester: 'Second Semester',
        requiredHours: 500,
        defaultRadius: 200, // 200m
      }
    };
  });

  useEffect(() => {
    let isMounted = true;

    loadApiState<typeof state>(OJT_STATE_KEY)
      .then((databaseState) => {
        if (!isMounted) return;
        if (databaseState && typeof databaseState === 'object' && !Array.isArray(databaseState)) {
          const demoEmails = ['sarah.johnson@university.edu', 'david.martinez@university.edu', 'lisa.wang@university.edu'];
          const persistedStudents = Array.isArray(databaseState.students) ? databaseState.students : [];
          const filteredStudents = persistedStudents
            .filter(s => typeof s?.email === 'string' && !demoEmails.includes(s.email.toLowerCase()))
            .map(s => seedJairaDtrDemo({
              ...s,
              name: formatNameWithMiddleInitial(typeof s.name === 'string' ? s.name : ''),
              preOJTRequirements: appendMissingRequirements<RequirementItem>(Array.isArray(s.preOJTRequirements) ? s.preOJTRequirements : [], addedPreOJTRequirements, name => ({name, status:'Not Submitted', fileName:null, remarks:''})),
              duringOJTRequirements: Array.isArray(s.duringOJTRequirements) ? s.duringOJTRequirements : [],
              postOJTRequirements: appendMissingRequirements<RequirementItem>(Array.isArray(s.postOJTRequirements) ? s.postOJTRequirements : [], addedPostOJTRequirements, name => ({name, status:'Not Submitted', fileName:null, remarks:''})),
              attendanceHistory: Array.isArray(s.attendanceHistory) ? s.attendanceHistory : [],
              dtrHistory: Array.isArray(s.dtrHistory) ? s.dtrHistory : [],
              dailyTasks: Array.isArray(s.dailyTasks) ? s.dailyTasks : [],
              weeklyJournals: Array.isArray(s.weeklyJournals) ? s.weeklyJournals : [],
              moaState: {
                status: moaStatuses.includes(s.moaState?.status) ? s.moaState.status : 'NO MOA',
                pendingUpload: s.moaState?.pendingUpload,
                fileName: s.moaState?.fileName || null,
                file: s.moaState?.file ?? null,
                remarks: s.moaState?.remarks || '',
                timeline: Array.isArray(s.moaState?.timeline) ? s.moaState.timeline : [],
                submittedAt: s.moaState?.submittedAt,
                reviewedAt: s.moaState?.reviewedAt,
              },
            } as StudentOJTProfile));

          const existingEmails = new Set(filteredStudents.map(s => s.email.toLowerCase()));
          const defaultStudentProfiles: StudentOJTProfile[] = uploadedAuthorizedStudents
            .filter(student => !demoEmails.includes(student.email.toLowerCase()) && !existingEmails.has(student.email.toLowerCase()))
            .map(createStudentProfile);

          setState({
            ...state,
            ...databaseState,
            students: [...filteredStudents, ...defaultStudentProfiles],
            companies: Array.isArray(databaseState.companies) ? databaseState.companies : state.companies,
            htePartners: Array.isArray((databaseState as any).htePartners) ? (databaseState as any).htePartners : state.htePartners,
            announcements: Array.isArray(databaseState.announcements) ? databaseState.announcements : state.announcements,
            messages: Array.isArray(databaseState.messages) ? databaseState.messages : state.messages,
            templates: Array.isArray(databaseState.templates)
              ? [
                  ...databaseState.templates.map(template => {
                    const seededTemplate = state.templates.find(defaultTemplate => defaultTemplate.id === template.id);
                    return template.linkUrl === '#' && seededTemplate ? { ...template, linkUrl: seededTemplate.linkUrl } : template;
                  }),
                  ...state.templates.filter(defaultTemplate => !databaseState.templates.some(template => template.id === defaultTemplate.id))
                ]
              : state.templates,
            evaluationFormConfigs: Array.isArray(databaseState.evaluationFormConfigs) ? databaseState.evaluationFormConfigs : state.evaluationFormConfigs,
            systemSettings: {
              ...state.systemSettings,
              ...(databaseState.systemSettings && typeof databaseState.systemSettings === 'object' ? databaseState.systemSettings : {}),
            },
          });
        }
      })
      .catch((error) => {
        console.error('Failed to load OJT data from MySQL.', error);
      })
      .finally(() => {
        if (isMounted) {
          setDatabaseLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync to MySQL through the local API.
  useEffect(() => {
    if (!databaseLoaded) return;

    saveApiState(OJT_STATE_KEY, state).catch((error) => {
      console.error('Failed to save OJT data to MySQL.', error);
    });
  }, [databaseLoaded, state]);

  // Stage locks evaluation helper
  const checkStageLock = (profile: StudentOJTProfile): OJTStage => {
    // 1. Check Pre-OJT Requirements & MOA
    const allPreOJTApproved = profile.preOJTRequirements.every(req => req.status === 'Approved');
    const moaApproved = moaIsAccepted(profile.moaState.status);
    
    if (!allPreOJTApproved || !moaApproved) {
      return 'Stage 1: Pre-OJT';
    }

    // 2. Check rendered hours vs required hours
    if (profile.totalHoursRendered < profile.requiredHours) {
      return 'Stage 2: During OJT';
    }

    // 3. During OJT requirements all approved?
    const allDuringOJTApproved = profile.duringOJTRequirements.every(req => req.status === 'Approved');
    if (!allDuringOJTApproved) {
      return 'Stage 2: During OJT'; // Keep in Stage 2 if during-OJT requirements aren't cleared
    }

    // 4. Check if Post-OJT Requirements approved
    const allPostOJTApproved = profile.postOJTRequirements.every(req => req.status === 'Approved');
    if (!allPostOJTApproved) {
      return 'Stage 3: Post-OJT';
    }

    // 5. Portfolio Completion
    return 'Stage 4: Portfolio Completion';
  };

  // Helper helper to update single student profile
  const updateStudentState = (studentId: string, updater: (profile: StudentOJTProfile) => StudentOJTProfile) => {
    setState(prev => {
      const updatedStudents = prev.students.map(s => {
        if (s.studentId === studentId) {
          const updated = updater(s);
          const computedStage = checkStageLock(updated);
          return { ...updated, stage: computedStage };
        }
        return s;
      });
      return { ...prev, students: updatedStudents };
    });
  };

  // 4. Geolocation calculations
  const degreesToRadians = (deg: number) => (deg * Math.PI) / 180;
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const earthRadius = 6371000; // Meters
    const dLat = degreesToRadians(lat2 - lat1);
    const dLon = degreesToRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(degreesToRadians(lat1)) * Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c;
  };

  const timeToMinutes = (value: string | null) => {
    if (!value) return null;
    const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const modifier = match[3]?.toUpperCase();
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const formatRequestedTime = (value: string | null) => {
    if (!value) return null;
    const minutes = timeToMinutes(value);
    if (minutes === null) return value;
    const hours = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${hours % 12 || 12}:${String(minute).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
  };

  const requestAttendanceCorrection = (studentId: string, attendanceId: string, requestedTimeIn: string, requestedTimeOut: string | null, reason: string, requester: string) => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) return { success: false, message: 'A reason for the correction is required.' };
    if (timeToMinutes(requestedTimeIn) === null || (requestedTimeOut && timeToMinutes(requestedTimeOut) === null)) return { success: false, message: 'Enter valid requested times.' };
    if (requestedTimeOut && timeToMinutes(requestedTimeOut)! <= timeToMinutes(requestedTimeIn)!) return { success: false, message: 'Requested time out must be later than requested time in.' };
    const now = new Date().toISOString();
    updateStudentState(studentId, s => ({
      ...s,
      attendanceHistory: s.attendanceHistory.map(record => record.id !== attendanceId ? record : {
        ...record,
        correction: {
          id: `correction_${Date.now()}`,
          originalTimeIn: record.timeIn,
          originalTimeOut: record.timeOut,
          requestedTimeIn: formatRequestedTime(requestedTimeIn) || requestedTimeIn,
          requestedTimeOut: formatRequestedTime(requestedTimeOut),
          reason: trimmedReason,
          status: 'Pending',
          requestedAt: now,
          auditTrail: [{ action: 'Correction requested', actor: requester, timestamp: now, details: trimmedReason }],
        },
      }),
    }));
    return { success: true, message: 'Correction request submitted for adviser approval.' };
  };

  const reviewAttendanceCorrection = (studentId: string, attendanceId: string, decision: 'Approved' | 'Rejected', approver: string, remarks: string) => {
    const now = new Date().toISOString();
    updateStudentState(studentId, s => {
      let hourAdjustment = 0;
      const attendanceHistory = s.attendanceHistory.map(record => {
        if (record.id !== attendanceId || record.correction?.status !== 'Pending') return record;
        const correction: AttendanceCorrection = {
          ...record.correction,
          status: decision,
          approver,
          decidedAt: now,
          decisionRemarks: remarks.trim(),
          auditTrail: [...record.correction.auditTrail, { action: `Correction ${decision.toLowerCase()}`, actor: approver, timestamp: now, details: remarks.trim() || `Request ${decision.toLowerCase()}.` }],
        };
        if (decision !== 'Approved') return { ...record, correction };
        const inMinutes = timeToMinutes(correction.requestedTimeIn);
        const outMinutes = timeToMinutes(correction.requestedTimeOut);
        const correctedHours = inMinutes !== null && outMinutes !== null ? Math.round(((outMinutes - inMinutes) / 60) * 100) / 100 : record.totalHours;
        hourAdjustment = correctedHours - record.totalHours;
        return { ...record, timeIn: correction.requestedTimeIn, timeOut: correction.requestedTimeOut, totalHours: correctedHours, remarks: `${record.remarks} Time correction approved by ${approver}.`, correction };
      });
      return { ...s, attendanceHistory, totalHoursRendered: Math.max(0, Math.round((s.totalHoursRendered + hourAdjustment) * 100) / 100) };
    });
  };

  // 1. Time In Function
  const timeIn = (studentId: string, mockGps: { lat: number; lng: number } | null, deviceInfo: string = 'Unknown') => {
    let result = { success: false, message: '' };
    
    // Find student
    const student = state.students.find(s => s.studentId === studentId);
    if (!student) {
      return { success: false, message: 'Student profile not found.' };
    }

    // Must be in Stage 2 or higher
    if (student.stage === 'Stage 1: Pre-OJT') {
      return { success: false, message: 'Pre-OJT requirements must be approved before logging attendance.' };
    }

    // Find assigned company
    const company = state.companies.find(c => c.id === student.companyId);
    if (!company) {
      return { success: false, message: 'Assigned company details not found. Please contact coordinator.' };
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // GPS validation check
    let distance = 0;
    let locationStatus: AttendanceRecord['locationStatus'] = 'Outside Deployment Area';
    
    if (mockGps) {
      distance = calculateDistance(mockGps.lat, mockGps.lng, company.latitude, company.longitude);
      if (distance <= company.allowedRadius) {
        locationStatus = 'Location Verified';
      }
    } else {
      locationStatus = 'Location Permission Denied';
    }

    // Late check (after 8:30 AM)
    const now = new Date();
    const isLateTime = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 30);
    const attendanceStatus = locationStatus !== 'Location Verified' 
      ? 'Outside Deployment Area' 
      : (isLateTime ? 'Late' : 'Location Verified');

    if (locationStatus !== 'Location Verified') {
      result = {
        success: false,
        message: `Clock In Failed. You are outside the allowed company location radius (${Math.round(distance)}m away).`,
      };
      
      // Still log failed attempt in attendance record
      updateStudentState(studentId, s => ({
        ...s,
        attendanceHistory: [
          {
            id: `att_${Date.now()}`,
            studentId,
            date: todayDate,
            timeIn: timeString,
            timeOut: null,
            totalHours: 0,
            locationStatus,
            gpsCoordinates: mockGps,
            remarks: `Failed clock-in attempt. Distance: ${Math.round(distance)}m from company centre.`,
            deviceInfo,
            attendanceStatus: 'Outside Deployment Area'
          },
          ...s.attendanceHistory
        ]
      }));

      return result;
    }

    // Success
    updateStudentState(studentId, s => {
      // Check if already clocked in today
      const alreadyClockedIn = s.attendanceHistory.find(a => a.date === todayDate && a.timeOut === null);
      if (alreadyClockedIn) return s;

      return {
        ...s,
        attendanceHistory: [
          {
            id: `att_${Date.now()}`,
            studentId,
            date: todayDate,
            timeIn: timeString,
            timeOut: null,
            totalHours: 0,
            locationStatus: 'Location Verified',
            gpsCoordinates: mockGps,
            remarks: isLateTime ? 'Clocked in Late (After 08:30 AM).' : 'Clocked in on time.',
            deviceInfo,
            attendanceStatus: isLateTime ? 'Late' : 'Location Verified'
          },
          ...s.attendanceHistory
        ]
      };
    });

    return { success: true, message: `Time In recorded successfully! ${isLateTime ? 'Late entry noted.' : 'Location verified.'}` };
  };

  // 2. Time Out Function
  const timeOut = (studentId: string, mockGps: { lat: number; lng: number } | null, deviceInfo: string = 'Unknown') => {
    let result = { success: false, message: '' };
    
    // Find student
    const student = state.students.find(s => s.studentId === studentId);
    if (!student) {
      return { success: false, message: 'Student profile not found.' };
    }

    // Find assigned company
    const company = state.companies.find(c => c.id === student.companyId);
    if (!company) {
      return { success: false, message: 'Assigned company details not found.' };
    }

    // GPS validation check on checkout
    let distance = 0;
    let locationStatus: AttendanceRecord['locationStatus'] = 'Outside Deployment Area';
    
    if (mockGps) {
      distance = calculateDistance(mockGps.lat, mockGps.lng, company.latitude, company.longitude);
      if (distance <= company.allowedRadius) {
        locationStatus = 'Location Verified';
      }
    } else {
      locationStatus = 'Location Permission Denied';
    }

    if (locationStatus !== 'Location Verified') {
      return {
        success: false,
        message: `Clock Out Failed. You are outside the allowed company location radius (${Math.round(distance)}m away) to Clock Out.`,
      };
    }

    let message = 'Clocked out successfully.';
    updateStudentState(studentId, s => {
      const todayDate = new Date().toISOString().split('T')[0];
      const activeRecordIdx = s.attendanceHistory.findIndex(a => a.timeOut === null);
      
      if (activeRecordIdx === -1) {
        message = 'No active check-in found.';
        return s;
      }

      const record = s.attendanceHistory[activeRecordIdx];
      const timeOutString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Calculate hours
      const parseTime = (tStr: string) => {
        const [time, modifier] = tStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        return hours + minutes / 60;
      };

      const inVal = parseTime(record.timeIn);
      const outVal = parseTime(timeOutString);
      let diff = outVal - inVal;
      if (diff < 0) diff += 24; // boundary crossing
      diff = Math.round(diff * 100) / 100; // round to two decimals

      const updatedHistory = [...s.attendanceHistory];
      const wasLate = record.attendanceStatus === 'Late';
      const attStatus = wasLate ? 'Late' : 'Present';

      updatedHistory[activeRecordIdx] = {
        ...record,
        timeOut: timeOutString,
        totalHours: diff,
        locationStatus: 'Attendance Recorded',
        attendanceStatus: attStatus,
        remarks: `Present. Rendered ${diff.toFixed(2)} hours.`,
        deviceInfo
      };

      const newTotalHours = s.totalHoursRendered + diff;

      return {
        ...s,
        attendanceHistory: updatedHistory,
        totalHoursRendered: newTotalHours
      };
    });

    return { success: true, message };
  };

  // 2b. DTR lifecycle. Generation snapshots verified attendance; submission is a separate action.
  const generateDTR = (studentId: string, month: string, startDate: string, endDate: string, logs: DTRRecord['logs'], attendanceRecordIds: string[]) => {
    let generated: DTRRecord | null = null;
    updateStudentState(studentId, s => {
      const existingForPeriod = (s.dtrHistory || []).filter(d => d.month === month && d.startDate === startDate && d.endDate === endDate);
      const version = Math.max(0, ...existingForPeriod.map(d => d.version || 1)) + 1;
      const generatedAt = new Date().toISOString();
      generated = {
        id: `dtr_${Date.now()}`,
        month,
        startDate,
        endDate,
        status: 'Generated',
        remarks: '',
        ojtAssignmentId: s.companyId,
        adviserId: s.adviserId,
        generatedAt,
        includedAttendanceRecordIds: [...attendanceRecordIds],
        version,
        revisionCount: existingForPeriod.reduce((count, d) => count + (d.revisionCount || (d.status === 'Needs Revision' || d.status === 'Revision Requested' ? 1 : 0)), 0),
        reviewHistory: [{ action: 'Generated', remarks: `Generated from ${logs.length} verified attendance records.`, timestamp: generatedAt }],
        totalHours: logs.reduce((acc, log) => acc + log.totalHours, 0),
        logs: logs.map(log => ({ ...log }))
      };
      return { ...s, dtrHistory: [generated!, ...(s.dtrHistory || [])] };
    });
    return generated;
  };

  const submitGeneratedDTR = (studentId: string, dtrId: string) => {
    updateStudentState(studentId, s => ({
      ...s,
      dtrHistory: (s.dtrHistory || []).map(d => {
        if (d.id !== dtrId) return d;
        const submittedAt = new Date().toISOString();
        return { ...d, status: 'Submitted', submittedAt, reviewHistory: [...(d.reviewHistory || []), { action: 'Submitted', remarks: 'Submitted to adviser for review.', timestamp: submittedAt }] };
      })
    }));
  };

  // Legacy callers still produce a generated snapshot before formal submission.
  const submitDTR = (studentId: string, month: string, startDate: string, endDate: string, logs: DTRRecord['logs']) => {
    const generated = generateDTR(studentId, month, startDate, endDate, logs, logs.map(log => log.attendanceRecordId || `${log.date}-${log.timeIn}`));
    if (generated) submitGeneratedDTR(studentId, generated.id);
  };

  const updateDTRStatus = (studentId: string, dtrId: string, status: DTRRecord['status'], remarks: string) => {
    updateStudentState(studentId, s => {
      return {
        ...s,
        dtrHistory: (s.dtrHistory || []).map(d =>
        d.id === dtrId ? {
          ...d,
          status,
          remarks,
          reviewedAt: new Date().toISOString(),
          revisionCount: status === 'Needs Revision' || status === 'Revision Requested' ? (d.revisionCount || 0) + 1 : d.revisionCount,
          reviewHistory: [...(d.reviewHistory || []), { action: status, remarks, timestamp: new Date().toISOString() }]
        } : d
        )
      };
    });
  };

  // Daily Tasks CRUD
  const submitDailyTask = (studentId: string, task: Omit<DailyTask, 'id' | 'status'>) => {
    updateStudentState(studentId, s => ({
      ...s,
      dailyTasks: [
        {
          ...task,
          id: `task_${Date.now()}`,
          status: 'Submitted',
        },
        ...s.dailyTasks
      ]
    }));
  };

  const deleteDailyTask = (studentId: string, taskId: string) => {
    updateStudentState(studentId, s => ({
      ...s,
      dailyTasks: s.dailyTasks.filter(t => t.id !== taskId)
    }));
  };

  const updateDailyTask = (studentId: string, task: DailyTask) => {
    updateStudentState(studentId, s => ({
      ...s,
      dailyTasks: s.dailyTasks.map(t => t.id === task.id ? task : t)
    }));
  };

  // Weekly Journals CRUD
  const submitWeeklyJournal = (studentId: string, journal: Omit<WeeklyJournal, 'id' | 'status'>) => {
    updateStudentState(studentId, s => ({
      ...s,
      weeklyJournals: [
        {
          ...journal,
          id: `journal_${Date.now()}`,
          status: 'Submitted',
          submittedAt: new Date().toISOString(),
        },
        ...s.weeklyJournals
      ]
    }));
  };

  const updateWeeklyJournal = (studentId: string, journalId: string, updates: Partial<WeeklyJournal>) => {
    updateStudentState(studentId, s => ({
      ...s,
      weeklyJournals: s.weeklyJournals.map(j => j.id === journalId ? { ...j, ...updates } : j)
    }));
  };

  // Requirement uploads
  const uploadPreOJTReq = (studentId: string, reqName: string, fileName: string, file?: UploadedDocument | null) => {
    const submittedAt = new Date().toLocaleString();
    updateStudentState(studentId, s => ({
      ...s,
      preOJTRequirements: s.preOJTRequirements.map(r =>
        r.name === reqName ? { ...r, status: 'Submitted', fileName, file: file ?? null, remarks: 'Uploaded file', submittedAt, updatedAt: submittedAt, coordinatorStatus: 'Pending', coordinatorRemarks: '', coordinatorReviewedAt: undefined, reviewHistory: [...(r.reviewHistory || []), { role: 'Student', action: r.submittedAt ? 'Resubmitted' : 'Submitted', remarks: `Uploaded ${fileName}.`, timestamp: submittedAt }] } : r
      )
    }));
  };

  const uploadDuringOJTReq = (studentId: string, reqName: string, fileName: string, file?: UploadedDocument | null) => {
    const submittedAt = new Date().toLocaleString();
    updateStudentState(studentId, s => ({
      ...s,
      duringOJTRequirements: s.duringOJTRequirements.map(r =>
        r.name === reqName ? { ...r, status: 'Submitted', fileName, file: file ?? null, remarks: 'Uploaded file', submittedAt, updatedAt: submittedAt, coordinatorStatus: 'Pending', coordinatorRemarks: '', coordinatorReviewedAt: undefined, reviewHistory: [...(r.reviewHistory || []), { role: 'Student', action: r.submittedAt ? 'Resubmitted' : 'Submitted', remarks: `Uploaded ${fileName}.`, timestamp: submittedAt }] } : r
      )
    }));
  };

  const uploadPostOJTReq = (studentId: string, reqName: string, fileName: string, file?: UploadedDocument | null) => {
    const submittedAt = new Date().toLocaleString();
    updateStudentState(studentId, s => ({
      ...s,
      postOJTRequirements: s.postOJTRequirements.map(r =>
        r.name === reqName ? { ...r, status: 'Submitted', fileName, file: file ?? null, remarks: 'Uploaded file', submittedAt, updatedAt: submittedAt, coordinatorStatus: 'Pending', coordinatorRemarks: '', coordinatorReviewedAt: undefined, reviewHistory: [...(r.reviewHistory || []), { role: 'Student', action: r.submittedAt ? 'Resubmitted' : 'Submitted', remarks: `Uploaded ${fileName}.`, timestamp: submittedAt }] } : r
      )
    }));
  };

  const uploadMOA = (studentId: string, fileName: string, file?: UploadedDocument | null) => {
    updateStudentState(studentId, s => {
      const today = new Date().toISOString().split('T')[0];
      const submittedAt = new Date().toISOString();
      return {
        ...s,
        moaState: {
          ...s.moaState,
          pendingUpload: { fileName, file: file ?? null, submittedAt },
          submittedAt,
          timeline: [
            ...s.moaState.timeline,
            { date: today, status: s.moaState.status, remarks: `Uploaded for coordinator review: ${fileName}` }
          ]
        }
      };
    });
  };

  const submitPortfolio = (studentId: string) => {
    const submittedAt = new Date().toISOString();
    updateStudentState(studentId, s => ({
      ...s,
      portfolioSubmitted: true,
      portfolioApproved: false,
      portfolioRemarks: 'Portfolio compiled and submitted for adviser review.',
      portfolioSubmittedAt: submittedAt,
      portfolioAdviserReviewedAt: undefined,
      coordinatorPortfolioStatus: 'Pending',
      coordinatorPortfolioRemarks: '',
      coordinatorPortfolioReviewedAt: undefined,
      portfolioReviewHistory: [...(s.portfolioReviewHistory || []), { role: 'Student', action: s.portfolioSubmittedAt ? 'Resubmitted portfolio' : 'Submitted portfolio', remarks: 'Portfolio compiled and submitted for adviser review.', timestamp: submittedAt }]
    }));
  };

  // Adviser Actions
  const reviewPreOJTReq = (studentId: string, reqName: string, status: RequirementItem['status'], remarks: string) => {
    const reviewedAt = new Date().toLocaleString();
    updateStudentState(studentId, s => ({
      ...s,
      preOJTRequirements: s.preOJTRequirements.map(r =>
        r.name === reqName ? { ...r, status, remarks, reviewedAt, updatedAt: reviewedAt, revisionCount: status === 'Needs Revision' ? (r.revisionCount || 0) + 1 : r.revisionCount, coordinatorStatus: 'Pending', coordinatorRemarks: '', coordinatorReviewedAt: undefined, reviewHistory: [...(r.reviewHistory || []), { role: 'Adviser', action: status, remarks, timestamp: reviewedAt }] } : r
      )
    }));
  };

  const reviewDuringOJTReq = (studentId: string, reqName: string, status: RequirementItem['status'], remarks: string) => {
    const reviewedAt = new Date().toLocaleString();
    updateStudentState(studentId, s => ({
      ...s,
      duringOJTRequirements: s.duringOJTRequirements.map(r =>
        r.name === reqName ? { ...r, status, remarks, reviewedAt, updatedAt: reviewedAt, revisionCount: status === 'Needs Revision' ? (r.revisionCount || 0) + 1 : r.revisionCount, coordinatorStatus: 'Pending', coordinatorRemarks: '', coordinatorReviewedAt: undefined, reviewHistory: [...(r.reviewHistory || []), { role: 'Adviser', action: status, remarks, timestamp: reviewedAt }] } : r
      )
    }));
  };

  const reviewPostOJTReq = (studentId: string, reqName: string, status: RequirementItem['status'], remarks: string) => {
    const reviewedAt = new Date().toLocaleString();
    updateStudentState(studentId, s => ({
      ...s,
      postOJTRequirements: s.postOJTRequirements.map(r =>
        r.name === reqName ? { ...r, status, remarks, reviewedAt, updatedAt: reviewedAt, revisionCount: status === 'Needs Revision' ? (r.revisionCount || 0) + 1 : r.revisionCount, coordinatorStatus: 'Pending', coordinatorRemarks: '', coordinatorReviewedAt: undefined, reviewHistory: [...(r.reviewHistory || []), { role: 'Adviser', action: status, remarks, timestamp: reviewedAt }] } : r
      )
    }));
  };

  const reviewMOA = (studentId: string, status: MOAState['status'], remarks: string) => {
    const currentMoa = state.students.find(student => student.studentId === studentId)?.moaState;
    if (!currentMoa || !canSetMoaStatus(user?.role, status, currentMoa.status) || (status === 'SAS COPY SUBMITTED' && currentMoa.pendingUpload)) {
      return { success: false, error: status === 'SAS COPY SUBMITTED'
        ? 'Confirm SIGNED AND NOTARIZED for the reviewed copy before recording submission to SAS.'
        : 'Only the coordinator can assign a valid MOA status to an existing record.' };
    }
    updateStudentState(studentId, s => {
      const today = new Date().toISOString().split('T')[0];
      const reviewedAt = new Date().toISOString();
      return {
        ...s,
        moaState: {
          ...s.moaState,
          fileName: s.moaState.pendingUpload?.fileName ?? s.moaState.fileName,
          file: s.moaState.pendingUpload?.file ?? s.moaState.file,
          pendingUpload: undefined,
          status,
          remarks,
          reviewedAt,
          timeline: [
            ...s.moaState.timeline,
            { date: today, status, remarks }
          ]
        }
      };
    });
    return { success: true };
  };

  const reviewDailyTask = (studentId: string, taskId: string, status: DailyTask['status'], remarks: string) => {
    updateStudentState(studentId, s => ({
      ...s,
      dailyTasks: s.dailyTasks.map(t =>
        t.id === taskId ? { ...t, status, remarks } : t
      )
    }));
  };

  const reviewWeeklyJournal = (studentId: string, journalId: string, status: WeeklyJournal['status'], remarks: string) => {
    updateStudentState(studentId, s => ({
      ...s,
      weeklyJournals: s.weeklyJournals.map(j =>
        j.id === journalId ? { ...j, status, remarks } : j
      )
    }));
  };

  const reviewPortfolio = (studentId: string, status: 'Approved' | 'Needs Revision', remarks: string) => {
    const reviewedAt = new Date().toISOString();
    updateStudentState(studentId, s => ({
      ...s,
      portfolioApproved: status === 'Approved',
      portfolioRemarks: remarks,
      portfolioSubmitted: status === 'Needs Revision' ? false : s.portfolioSubmitted,
      portfolioAdviserReviewedAt: reviewedAt,
      coordinatorPortfolioStatus: 'Pending',
      coordinatorPortfolioRemarks: '',
      coordinatorPortfolioReviewedAt: undefined,
      portfolioReviewHistory: [...(s.portfolioReviewHistory || []), { role: 'Adviser', action: status === 'Approved' ? 'Endorsed portfolio' : 'Requested portfolio revision', remarks, timestamp: reviewedAt }]
    }));
  };

  const reviewCoordinatorRequirement = (studentId: string, stage: RequirementStage, reqName: string, status: CoordinatorReviewStatus, remarks: string) => {
    const reviewedAt = new Date().toISOString();
    const key: 'preOJTRequirements' | 'duringOJTRequirements' | 'postOJTRequirements' = stage === 'pre' ? 'preOJTRequirements' : stage === 'during' ? 'duringOJTRequirements' : 'postOJTRequirements';
    updateStudentState(studentId, s => ({
      ...s,
      [key]: s[key].map(requirement => requirement.name === reqName ? {
        ...requirement,
        coordinatorStatus: status,
        coordinatorRemarks: remarks,
        coordinatorReviewedAt: reviewedAt,
        reviewHistory: [...(requirement.reviewHistory || []), { role: 'Coordinator', action: status, remarks, timestamp: reviewedAt }],
      } : requirement),
    }));
  };

  const reviewCoordinatorPortfolio = (studentId: string, status: 'Approved' | 'Needs Revision', remarks: string) => {
    const reviewedAt = new Date().toISOString();
    updateStudentState(studentId, s => ({
      ...s,
      coordinatorPortfolioStatus: status,
      coordinatorPortfolioRemarks: remarks,
      coordinatorPortfolioReviewedAt: reviewedAt,
      portfolioSubmitted: status === 'Needs Revision' ? false : s.portfolioSubmitted,
      portfolioApproved: status === 'Needs Revision' ? false : s.portfolioApproved,
      portfolioReviewHistory: [...(s.portfolioReviewHistory || []), { role: 'Coordinator', action: status === 'Approved' ? 'Final portfolio approval' : 'Requested portfolio revision', remarks, timestamp: reviewedAt }],
    }));
  };

  const submitStudentEvaluation = (studentId: string, type: 'midterm' | 'final', evaluation: EvaluationForm) => {
    updateStudentState(studentId, s => {
      if (type === 'midterm') {
        return { ...s, midtermEvaluation: evaluation };
      } else {
        return { ...s, finalEvaluation: evaluation };
      }
    });
  };

  // Coordinator Actions
  const addStudentProfile = (profile: Omit<StudentOJTProfile, 'stage' | 'preOJTRequirements' | 'moaState' | 'attendanceHistory' | 'dtrHistory' | 'dailyTasks' | 'weeklyJournals' | 'duringOJTRequirements' | 'postOJTRequirements' | 'midtermEvaluation' | 'finalEvaluation' | 'portfolioApproved' | 'portfolioRemarks' | 'portfolioSubmitted'>) => {
    const newProfile: StudentOJTProfile = {
      ...profile,
      stage: 'Stage 1: Pre-OJT',
      preOJTRequirements: defaultPreOJTChecklist,
      moaState: {
        status: 'NO MOA',
        fileName: null,
        remarks: '',
        timeline: []
      },
      attendanceHistory: [],
      dtrHistory: [],
      dailyTasks: [],
      weeklyJournals: [],
      duringOJTRequirements: defaultDuringOJTChecklist,
      postOJTRequirements: defaultPostOJTChecklist,
      midtermEvaluation: null,
      finalEvaluation: null,
      portfolioApproved: false,
      portfolioRemarks: '',
      portfolioSubmitted: false,
      portfolioSubmittedAt: undefined,
    };
    setState(prev => ({
      ...prev,
      students: [...prev.students, newProfile]
    }));
  };

  const updateStudentProfile = (studentId: string, updates: Partial<StudentOJTProfile>) => {
    updateStudentState(studentId, s => ({
      ...s,
      ...updates
    }));
  };

  const addCompany = (comp: Omit<Company, 'id'>) => {
    setState(prev => ({
      ...prev,
      companies: [
        ...prev.companies,
        {
          ...comp,
          id: `comp_${Date.now()}`
        }
      ]
    }));
  };

  const updateCompany = (compId: string, updates: Partial<Company>) => {
    setState(prev => ({
      ...prev,
      companies: prev.companies.map(c => c.id === compId ? { ...c, ...updates } : c)
    }));
  };

  const addHTEPartner = (partner: Omit<HTEPartner, 'id'>) => {
    setState(prev => ({
      ...prev,
      htePartners: [
        ...prev.htePartners,
        {
          ...partner,
          id: `hte_${Date.now()}`
        }
      ]
    }));
  };

  const updateHTEPartner = (partnerId: string, updates: Partial<HTEPartner>) => {
    setState(prev => ({
      ...prev,
      htePartners: prev.htePartners.map(partner => partner.id === partnerId ? { ...partner, ...updates } : partner)
    }));
  };

  const addTemplate = (temp: Omit<Template, 'id' | 'lastUpdated'>) => {
    setState(prev => ({
      ...prev,
      templates: [
        ...prev.templates,
        {
          ...temp,
          id: `temp_${Date.now()}`,
          lastUpdated: new Date().toISOString().split('T')[0]
        }
      ]
    }));
  };

  const updateTemplate = (tempId: string, updates: Partial<Template>) => {
    setState(prev => ({
      ...prev,
      templates: prev.templates.map(t => t.id === tempId ? { ...t, ...updates, lastUpdated: new Date().toISOString().split('T')[0] } : t)
    }));
  };

  const addAnnouncement = (ann: Omit<Announcement, 'id' | 'publishDate'>) => {
    setState(prev => ({
      ...prev,
      announcements: [
        {
          ...ann,
          id: `ann_${Date.now()}`,
          publishDate: new Date().toISOString().split('T')[0]
        },
        ...prev.announcements
      ]
    }));
  };

  const deleteAnnouncement = (annId: string) => {
    setState(prev => ({
      ...prev,
      announcements: prev.announcements.filter(a => a.id !== annId)
    }));
  };

  const sendChatMessage = (toId: string, toName: string, toRole: string, text: string) => {
    if (!user) return;
    setState(prev => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          id: `msg_${Date.now()}`,
          fromId: user.id,
          fromName: user.name,
          fromRole: user.role,
          toId,
          toName,
          message: text,
          timestamp: new Date().toLocaleString(),
          unread: true
        }
      ]
    }));
  };

  const updateSystemSettings = (settings: any) => {
    setState(prev => ({
      ...prev,
      systemSettings: {
        ...prev.systemSettings,
        ...settings
      }
    }));
  };

  // FORCE SIMULATION OVERRIDES
  const forceUnlockStage = (studentId: string, stage: OJTStage) => {
    updateStudentState(studentId, s => {
      let preOjt = [...s.preOJTRequirements];
      let moa = { ...s.moaState };
      let duringOjt = [...s.duringOJTRequirements];
      let postOjt = [...s.postOJTRequirements];
      let totalHours = s.totalHoursRendered;

      if (stage === 'Stage 2: During OJT' || stage === 'Stage 3: Post-OJT' || stage === 'Stage 4: Portfolio Completion') {
        preOjt = preOjt.map(r => ({ ...r, status: 'Approved' }));
        moa.status = 'SIGNED AND NOTARIZED';
      }

      if (stage === 'Stage 3: Post-OJT' || stage === 'Stage 4: Portfolio Completion') {
        duringOjt = duringOjt.map(r => ({ ...r, status: 'Approved' }));
        totalHours = s.requiredHours; // mark complete
      }

      if (stage === 'Stage 4: Portfolio Completion') {
        postOjt = postOjt.map(r => ({ ...r, status: 'Approved' }));
      }

      return {
        ...s,
        preOJTRequirements: preOjt,
        moaState: moa,
        duringOJTRequirements: duringOjt,
        postOJTRequirements: postOjt,
        totalHoursRendered: totalHours,
        stage
      };
    });
  };

  const resetAllDemoData = () => {
    saveApiState(OJT_STATE_KEY, {}).finally(() => window.location.reload());
  };

  return (
    <OJTContext.Provider
      value={{
        students: state.students,
        companies: state.companies,
        htePartners: state.htePartners,
        announcements: state.announcements,
        messages: state.messages,
        templates: state.templates,
        evaluationFormConfigs: state.evaluationFormConfigs,
        systemSettings: state.systemSettings,
        mockLocation,
        setMockLocation,
        
        timeIn,
        timeOut,
        requestAttendanceCorrection,
        submitDailyTask,
        deleteDailyTask,
        updateDailyTask,
        submitWeeklyJournal,
        updateWeeklyJournal,
        uploadPreOJTReq,
        uploadDuringOJTReq,
        uploadPostOJTReq,
        uploadMOA,
        submitPortfolio,
        generateDTR,
        submitGeneratedDTR,
        submitDTR,
        updateDTRStatus,
        
        reviewPreOJTReq,
        reviewDuringOJTReq,
        reviewPostOJTReq,
        reviewMOA,
        reviewDailyTask,
        reviewWeeklyJournal,
        reviewPortfolio,
        reviewAttendanceCorrection,
        submitStudentEvaluation,
        reviewCoordinatorRequirement,
        reviewCoordinatorPortfolio,
        
        addStudentProfile,
        updateStudentProfile,
        addCompany,
        updateCompany,
        addHTEPartner,
        updateHTEPartner,
        addTemplate,
        updateTemplate,
        addAnnouncement,
        deleteAnnouncement,
        sendChatMessage,
        updateSystemSettings,
        
        forceUnlockStage,
        resetAllDemoData
      }}
    >
      {children}
    </OJTContext.Provider>
  );
}

export function useOJT() {
  const context = useContext(OJTContext);
  if (context === undefined) {
    throw new Error('useOJT must be used within an OJTProvider');
  }
  return context;
}

/** Bridge saved backend data into the unchanged original module components. */
export const ProtectedOJTProvider = OJTContext.Provider;
