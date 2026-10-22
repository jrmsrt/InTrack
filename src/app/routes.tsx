import { StudentPortal } from './components/shared/StudentPortal';
import { useProtectedIdentity } from './context/useProtectedIdentity';
import { AuthenticatorVerification } from './pages/auth/AuthenticatorVerification';
import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Login } from './pages/auth/Login';
import { AccountAccess } from './pages/auth/AccountAccess';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { PasswordDecision } from './pages/auth/PasswordDecision';
import { ChangePassword } from './pages/auth/ChangePassword';
import { LandingPage } from './pages/LandingPage';
import { OtpVerification } from './pages/auth/OtpVerification';
import { Layout } from './components/shared/Layout';
import { CoordinatorPortal } from './components/shared/CoordinatorPortal';
import {CoordinatorMessages} from './pages/coordinator/CoordinatorMessages';
import {CoordinatorAccount} from './pages/coordinator/CoordinatorAccount';

// Student Portal Pages
import { StudentDashboard } from './pages/student/StudentDashboard';
import { PreOJT } from './pages/student/PreOJT';
import { MOATracking } from './pages/student/MOATracking';
import { Attendance } from './pages/student/Attendance';
import { PrintDTR } from './pages/student/PrintDTR';
import { Tasks } from './pages/student/Tasks';
import { WeeklyJournal } from './pages/student/WeeklyJournal';
import { PrintWeeklyJournal } from './pages/student/PrintWeeklyJournal';
import { DuringOJT } from './pages/student/DuringOJT';
import { PostOJT } from './pages/student/PostOJT';
import { PortfolioBuilder } from './pages/student/PortfolioBuilder';
import { FormsTemplates } from './pages/student/FormsTemplates';

// Adviser Portal Pages
import { AdviserDashboard } from './pages/adviser/AdviserDashboard';
import { StudentMonitoring } from './pages/adviser/StudentMonitoring';
import { AttendanceMonitoring } from './pages/adviser/AttendanceMonitoring';
import { AdviserFormsTemplates } from './pages/adviser/FormsTemplates';
import { JournalReview } from './pages/adviser/JournalReview';
import { RequirementReviews } from './pages/adviser/RequirementReviews';
import { PortfolioReview } from './pages/adviser/PortfolioReview';

// Coordinator Portal Pages
import { CoordinatorDashboard } from './pages/coordinator/CoordinatorDashboard';
import { StudentManagement } from './pages/coordinator/StudentManagement';
import { AdviserManagement } from './pages/coordinator/AdviserManagement';
import { CompanyManagement } from './pages/coordinator/CompanyManagement';
import { MOAManagement } from './pages/coordinator/MOAManagement';
import { TemplateManagement } from './pages/coordinator/TemplateManagement';
import { OJTDatabase } from './pages/coordinator/OJTDatabase';
import { PortfolioManagement } from './pages/coordinator/PortfolioManagement';
import { CoordinatorRequirementsReview } from './pages/coordinator/RequirementsReview';
import { Announcements } from './pages/coordinator/Announcements';
import { Settings as CoordinatorSettings } from './pages/coordinator/Settings';

// Shared Pages
import { Messages } from './pages/shared/Messages';
import { Settings } from './pages/shared/Settings';
import { PrivacyNotice } from './pages/shared/PrivacyNotice';

function getStoredUser() {
  const savedUser = localStorage.getItem('user');
  if (!savedUser) return null;

  try {
    const user = JSON.parse(savedUser);
    return user && typeof user === 'object' && ['student', 'adviser', 'coordinator'].includes(user.role)
      ? user
      : null;
  } catch {
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    return null;
  }
}

