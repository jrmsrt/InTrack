import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { loadApiState, saveApiState } from '../lib/apiState';
import { initialAuthorizedStudents as uploadedAuthorizedStudents } from '../data/initialAuthorizedStudents';
import { PRIVACY_NOTICE_VERSION, PrivacyConsentRecord } from '../lib/privacy';
import { demoControlsEnabled, isDemoMode } from '../lib/runtimeMode';

export type UserRole = 'student' | 'adviser' | 'coordinator';
export type AccountStatus = 'Pending Verification' | 'Verified' | 'Suspended';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accountStatus?: AccountStatus;
  password?: string;
  avatar?: string;
  studentId?: string;
  studentNumber?: string;
  university?: string;
  company?: string;
  program?: string;
  section?: string;
  contactNumber?: string;
  position?: string;
  companyAddress?: string;
  passwordChanged?: boolean;
  emailVerified?: boolean;
  privacyConsent?: PrivacyConsentRecord;
}

export interface PendingOtpVerification {
  email: string;
  role: UserRole;
  codeHash: string;
  expiresAt: string;
  createdAt: string;
  purpose: 'activation' | 'passwordReset';
}

type LoginResult = { success: boolean; error?: string; requiresOtp?: boolean };

export interface AuthorizedStudent {
  studentNumber: string;
  name: string;
  email: string;
  program: string;
  section: string;
  accountStatus: 'ACTIVE' | 'DISABLED';
  activated: boolean;
  emailVerified?: boolean;
  passwordChanged?: boolean;
  failedOtpAttempts?: number;
  lockoutUntil?: string | null;
  otpRequestTimestamps?: string[];
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: UserRole, consent?: PrivacyConsentRecord) => LoginResult;
  hasCurrentPrivacyConsent: (email: string, role: UserRole) => boolean;
  registerAccount: (account: User) => { success: boolean; error?: string };
  verifyEmail: (email: string) => void;
  getPendingOtp: () => PendingOtpVerification | null;
  verifyOtp: (otpCode: string) => { success: boolean; error?: string };
  resendOtp: () => { success: boolean; error?: string };
  continueAfterOtp: () => { success: boolean; error?: string };
  changePasswordAfterOtp: (newPassword: string) => { success: boolean; error?: string };
  requestPasswordReset: (email: string) => LoginResult;
  resendVerificationEmail: (email: string) => void;
  updateUser: (updates: Partial<User>) => void;
  isEmailRegistered: (email: string) => boolean;
  isStudentWhitelisted: (email: string, studentNumber?: string) => boolean;
  getAuthorizedStudents: () => AuthorizedStudent[];
  authorizeStudent: (student: Omit<AuthorizedStudent, 'accountStatus' | 'activated'>) => { success: boolean; error?: string };
  toggleAuthorizedStudent: (studentNumber: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const registeredAccountsKey = 'registeredAccounts';
const authorizedStudentsKey = 'authorizedStudents';
const pendingOtpKey = 'pendingOtpVerification';
const verifiedOtpKey = 'verifiedOtpAccount';
const otpPreviewKey = 'lastOtpPreview';
const AUTH_STATE_KEY = 'auth';
export const DEFAULT_STUDENT_PASSWORD = 'PUPrs@1904';
const MAX_OTP_REQUESTS_PER_HOUR = 5;
const MAX_FAILED_OTP_ATTEMPTS = 5;
const OTP_LOCKOUT_MS = 15 * 60 * 1000;
const sidebarPreferenceKey = 'intrack.sidebarCollapsed';
const privacyConsentsKey = 'privacyConsents';

const passwordRules = [
  (value: string) => value.length >= 8,
  (value: string) => /[A-Z]/.test(value),
  (value: string) => /[a-z]/.test(value),
  (value: string) => /\d/.test(value),
  (value: string) => /[^A-Za-z0-9]/.test(value),
];

interface AuthDatabaseState {
  registeredAccounts?: User[];
  privacyConsents?: PrivacyConsentRecord[];
}

function readStoredArray<T>(key: string): T[] {
  const value = localStorage.getItem(key);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

function readStoredObject<T extends object>(key: string): T | null {
  const value = localStorage.getItem(key);
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function getAuthDatabaseSnapshot(): AuthDatabaseState {
  return {
    registeredAccounts: readStoredArray<User>(registeredAccountsKey),
    privacyConsents: readStoredArray<PrivacyConsentRecord>(privacyConsentsKey),
  };
}

function getPrivacyConsents(): PrivacyConsentRecord[] {
  return readStoredArray<PrivacyConsentRecord>(privacyConsentsKey);
}

function findCurrentPrivacyConsent(email: string, role: UserRole) {
  const normalizedEmail = email.trim().toLowerCase();
  return getPrivacyConsents().find(
    (record) => record.email.toLowerCase() === normalizedEmail && record.role === role && record.version === PRIVACY_NOTICE_VERSION,
  );
}

function isValidPrivacyConsent(consent?: PrivacyConsentRecord) {
  if (!consent || consent.version !== PRIVACY_NOTICE_VERSION || Number.isNaN(Date.parse(consent.acceptedAt))) return false;
  return new Date(consent.acceptedAt).getTime() <= Date.now() + 60_000;
}

function savePrivacyConsent(consent: PrivacyConsentRecord) {
  const normalizedConsent = { ...consent, email: consent.email.trim().toLowerCase() };
  const remaining = getPrivacyConsents().filter(
    (record) => !(record.email.toLowerCase() === normalizedConsent.email && record.role === normalizedConsent.role && record.version === normalizedConsent.version),
  );
  localStorage.setItem(privacyConsentsKey, JSON.stringify([...remaining, normalizedConsent]));
  persistAuthDatabaseSnapshot();
  fetch('/api/privacy-consents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalizedConsent),
  }).catch((error) => {
    console.error('Failed to save the privacy consent audit record.', error);
  });
  return normalizedConsent;
}

function persistAuthDatabaseSnapshot() {
  saveApiState(AUTH_STATE_KEY, getAuthDatabaseSnapshot()).catch((error) => {
    console.error('Failed to save auth data to MySQL.', error);
  });
}



function mergeRequiredAuthorizedStudents(students: AuthorizedStudent[]) {
  const merged = [...students];
  const demoEmails = ['sarah.johnson@university.edu', 'david.martinez@university.edu', 'lisa.wang@university.edu'];

  uploadedAuthorizedStudents.forEach((requiredStudent) => {
    if (demoEmails.includes(requiredStudent.email.toLowerCase())) return;
    const existingIndex = merged.findIndex((student) => student.email.toLowerCase() === requiredStudent.email.toLowerCase());
    if (existingIndex === -1) {
      merged.push(requiredStudent);
    }
  });

  return merged;
}

function getRegisteredAccounts(): User[] {
  const parsedAccounts = readStoredArray<User>(registeredAccountsKey);
  const demoEmails = ['sarah.johnson@university.edu', 'david.martinez@university.edu', 'lisa.wang@university.edu'];
  const accounts = parsedAccounts.filter(
    (account: User) => account.id !== 'test-jaira-masarate' && !demoEmails.includes(account.email.toLowerCase()),
  ).map((account: User) => {
    if (account.role === 'student' && account.name) {
      return { ...account, name: formatNameWithMiddleInitial(account.name) };
    }
    return account;
  });
  if (JSON.stringify(accounts) !== JSON.stringify(parsedAccounts)) {
    localStorage.setItem(registeredAccountsKey, JSON.stringify(accounts));
  }

  return accounts;
}

function saveRegisteredAccounts(accounts: User[]) {
  localStorage.setItem(registeredAccountsKey, JSON.stringify(accounts));
  persistAuthDatabaseSnapshot();
}

function getAuthorizedStudentRecords(): AuthorizedStudent[] {
  const savedStudents = localStorage.getItem(authorizedStudentsKey);
  const demoEmails = ['sarah.johnson@university.edu', 'david.martinez@university.edu', 'lisa.wang@university.edu'];

  if (savedStudents) {
    let students = readStoredArray<AuthorizedStudent>(authorizedStudentsKey);
    students = students.filter((s: AuthorizedStudent) => !demoEmails.includes(s.email.toLowerCase()));
    const mergedStudents = mergeRequiredAuthorizedStudents(students);

    if (JSON.stringify(mergedStudents) !== JSON.stringify(students)) {
      localStorage.setItem(authorizedStudentsKey, JSON.stringify(mergedStudents));
    }

    return mergedStudents.map(normalizeAuthorizedStudent);
  }

  const sanitizedUploaded = uploadedAuthorizedStudents.filter((s: AuthorizedStudent) => !demoEmails.includes(s.email.toLowerCase()));
  localStorage.setItem(authorizedStudentsKey, JSON.stringify(sanitizedUploaded));
  return sanitizedUploaded.map(normalizeAuthorizedStudent);
}

function saveAuthorizedStudentRecords(students: AuthorizedStudent[]) {
  localStorage.setItem(authorizedStudentsKey, JSON.stringify(students));
  fetch('/api/authorized-students', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ students }),
  }).catch((error) => {
    console.error('Failed to save authorized students to MySQL.', error);
  });
}

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

