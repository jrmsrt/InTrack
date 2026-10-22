import {EnrollmentConfiguration} from './pages/shared/EnrollmentConfiguration';
import {AdviserPortal} from './components/shared/AdviserPortal';
import {AdviserDashboard} from './pages/adviser/AdviserDashboard';
import {StudentMonitoring} from './pages/adviser/StudentMonitoring';
import {AttendanceMonitoring} from './pages/adviser/AttendanceMonitoring';
import {AdviserFormsTemplates} from './pages/adviser/FormsTemplates';
import {JournalReview} from './pages/adviser/JournalReview';
import {RequirementReviews} from './pages/adviser/RequirementReviews';
import {PortfolioReview} from './pages/adviser/PortfolioReview';
import { StudentPortal } from './components/shared/StudentPortal';
import { useProtectedIdentity } from './context/useProtectedIdentity';
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
import { Messages } from './pages/shared/Messages';
import { Settings } from './pages/shared/Settings';
import { AuthenticatorVerification } from './pages/auth/AuthenticatorVerification';
import { BrowserRouter, Navigate, Route, Routes, RouterProvider, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { OJTProvider } from './context/OJTContext';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
import { isDemoMode } from './lib/runtimeMode';
import { DevelopmentAccountSetup } from './pages/auth/DevelopmentAccountSetup';
import { DevelopmentRequirements } from './pages/auth/DevelopmentRequirements';
import { DevelopmentBackend } from './pages/auth/DevelopmentBackend';
import { DevelopmentTraining } from './pages/auth/DevelopmentTraining';
import { DevelopmentTemplates } from './pages/auth/DevelopmentTemplates';
import { Login } from './pages/auth/Login';
import { OtpVerification } from './pages/auth/OtpVerification';
import { AccountAccess } from './pages/auth/AccountAccess';
import { PrivacyNotice } from './pages/shared/PrivacyNotice';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { PasswordDecision } from './pages/auth/PasswordDecision';
import { ChangePassword } from './pages/auth/ChangePassword';
import { CoordinatorPortal } from './components/shared/CoordinatorPortal';
import { StudentManagement } from './pages/coordinator/StudentManagement';
import { AdviserManagement } from './pages/coordinator/AdviserManagement';
import { CoordinatorDashboard } from './pages/coordinator/CoordinatorDashboard';
import {CompanyManagement} from './pages/coordinator/CompanyManagement';
import {MOAManagement} from './pages/coordinator/MOAManagement';
import {CoordinatorRequirementsReview} from './pages/coordinator/RequirementsReview';
import {TemplateManagement} from './pages/coordinator/TemplateManagement';
import {OJTDatabase} from './pages/coordinator/OJTDatabase';
import {PortfolioManagement} from './pages/coordinator/PortfolioManagement';
import {Announcements} from './pages/coordinator/Announcements';
import {Settings as CoordinatorSettings} from './pages/coordinator/Settings';
import {CoordinatorMessages} from './pages/coordinator/CoordinatorMessages';
import {CoordinatorAccount} from './pages/coordinator/CoordinatorAccount';
import { LandingPage } from './pages/LandingPage';

const integratedPaths=new Set(['/','/login','/forgot-password','/reset-password','/reset-password/new','/verify-otp','/verify-authenticator','/password-decision','/change-password','/account-access','/privacy-notice','/coordinator/students','/coordinator/advisers','/pre-ojt','/moa','/attendance','/dtr-generation','/tasks','/weekly-journal','/during-ojt','/post-ojt','/portfolio','/forms-templates','/dashboard','/messages','/settings']);

function LandingRoute() {
 const {search}=useLocation();
 // Older recovery emails now open code entry inside the router.
 return new URLSearchParams(search).get('type')==='recovery'
  ? <Navigate to="/reset-password" replace/>
  : <LandingPage/>;
}

function AccountPortalRoute({page}:{page:'dashboard'|'messages'|'settings'}){
 const {result}=useProtectedIdentity(true);
 if(result.state==='signed_out')return <Navigate to="/login" replace/>;
 if(result.state==='loading')return <main className="p-8" role="status">Checking account access…</main>;
 if(result.state==='unavailable')return <Navigate to="/account-access" replace/>;
 const identity=result.identity;
 if(identity.state!=='ready')return <Navigate to="/account-access" replace/>;
 if(identity.usableRoles.includes('coordinator'))return <Navigate to={page==='dashboard'?'/coordinator/dashboard':page==='messages'?'/coordinator/messages':'/coordinator/account'} replace/>;
 if(identity.usableRoles.includes('adviser')&&!identity.usableRoles.includes('student'))return <Navigate to={`/adviser/${page}`} replace/>;
 if(identity.usableRoles.includes('student'))return <StudentPortal>{page==='dashboard'?<StudentDashboard/>:page==='messages'?<Messages savedConversations={[]} savedMessages={[]}/>:<Settings/>}</StudentPortal>;
 return <Navigate to="/account-access" replace/>;
}

export default function App() {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('templatesTest') === '1') {
    return <DevelopmentTemplates />;
  }
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('trainingTest') === '1') {
    return <DevelopmentTraining />;
  }
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('backendTest') === '1') {
    return <DevelopmentBackend />;
  }
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('requirementsTest') === '1') {
    return <DevelopmentRequirements />;
  }
  if ((import.meta.env.DEV||!isDemoMode) && new URLSearchParams(window.location.search).get('authSetup') === '1') {
    return <DevelopmentAccountSetup localOnly={isDemoMode}/>;
  }
  // Normal sign-in and integrated portal routes do not mount demo Auth/OJT state.
  if (!isDemoMode || integratedPaths.has(window.location.pathname.replace(/\/+$/,'')||'/') || (window.location.pathname==='/coordinator'||window.location.pathname.startsWith('/coordinator/')) || window.location.pathname.startsWith('/adviser/') || window.location.pathname.startsWith('/print-dtr/') || window.location.pathname.startsWith('/print-weekly-journal/') || window.location.pathname==='/dashboard' || window.location.pathname==='/messages' || window.location.pathname==='/settings') {
    return <BrowserRouter><Routes>
      <Route path="/" element={<LandingRoute />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/*" element={<ResetPassword />} />
      <Route path="/verify-otp" element={<OtpVerification />} />
      <Route path="/verify-authenticator" element={<AuthenticatorVerification />} />
      <Route path="/password-decision" element={<PasswordDecision />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="/account-access" element={<AccountAccess />} />
      <Route path="/privacy-notice" element={<PrivacyNotice />} />
      <Route path="/dashboard" element={<AccountPortalRoute page="dashboard" />} />
      <Route path="/coordinator" element={<Navigate to="/coordinator/dashboard" replace />} />
      <Route path="/adviser/dashboard" element={<AdviserPortal><AdviserDashboard/></AdviserPortal>}/>
      <Route path="/adviser/students" element={<AdviserPortal><StudentMonitoring/></AdviserPortal>}/>
      <Route path="/adviser/attendance" element={<AdviserPortal><AttendanceMonitoring/></AdviserPortal>}/>
      <Route path="/adviser/forms-templates" element={<AdviserPortal><AdviserFormsTemplates/></AdviserPortal>}/>
      <Route path="/adviser/journals" element={<AdviserPortal><JournalReview/></AdviserPortal>}/>
      <Route path="/adviser/review-requirements" element={<AdviserPortal><RequirementReviews/></AdviserPortal>}/>
      <Route path="/adviser/portfolio" element={<AdviserPortal><PortfolioReview/></AdviserPortal>}/>
      <Route path="/adviser/messages" element={<AdviserPortal><Messages savedConversations={[]} savedMessages={[]}/></AdviserPortal>}/>
      <Route path="/adviser/settings" element={<AdviserPortal><Settings/></AdviserPortal>}/>
      <Route path="/coordinator/dashboard" element={<CoordinatorPortal><CoordinatorDashboard /></CoordinatorPortal>} />
      <Route path="/coordinator/moas" element={<CoordinatorPortal><MOAManagement /></CoordinatorPortal>} />
      <Route path="/coordinator/requirements" element={<CoordinatorPortal><CoordinatorRequirementsReview /></CoordinatorPortal>} />
      <Route path="/coordinator/templates" element={<CoordinatorPortal><TemplateManagement /></CoordinatorPortal>} />
      <Route path="/coordinator/portfolios" element={<CoordinatorPortal><PortfolioManagement /></CoordinatorPortal>} />
      <Route path="/coordinator/companies" element={<CoordinatorPortal><CompanyManagement/></CoordinatorPortal>} />
      <Route path="/coordinator/database" element={<CoordinatorPortal><OJTDatabase/></CoordinatorPortal>} />
      <Route path="/coordinator/announcements" element={<CoordinatorPortal><Announcements/></CoordinatorPortal>} />
      <Route path="/coordinator/settings" element={<CoordinatorPortal><CoordinatorSettings/></CoordinatorPortal>} />
      <Route path="/coordinator/messages" element={<CoordinatorPortal><CoordinatorMessages/></CoordinatorPortal>} />
      <Route path="/coordinator/account" element={<CoordinatorPortal><CoordinatorAccount/></CoordinatorPortal>} />
      <Route path="/messages" element={<AccountPortalRoute page="messages" />} />
      <Route path="/settings" element={<AccountPortalRoute page="settings" />} />
      <Route path="/adviser/enrollment" element={<AdviserPortal><EnrollmentConfiguration role="adviser"/></AdviserPortal>} />
      <Route path="/coordinator/enrollment" element={<CoordinatorPortal><EnrollmentConfiguration role="coordinator"/></CoordinatorPortal>} />
      <Route path="/coordinator/students" element={<CoordinatorPortal><StudentManagement /></CoordinatorPortal>} />
      <Route path="/coordinator/advisers" element={<CoordinatorPortal><AdviserManagement /></CoordinatorPortal>} />
      <Route path="/pre-ojt" element={<StudentPortal><PreOJT/></StudentPortal>} />
      <Route path="/moa" element={<StudentPortal><MOATracking/></StudentPortal>} />
      <Route path="/attendance" element={<StudentPortal><Attendance/></StudentPortal>} />
      <Route path="/tasks" element={<StudentPortal><Tasks/></StudentPortal>} />
      <Route path="/weekly-journal" element={<StudentPortal><WeeklyJournal/></StudentPortal>} />
      <Route path="/during-ojt" element={<StudentPortal><DuringOJT/></StudentPortal>} />
      <Route path="/post-ojt" element={<StudentPortal><PostOJT/></StudentPortal>} />
      <Route path="/portfolio" element={<StudentPortal><PortfolioBuilder/></StudentPortal>} />
      <Route path="/forms-templates" element={<StudentPortal><FormsTemplates/></StudentPortal>} />
      <Route path="/print-dtr/:dtrId" element={<StudentPortal><PrintDTR/></StudentPortal>} />
      <Route path="/print-weekly-journal/:journalId" element={<StudentPortal><PrintWeeklyJournal/></StudentPortal>} />
      <Route path="/dtr-generation" element={<Navigate to="/attendance" replace/>}/>
      <Route path="*" element={<Navigate to="/account-access" replace />} />
    </Routes></BrowserRouter>;
  }
  return (
    <AuthProvider>
      <OJTProvider>
        <RouterProvider router={router} />
        <Toaster />
      </OJTProvider>
    </AuthProvider>
  );
}