// Protected route wrapper
type AppRole = 'student' | 'adviser' | 'coordinator';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: AppRole[] }) {
  if(allowedRoles?.length===1&&allowedRoles[0]==='student')return <StudentPortal>{children}</StudentPortal>;
  const savedUser = getStoredUser();
  
  if (!savedUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(savedUser.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Layout>{children}</Layout>;
}

// Role-based Dashboard router
function DashboardRouter() {
  const {result}=useProtectedIdentity(true);
  if(result.state==='loading')return <main role="status">Checking account access…</main>;
  if(result.state==='signed_out')return <Navigate to="/login" replace/>;
  if(result.state!=='loaded'||result.identity.state!=='ready')return <Navigate to="/account-access" replace/>;
  if(result.identity.usableRoles.includes('coordinator'))return <Navigate to="/coordinator/dashboard" replace/>;
  if(result.identity.usableRoles.includes('student'))return <StudentPortal><StudentDashboard/></StudentPortal>;
  return <Navigate to="/account-access" replace/>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: LandingPage,
  },
  {
    path: '/login',
    Component: Login,
  },
  {
    path: '/forgot-password',
    Component: ForgotPassword,
  },
  {
    path: '/reset-password/*',
    Component: ResetPassword,
  },
  {
    path: '/privacy-notice',
    Component: PrivacyNotice,
  },
  {
    path: '/verify-otp',
    Component: OtpVerification,
  },
  {
    path: '/verify-authenticator',
    Component: AuthenticatorVerification,
  },
  {
    path: '/account-access',
    Component: AccountAccess,
  },
  {
    path: '/password-decision',
    Component: PasswordDecision,
  },
  {
    path: '/change-password',
    Component: ChangePassword,
  },
  {
    path: '/verify-email',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/email-verified',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/verification-expired',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/dashboard',
    element: <DashboardRouter />,
  },
  
  // Student Portal Routes
  {
    path: '/pre-ojt',
    element: <ProtectedRoute allowedRoles={['student']}><PreOJT /></ProtectedRoute>
  },
  {
    path: '/moa',
    element: <ProtectedRoute allowedRoles={['student']}><MOATracking /></ProtectedRoute>
  },
  {
    path: '/attendance',
    element: <ProtectedRoute allowedRoles={['student']}><Attendance /></ProtectedRoute>
  },
  {
    path: '/dtr-generation',
    element: <Navigate to="/attendance" replace />
  },
  {
    path: '/print-dtr/:dtrId',
    element: <ProtectedRoute allowedRoles={['student']}><PrintDTR /></ProtectedRoute>
  },
  {
    path: '/tasks',
    element: <ProtectedRoute allowedRoles={['student']}><Tasks /></ProtectedRoute>
  },
  {
    path: '/weekly-journal',
    element: <ProtectedRoute allowedRoles={['student']}><WeeklyJournal /></ProtectedRoute>
  },
  {
    path: '/print-weekly-journal/:journalId',
    element: <ProtectedRoute allowedRoles={['student']}><PrintWeeklyJournal /></ProtectedRoute>
  },
  {
    path: '/during-ojt',
    element: <ProtectedRoute allowedRoles={['student']}><DuringOJT /></ProtectedRoute>
  },
  {
    path: '/post-ojt',
    element: <ProtectedRoute allowedRoles={['student']}><PostOJT /></ProtectedRoute>
  },
  {
    path: '/portfolio',
    element: <ProtectedRoute allowedRoles={['student']}><PortfolioBuilder /></ProtectedRoute>
  },
  {
    path: '/forms-templates',
    element: <ProtectedRoute allowedRoles={['student']}><FormsTemplates /></ProtectedRoute>
  },

  // Adviser Portal Routes
  {
    path: '/adviser/students',
    element: <ProtectedRoute allowedRoles={['adviser']}><StudentMonitoring /></ProtectedRoute>
  },
  {
    path: '/adviser/attendance',
    element: <ProtectedRoute allowedRoles={['adviser']}><AttendanceMonitoring /></ProtectedRoute>
  },
  {
    path: '/adviser/forms-templates',
    element: <ProtectedRoute allowedRoles={['adviser']}><AdviserFormsTemplates /></ProtectedRoute>
  },
  {
    path: '/adviser/journals',
    element: <ProtectedRoute allowedRoles={['adviser']}><JournalReview /></ProtectedRoute>
  },
  {
    path: '/adviser/review-requirements',
    element: <ProtectedRoute allowedRoles={['adviser']}><RequirementReviews /></ProtectedRoute>
  },
  {
    path: '/adviser/pre-ojt',
    element: <Navigate to="/adviser/review-requirements?stage=pre" replace />
  },
  {
    path: '/adviser/during-ojt',
    element: <Navigate to="/adviser/review-requirements?stage=during" replace />
  },
  {
    path: '/adviser/post-ojt',
    element: <Navigate to="/adviser/review-requirements?stage=post" replace />
  },
  {
    path: '/adviser/portfolio',
    element: <ProtectedRoute allowedRoles={['adviser']}><PortfolioReview /></ProtectedRoute>
  },

  // Coordinator Portal Routes
  {path:'/coordinator/dashboard',element:<CoordinatorPortal><CoordinatorDashboard/></CoordinatorPortal>},
  {path:'/coordinator/messages',element:<CoordinatorPortal><CoordinatorMessages/></CoordinatorPortal>},
  {path:'/coordinator/account',element:<CoordinatorPortal><CoordinatorAccount/></CoordinatorPortal>},
  {
    path: '/coordinator/students',
    element: <CoordinatorPortal><StudentManagement /></CoordinatorPortal>
  },
  {
    path: '/coordinator/advisers',
    element: <CoordinatorPortal><AdviserManagement /></CoordinatorPortal>
  },
  {
    path: '/coordinator/companies',
    element: <CoordinatorPortal><CompanyManagement /></CoordinatorPortal>
  },
  {
    path: '/coordinator/moas',
    element: <CoordinatorPortal><MOAManagement /></CoordinatorPortal>
  },
  {
    path: '/coordinator/templates',
    element: <CoordinatorPortal><TemplateManagement /></CoordinatorPortal>
  },
  {
    path: '/coordinator/database',
    element: <CoordinatorPortal><OJTDatabase /></CoordinatorPortal>
  },
  {
    path: '/coordinator/portfolios',
    element: <CoordinatorPortal><PortfolioManagement /></CoordinatorPortal>
  },
  {
    path: '/coordinator/requirements',
    element: <CoordinatorPortal><CoordinatorRequirementsReview /></CoordinatorPortal>
  },
  {
    path: '/coordinator/announcements',
    element: <CoordinatorPortal><Announcements /></CoordinatorPortal>
  },
  {
    path: '/coordinator/settings',
    element: <CoordinatorPortal><CoordinatorSettings /></CoordinatorPortal>
  },

  // Shared Routes
  {
    path: '/messages',
    element: <ProtectedRoute><Messages /></ProtectedRoute>
  },
  {
    path: '/settings',
    element: <ProtectedRoute><Settings /></ProtectedRoute>
  },
  {
    path: '*',
    element: (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center font-sans">
          <h1 className="text-6xl font-bold text-slate-900 mb-4">404</h1>
          <p className="text-xl text-slate-600 mb-8">Page not found</p>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 bg-[#800000] text-white rounded-lg hover:bg-[#6b0000] font-bold"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    ),
  },
]);