function normalizeAuthorizedStudent(student: AuthorizedStudent): AuthorizedStudent {
  const emailVerified = student.emailVerified ?? student.activated ?? false;
  const passwordChanged = student.passwordChanged ?? student.activated ?? false;
  const formattedName = formatNameWithMiddleInitial(student.name);

  return {
    ...student,
    name: formattedName,
    emailVerified,
    passwordChanged,
    activated: emailVerified && passwordChanged,
    failedOtpAttempts: student.failedOtpAttempts ?? 0,
    lockoutUntil: student.lockoutUntil ?? null,
    otpRequestTimestamps: student.otpRequestTimestamps ?? [],
  };
}

function findAuthorizedStudent(email: string, studentNumber?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedStudentNumber = studentNumber?.trim().toUpperCase();

  return getAuthorizedStudentRecords().find((student) => {
    const emailMatches = student.email.toLowerCase() === normalizedEmail;
    const numberMatches = !normalizedStudentNumber || student.studentNumber.toUpperCase() === normalizedStudentNumber;
    return emailMatches && numberMatches;
  });
}

function generateOtp() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function hashOtp(code: string) {
  let hash = 0;

  for (let index = 0; index < code.length; index += 1) {
    hash = (hash << 5) - hash + code.charCodeAt(index);
    hash |= 0;
  }

  return `otp_${Math.abs(hash)}`;
}

function sendOtpToWebmail(email: string, code: string, purpose: PendingOtpVerification['purpose']) {
  fetch('/api/send-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, code, purpose }),
  })
    .then(async (response) => {
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'OTP email request failed.');
      }
    })
    .catch((error) => {
      console.error('Failed to send OTP email.', error);
    });
}

function isLocked(student: AuthorizedStudent) {
  return Boolean(student.lockoutUntil && new Date(student.lockoutUntil).getTime() > Date.now());
}

function getActiveHourlyOtpRequests(student: AuthorizedStudent) {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  return (student.otpRequestTimestamps ?? []).filter((timestamp) => new Date(timestamp).getTime() > oneHourAgo);
}

function updateAuthorizedStudent(email: string, updates: (student: AuthorizedStudent) => AuthorizedStudent) {
  saveAuthorizedStudentRecords(
    getAuthorizedStudentRecords().map((student) =>
      student.email.toLowerCase() === email.trim().toLowerCase() ? updates(student) : student,
    ),
  );
}

function savePendingOtp(email: string, role: UserRole, purpose: PendingOtpVerification['purpose']) {
  const normalizedEmail = email.trim().toLowerCase();
  const student = findAuthorizedStudent(normalizedEmail);

  if (!student) {
    return { success: false, error: 'We could not find this student in the authorized masterlist.' };
  }

  if (isLocked(student)) {
    return { success: false, error: 'This account is temporarily locked. Please try again after 15 minutes.' };
  }

  const activeRequests = getActiveHourlyOtpRequests(student);

  if (activeRequests.length >= MAX_OTP_REQUESTS_PER_HOUR) {
    return { success: false, error: 'You have reached the OTP request limit. Please try again later.' };
  }

  const code = generateOtp();
  const pendingOtp: PendingOtpVerification = {
    email: normalizedEmail,
    role,
    codeHash: hashOtp(code),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    purpose,
  };

  localStorage.setItem(pendingOtpKey, JSON.stringify(pendingOtp));
  if (demoControlsEnabled) {
    localStorage.setItem(otpPreviewKey, code);
  } else {
    localStorage.removeItem(otpPreviewKey);
  }
  if (!isDemoMode) sendOtpToWebmail(normalizedEmail, code, purpose);
  updateAuthorizedStudent(normalizedEmail, (record) => ({
    ...record,
    otpRequestTimestamps: [...activeRequests, new Date().toISOString()],
  }));
  return { success: true, pendingOtp };
}

function getPendingOtpRecord(): PendingOtpVerification | null {
  return readStoredObject<PendingOtpVerification>(pendingOtpKey);
}

function createAccountFromAuthorizedStudent(student: AuthorizedStudent): User {
  return {
    id: `student-${student.studentNumber}`,
    name: student.name,
    email: student.email,
    role: 'student',
    accountStatus: 'Verified',
    password: DEFAULT_STUDENT_PASSWORD,
    passwordChanged: false,
    emailVerified: false,
    studentId: student.studentNumber,
    studentNumber: student.studentNumber,
    university: 'Polytechnic University of the Philippines',
    program: student.program,
    section: student.section,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    // The active browser session stays local; account records sync through MySQL.
    const parsed = readStoredObject<User>('user');
    if (parsed) {
      if (parsed.role === 'student' && parsed.name) {
        parsed.name = formatNameWithMiddleInitial(parsed.name);
      }
      return parsed;
    }
    return null;
  });

  useEffect(() => {
    fetch('/api/authorized-students')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to load authorized students.');
        }
        return response.json();
      })
      .then((payload) => {
        if (Array.isArray(payload.students)) {
          localStorage.setItem(authorizedStudentsKey, JSON.stringify(payload.students));
        }
      })
      .catch((error) => {
        console.error('Failed to load authorized students from MySQL.', error);
        getAuthorizedStudentRecords();
      });

    loadApiState<AuthDatabaseState>(AUTH_STATE_KEY)
      .then((databaseState) => {
        if (!databaseState) {
          getRegisteredAccounts();
          persistAuthDatabaseSnapshot();
          return;
        }

        if (databaseState.registeredAccounts) {
          localStorage.setItem(registeredAccountsKey, JSON.stringify(databaseState.registeredAccounts));
        }
        if (databaseState.privacyConsents) {
          localStorage.setItem(privacyConsentsKey, JSON.stringify(databaseState.privacyConsents));
        }
      })
      .catch((error) => {
        console.error('Failed to load auth data from MySQL.', error);
      });
  }, []);

  useEffect(() => {
    // Keep only the current signed-in session in browser storage.
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('userRole', user.role);
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('userRole');
    }
  }, [user]);

  const findAccount = (email: string, role: UserRole) => {
    const normalizedEmail = email.trim().toLowerCase();
    const registeredAccount = getRegisteredAccounts().find(
      (account) => account.email.toLowerCase() === normalizedEmail && account.role === role,
    );

    if (registeredAccount) {
      return registeredAccount;
    }

    if (role === 'coordinator') {
      const adminAccount: User = {
        id: 'admin',
        name: 'OJT Coordinator',
        email: 'admin@pup.edu.ph',
        role: 'coordinator',
        accountStatus: 'Verified',
        password: 'RSadmin@1904',
        emailVerified: true,
        passwordChanged: true,
        university: 'Polytechnic University of the Philippines',
      };
      return normalizedEmail === 'admin' || normalizedEmail === adminAccount.email ? adminAccount : undefined;
    }

    if (role === 'adviser') {
      const adviserAccount: User = {
        id: '2',
        name: 'Michael Chen',
        email: 'michael.chen@techcorp.com',
        role: 'adviser',
        accountStatus: 'Verified',
        password: 'PUPrs@1904',
        emailVerified: true,
        passwordChanged: true,
        company: 'TechCorp Inc.',
        position: 'OJT Adviser',
        contactNumber: '0917 555 0202',
        companyAddress: '14 Innovation Drive, Makati City',
      };
      return normalizedEmail === 'adviser' || normalizedEmail === adviserAccount.email ? adviserAccount : undefined;
    }

    return undefined;
  };

  const hasCurrentPrivacyConsent = (email: string, role: UserRole) => Boolean(findCurrentPrivacyConsent(email, role));

  const login = (email: string, password: string, role: UserRole, consent?: PrivacyConsentRecord) => {
    const normalizedEmail = email.trim().toLowerCase();

    if (role === 'student') {
      const authorizedStudent = findAuthorizedStudent(email);

      if (!authorizedStudent) {
        return {
          success: false,
          error: 'Access denied. Your email is not included in the authorized student masterlist. Please contact the OJT Coordinator.',
        };
      }

      if (authorizedStudent.accountStatus !== 'ACTIVE') {
        return {
          success: false,
          error: 'Your student account is disabled. Please contact the OJT Coordinator.',
        };
      }

      const existingStudentAccount = findAccount(email, role);
      const accountPassword = existingStudentAccount?.password || DEFAULT_STUDENT_PASSWORD;

      if (password !== accountPassword) {
        return { success: false, error: 'Incorrect password. Please try again.' };
      }

      if (isLocked(authorizedStudent)) {
        return { success: false, error: 'This account is temporarily locked. Please try again after 15 minutes.' };
      }

      const requiresActivationOtp = !existingStudentAccount?.passwordChanged;

      const existingConsent = findCurrentPrivacyConsent(normalizedEmail, role);
      if (!existingConsent && !isValidPrivacyConsent(consent)) {
        return { success: false, error: 'Please review and accept the current Data Privacy Notice to continue.' };
      }
      const activeConsent = existingConsent || savePrivacyConsent({ ...consent!, email: normalizedEmail, role });

      if (requiresActivationOtp) {
        const otpResult = savePendingOtp(normalizedEmail, role, 'activation');
        if (!otpResult.success) {
          return { success: false, error: otpResult.error };
        }
        return { success: false, requiresOtp: true };
      }
    }

    const account = findAccount(email, role);

    if (!account) {
      if (role === 'student' && password === DEFAULT_STUDENT_PASSWORD) {
        return {
          success: false,
          error: 'Student record found in the masterlist, but the account is not activated yet. Please log in with the default password to activate your account.',
        };
      }

      return { success: false, error: 'Account not found. Please check your login details.' };
    }

    if (account.accountStatus === 'Suspended') {
      return { success: false, error: 'This account has been suspended. Please contact the OJT Coordinator.' };
    }

    if (account.accountStatus === 'Pending Verification') {
      return {
        success: false,
        error: 'Your account has not been activated yet. Please verify your email before logging in.',
      };
    }

    if (account.password && account.password !== password) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    const existingConsent = findCurrentPrivacyConsent(normalizedEmail, role);
    if (!existingConsent && !isValidPrivacyConsent(consent)) {
      return { success: false, error: 'Please review and accept the current Data Privacy Notice to continue.' };
    }
    const activeConsent = existingConsent || savePrivacyConsent({ ...consent!, email: normalizedEmail, role });

    const signedInAccount = { ...account, privacyConsent: activeConsent };
    if (getRegisteredAccounts().some((registeredAccount) => registeredAccount.id === account.id)) {
      saveRegisteredAccounts(
        getRegisteredAccounts().map((registeredAccount) => registeredAccount.id === account.id ? signedInAccount : registeredAccount),
      );
    }

    sessionStorage.removeItem(sidebarPreferenceKey);
    setUser(signedInAccount);
    return { success: true };
  };

  const getPendingOtp = () => getPendingOtpRecord();

  const verifyOtp = (otpCode: string) => {
    const pendingOtp = getPendingOtpRecord();

    if (!pendingOtp) {
      return { success: false, error: 'No OTP verification is in progress. Please log in again.' };
    }

    if (new Date(pendingOtp.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(pendingOtpKey);
      localStorage.removeItem(otpPreviewKey);
      return { success: false, error: 'The OTP has expired. Please log in again to request a new code.' };
    }

    const authorizedStudent = findAuthorizedStudent(pendingOtp.email);

    if (!authorizedStudent || isLocked(authorizedStudent)) {
      return { success: false, error: 'This account is temporarily locked. Please try again after 15 minutes.' };
    }

    if (pendingOtp.codeHash !== hashOtp(otpCode.trim())) {
      const failedAttempts = (authorizedStudent.failedOtpAttempts ?? 0) + 1;
      updateAuthorizedStudent(pendingOtp.email, (student) => ({
        ...student,
        failedOtpAttempts: failedAttempts,
        lockoutUntil:
          failedAttempts >= MAX_FAILED_OTP_ATTEMPTS ? new Date(Date.now() + OTP_LOCKOUT_MS).toISOString() : student.lockoutUntil,
      }));

      if (failedAttempts >= MAX_FAILED_OTP_ATTEMPTS) {
        localStorage.removeItem(pendingOtpKey);
        localStorage.removeItem(otpPreviewKey);
        return { success: false, error: 'Too many invalid OTP attempts. This account is locked for 15 minutes.' };
      }

      return { success: false, error: 'Invalid OTP. Please check the 6-digit code and try again.' };
    }

    const accounts = getRegisteredAccounts();
    const existingAccount = accounts.find(
      (account) => account.email.toLowerCase() === pendingOtp.email && account.role === pendingOtp.role,
    );

    if (!existingAccount && !authorizedStudent) {
      return { success: false, error: 'We could not find the account tied to this OTP. Please contact the coordinator.' };
    }

    const activatedAccount = existingAccount
      ? {
          ...existingAccount,
          accountStatus: 'Verified' as AccountStatus,
          password: existingAccount.password || DEFAULT_STUDENT_PASSWORD,
          passwordChanged: existingAccount.passwordChanged ?? false,
          emailVerified: true,
        }
      : { ...createAccountFromAuthorizedStudent(authorizedStudent!), emailVerified: true };

    const accountAlreadyExists = accounts.some(
      (account) => account.email.toLowerCase() === activatedAccount.email.toLowerCase() && account.role === activatedAccount.role,
    );
    const updatedAccounts = accountAlreadyExists
      ? accounts.map((account) =>
          account.email.toLowerCase() === activatedAccount.email.toLowerCase() && account.role === activatedAccount.role
            ? activatedAccount
            : account,
        )
      : [...accounts, activatedAccount];

    saveRegisteredAccounts(updatedAccounts);

    if (authorizedStudent) {
      updateAuthorizedStudent(pendingOtp.email, (student) => ({
        ...student,
        emailVerified: true,
        failedOtpAttempts: 0,
        lockoutUntil: null,
      }));
    }

    localStorage.setItem(
      verifiedOtpKey,
      JSON.stringify({ email: pendingOtp.email, role: pendingOtp.role, purpose: pendingOtp.purpose }),
    );
    localStorage.removeItem(pendingOtpKey);
    localStorage.removeItem(otpPreviewKey);
    return { success: true };
  };

  const resendOtp = () => {
    const pendingOtp = getPendingOtpRecord();

    if (!pendingOtp) {
      return { success: false, error: 'No OTP verification is in progress. Please log in again.' };
    }

    const otpResult = savePendingOtp(pendingOtp.email, pendingOtp.role, pendingOtp.purpose);
    if (!otpResult.success) {
      return { success: false, error: otpResult.error };
    }
    return { success: true };
  };

  const findVerifiedOtpAccount = () => {
    const verifiedOtp = readStoredObject<{ email: string; role: UserRole }>(verifiedOtpKey);
    if (!verifiedOtp) return undefined;
    return getRegisteredAccounts().find(
      (account) => account.email.toLowerCase() === verifiedOtp.email && account.role === verifiedOtp.role,
    );
  };

  const continueAfterOtp = () => {
    const account = findVerifiedOtpAccount();

    if (!account) {
      return { success: false, error: 'Your verified session was not found. Please log in again.' };
    }

    sessionStorage.removeItem(sidebarPreferenceKey);
    setUser(account);
    localStorage.removeItem(verifiedOtpKey);
    return { success: true };
  };

  const changePasswordAfterOtp = (newPassword: string) => {
    const account = findVerifiedOtpAccount();
    const verifiedOtp = readStoredObject<{
      purpose?: PendingOtpVerification['purpose'];
    }>(verifiedOtpKey) || {};

    if (!account) {
      return { success: false, error: 'Your verified session was not found. Please log in again.' };
    }

    if (newPassword === DEFAULT_STUDENT_PASSWORD || newPassword === account.password) {
      return { success: false, error: 'Please choose a new password different from your current password.' };
    }

    if (!passwordRules.every((rule) => rule(newPassword))) {
      return { success: false, error: 'Password must meet all complexity requirements.' };
    }

    const updatedAccount = {
      ...account,
      password: newPassword,
      passwordChanged: true,
      emailVerified: true,
      accountStatus: 'Verified' as AccountStatus,
    };

    saveRegisteredAccounts(
      getRegisteredAccounts().map((registeredAccount) =>
        registeredAccount.email.toLowerCase() === updatedAccount.email.toLowerCase() && registeredAccount.role === updatedAccount.role
          ? updatedAccount
          : registeredAccount,
      ),
    );

    if (verifiedOtp.purpose !== 'passwordReset') {
      sessionStorage.removeItem(sidebarPreferenceKey);
    }
    setUser(verifiedOtp.purpose === 'passwordReset' ? null : updatedAccount);
    updateAuthorizedStudent(updatedAccount.email, (student) => ({
      ...student,
      emailVerified: true,
      passwordChanged: true,
      failedOtpAttempts: 0,
      lockoutUntil: null,
    }));
    localStorage.removeItem(verifiedOtpKey);
    return { success: true };
  };

  const requestPasswordReset = (email: string) => {
    const authorizedStudent = findAuthorizedStudent(email);

    if (!authorizedStudent) {
      return { success: false, error: 'No activated student account was found for that email.' };
    }

    if (authorizedStudent.accountStatus !== 'ACTIVE') {
      return { success: false, error: 'This student account is disabled. Please contact the OJT Coordinator.' };
    }

    if (isLocked(authorizedStudent)) {
      return { success: false, error: 'This account is temporarily locked. Please try again after 15 minutes.' };
    }

    const account = findAccount(email, 'student');

    if (!account?.emailVerified || !account?.passwordChanged) {
      return { success: false, error: 'Forgot password is only available after account activation. Please log in with the default password first.' };
    }

    const otpResult = savePendingOtp(email, 'student', 'passwordReset');
    return otpResult.success ? { success: false, requiresOtp: true } : { success: false, error: otpResult.error };
  };

  const isEmailRegistered = (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const defaultEmails = ['admin@pup.edu.ph', 'michael.chen@techcorp.com'];
    return (
      defaultEmails.includes(normalizedEmail) ||
      getRegisteredAccounts().some((account) => account.email.toLowerCase() === normalizedEmail)
    );
  };

  const registerAccount = (account: User) => {
    let authorizedStudent: AuthorizedStudent | undefined;

    if (account.role === 'student') {
      authorizedStudent = findAuthorizedStudent(account.email, account.studentNumber || account.studentId);

      if (!authorizedStudent) {
        return {
          success: false,
          error: 'Access denied. Only students included in the authorized masterlist can activate an account.',
        };
      }

      if (authorizedStudent.accountStatus !== 'ACTIVE') {
        return {
          success: false,
          error: 'This student record is disabled. Please contact the OJT Coordinator.',
        };
      }
    }

    if (isEmailRegistered(account.email)) {
      return {
        success: false,
        error: 'This email is already registered. Please use a different email or login.',
      };
    }

    const accounts = getRegisteredAccounts();
    saveRegisteredAccounts([
      ...accounts,
      {
        ...account,
        id: `${Date.now()}`,
        ...(authorizedStudent
          ? {
              name: authorizedStudent.name,
              studentId: authorizedStudent.studentNumber,
              studentNumber: authorizedStudent.studentNumber,
              program: authorizedStudent.program,
              section: authorizedStudent.section,
            }
          : {}),
        accountStatus: 'Pending Verification',
        emailVerified: false,
        passwordChanged: false,
      },
    ]);

    return { success: true };
  };

  const verifyEmail = (email: string) => {
    const accounts = getRegisteredAccounts();
    const updatedAccounts = accounts.map((account) =>
      account.email.toLowerCase() === email.toLowerCase()
        ? { ...account, accountStatus: 'Verified' as AccountStatus }
        : account,
    );

    saveRegisteredAccounts(updatedAccounts);

    updateAuthorizedStudent(email, (student) => ({
      ...student,
      activated: true,
    }));
  };

  const resendVerificationEmail = (email: string) => {
    localStorage.setItem('lastVerificationEmail', email);
    localStorage.setItem('lastVerificationEmailSentAt', new Date().toISOString());
  };

  const updateUser = (updates: Partial<User>) => {
    if (!user) return;

    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);

    const accounts = getRegisteredAccounts();
    saveRegisteredAccounts(
      accounts.map((account) => (account.id === updatedUser.id ? updatedUser : account)),
    );
  };

  const isStudentWhitelisted = (email: string, studentNumber?: string) => {
    return Boolean(findAuthorizedStudent(email, studentNumber));
  };

  const authorizeStudent = (student: Omit<AuthorizedStudent, 'accountStatus' | 'activated'>) => {
    const existingStudent = getAuthorizedStudentRecords().find(
      (record) =>
        record.studentNumber.toUpperCase() === student.studentNumber.trim().toUpperCase() ||
        record.email.toLowerCase() === student.email.trim().toLowerCase(),
    );

    if (existingStudent) {
      return {
        success: false,
        error: 'Duplicate student record in masterlist whitelist.',
      };
    }

    saveAuthorizedStudentRecords([
      ...getAuthorizedStudentRecords(),
      {
        ...student,
        studentNumber: student.studentNumber.trim(),
        email: student.email.trim(),
        accountStatus: 'ACTIVE',
        activated: false,
        emailVerified: false,
        passwordChanged: false,
      },
    ]);

    return { success: true };
  };

  const toggleAuthorizedStudent = (studentNumber: string) => {
    saveAuthorizedStudentRecords(
      getAuthorizedStudentRecords().map((student) =>
        student.studentNumber === studentNumber
          ? { ...student, accountStatus: student.accountStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }
          : student,
      ),
    );
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem(sidebarPreferenceKey);
    localStorage.removeItem(pendingOtpKey);
    localStorage.removeItem(verifiedOtpKey);
    localStorage.removeItem(otpPreviewKey);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        hasCurrentPrivacyConsent,
        registerAccount,
        verifyEmail,
        getPendingOtp,
        verifyOtp,
        resendOtp,
        continueAfterOtp,
        changePasswordAfterOtp,
        requestPasswordReset,
        resendVerificationEmail,
        updateUser,
        isEmailRegistered,
        isStudentWhitelisted,
        getAuthorizedStudents: getAuthorizedStudentRecords,
        authorizeStudent,
        toggleAuthorizedStudent,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/** Bridge saved backend data into the unchanged original module components. */
export const ProtectedAuthProvider = AuthContext.Provider;
