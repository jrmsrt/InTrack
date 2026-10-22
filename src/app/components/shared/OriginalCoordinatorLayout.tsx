import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {useCoordinatorIdentity} from './CoordinatorPortal';
import {getSupabaseClient} from '../../lib/supabaseClient';
import {clearBackendDrafts} from '../../lib/backendDrafts';
import {useCoordinatorModuleData} from '../../context/CoordinatorModuleData';

import type {StudentOJTProfile} from '../../context/OJTContext';
import type {UserRole} from '../../context/AuthContext';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  ClipboardCheck,
  CheckSquare,
  FileText,
  Files,
  BarChart3,
  MessageSquare,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  LogOut,
  User,
  Users,
  Lock,
  Unlock,
  Building,
  GraduationCap,
  MapPin,
  RefreshCw,
  Sliders,
  HelpCircle,
  Award,
  ChevronsLeft,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

interface LayoutProps {
  children: React.ReactNode;
}

const sidebarPreferenceKey = 'intrack.sidebarCollapsed';

export function OriginalCoordinatorLayout({ children }: LayoutProps) {
  const identity=useCoordinatorIdentity();
  const {notifications,loading,error,refresh}=useCoordinatorModuleData();
  const user={id:identity.profile.id,name:identity.profile.displayName,role:'coordinator' as UserRole};
  const studentProfile = ([] as StudentOJTProfile[]).find(()=>false);
  const logout=async()=>{const {error}=await getSupabaseClient().auth.signOut({scope:'local'});if(error)throw error;clearBackendDrafts();};
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => sessionStorage.getItem(sidebarPreferenceKey) !== 'expanded');




  const handleLogout = async () => {
    try{await logout();navigate('/login');}catch{toast.error('Unable to sign out. Please retry.');}
  };

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((collapsed) => {
      const nextCollapsed = !collapsed;
      sessionStorage.setItem(sidebarPreferenceKey, nextCollapsed ? 'collapsed' : 'expanded');
      return nextCollapsed;
    });
  };

  const getNavigationItems = () => {
    if (user?.role === 'student') {
      const stage = studentProfile?.stage || 'Stage 1: Pre-OJT';
      
      // Determine what is locked based on student stage
      const isStage2Locked = stage === 'Stage 1: Pre-OJT';
      const isStage3Locked = stage === 'Stage 1: Pre-OJT' || stage === 'Stage 2: During OJT';
      
      return [
        { path: '/coordinator/dashboard', icon: LayoutDashboard, label: 'Dashboard', locked: false, group: 'dashboard' },
        { path: '/forms-templates', icon: Files, label: 'Forms & Templates', locked: false, group: 'Pre-OJT' },
        { path: '/pre-ojt', icon: ClipboardCheck, label: 'Pre-OJT Requirements', locked: false, group: 'Pre-OJT' },
        { path: '/moa', icon: FileText, label: 'MOA Tracking', locked: false, group: 'Pre-OJT' },
        
        { path: '/attendance', icon: MapPin, label: 'Attendance & DTR', locked: isStage2Locked, group: 'During OJT' },
        { path: '/tasks', icon: CheckSquare, label: 'Daily Task Logs', locked: isStage2Locked, group: 'During OJT' },
        { path: '/weekly-journal', icon: FileText, label: 'Weekly Journals', locked: isStage2Locked, group: 'During OJT' },
        { path: '/during-ojt', icon: Files, label: 'During-OJT Checklist', locked: isStage2Locked, group: 'During OJT' },
        
        { path: '/post-ojt', icon: ClipboardCheck, label: 'Post-OJT Checklist', locked: isStage3Locked, group: 'Post-OJT' },
        { path: '/portfolio', icon: Award, label: 'Portfolio Builder', locked: isStage3Locked, group: 'Post-OJT' },
        { path: '/coordinator/messages', icon: MessageSquare, label: 'Messages & Alerts', locked: false, group: 'Account' },
        { path: '/coordinator/account', icon: Settings, label: 'Profile & Settings', locked: false, group: 'Account' },
      ];
    }

    if (user?.role === 'adviser') {
      return [
        { path: '/coordinator/dashboard', icon: LayoutDashboard, label: 'Adviser Dashboard' },
        { path: '/adviser/forms-templates', icon: Files, label: 'Forms & Templates' },
        { path: '/adviser/review-requirements', icon: ClipboardCheck, label: 'Review Requirements' },
        { path: '/adviser/students', icon: Users, label: 'Student Monitoring' },
        { path: '/adviser/attendance', icon: ClipboardCheck, label: 'Attendance Monitoring' },
        { path: '/adviser/journals', icon: FileText, label: 'Weekly Journal Review' },
        { path: '/adviser/portfolio', icon: Files, label: 'Portfolio Completion Review' },
        { path: '/coordinator/messages', icon: MessageSquare, label: 'Messages' },
        { path: '/coordinator/account', icon: Settings, label: 'Settings' },
      ];
    }

    if (user?.role === 'coordinator') {
      return [
        { path: '/coordinator/dashboard', icon: LayoutDashboard, label: 'Coordinator Dashboard' },
        { path: '/coordinator/students', icon: GraduationCap, label: 'Student Management' },
        { path: '/coordinator/enrollment', icon: ClipboardCheck, label: 'Classes & Requirements' },
        { path: '/coordinator/advisers', icon: Users, label: 'Adviser Management' },
        { path: '/coordinator/companies', icon: Building, label: 'Company Deployment' },
        { path: '/coordinator/moas', icon: FileText, label: 'MOA Management' },
        { path: '/coordinator/requirements', icon: ClipboardCheck, label: 'Requirements Review' },
        { path: '/coordinator/templates', icon: Files, label: 'Template Management' },
        { path: '/coordinator/database', icon: FileText, label: 'OJT Database & Export' },
        { path: '/coordinator/portfolios', icon: Files, label: 'Portfolio Review Board' },
        { path: '/coordinator/announcements', icon: Bell, label: 'Announcements Editor' },
        { path: '/coordinator/settings', icon: Settings, label: 'System Configuration' },
        { path: '/coordinator/messages', icon: MessageSquare, label: 'Messages' },
        { path: '/coordinator/account', icon: Settings, label: 'Settings' },
      ];
    }

    return [
      { path: '/coordinator/dashboard', icon: LayoutDashboard, label: 'Dashboard' }
    ];
  };

  const navItems = getNavigationItems();

  const handleLockedClick = (e: React.MouseEvent, label: string) => {
    e.preventDefault();
    toast.error(`"${label}" is locked. Complete the current OJT Stage requirements to unlock During-OJT and Post-OJT modules.`, {
      description: `Current Stage: ${studentProfile?.stage || 'Stage 1: Pre-OJT'}`
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between px-4 lg:px-6 h-16">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden h-8 w-8 cursor-pointer text-slate-500 hover:bg-slate-100 hover:text-[#800000] lg:inline-flex"
                  onClick={toggleSidebarCollapsed}
                  aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                >
                  <span className="relative block h-4 w-4" aria-hidden="true">
                    <Menu
                      className={`absolute inset-0 h-4 w-4 origin-center transition-[opacity,transform] duration-300 ease-in-out ${
                        sidebarCollapsed
                          ? 'translate-y-0 scale-100 opacity-100'
                          : 'scale-y-50 opacity-0'
                      }`}
                    />
                    <ChevronsLeft
                      className={`absolute inset-0 h-4 w-4 transition-[opacity,transform] duration-300 ease-out ${
                        sidebarCollapsed
                          ? '-rotate-45 scale-75 opacity-0'
                          : 'rotate-0 scale-100 opacity-100'
                      }`}
                    />
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>{sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}</TooltipContent>
            </Tooltip>
            <Link to="/coordinator/dashboard" className="flex items-center gap-2">
              <img 
                src="/pup-logo.png" 
                alt="PUP Logo" 
                className="h-8 w-8 object-contain"
              />
              <span className="font-semibold text-lg hidden sm:inline text-[#800000] tracking-tight">
                InTrack
              </span>
            </Link>
          </div>

          <div className="flex-1 max-w-md mx-4 hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="search"
                placeholder="Search metrics, reports..."
                className="pl-10 bg-slate-50 border-slate-200 rounded-lg focus-visible:ring-[#800000]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Simulation Indicator */}
            {user?.role === 'student' && studentProfile && (
              <Badge className="bg-gradient-to-r from-red-700 to-maroon-800 text-white font-medium text-xs px-3 py-1 mr-2 hidden md:inline-flex items-center gap-1.5 rounded-full shadow-sm">
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
                {studentProfile.stage}
              </Badge>
            )}

            {/* Notification Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-slate-600 hover:bg-slate-100 rounded-full">
                  <Bell className="h-5 w-5" />
                  {notifications.some(n=>!n.read_at)&&<span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500"></span>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>System Alerts</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-80 overflow-y-auto p-1">
                  {!notifications.length&&<p className="p-3 text-xs text-slate-500">No system alerts.</p>}
                  {notifications.map(n=><div key={n.id} className="p-3 rounded-lg hover:bg-slate-50 text-xs transition-colors"><p className="font-semibold text-slate-800">{n.content.kind.replaceAll('_',' ')}</p><p className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p></div>)}

                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Account Details */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2 hover:bg-slate-100 rounded-lg">
                  <div className="h-8 w-8 rounded-full bg-[#800000] text-white flex items-center justify-center font-bold text-sm">
                    {user?.name.charAt(0)}
                  </div>
                  <div className="text-left hidden md:block">
                    <p className="text-sm font-semibold text-slate-800 leading-none">{user?.name}</p>
                    <span className="text-[10px] text-slate-500 font-medium capitalize mt-1 block">
                      {user?.role === 'adviser' ? 'OJT Adviser' : user?.role}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Account Panel</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem data-interactive="true" onClick={() => navigate('/coordinator/account')} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuItem data-interactive="true" onClick={() => navigate('/coordinator/account')} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem data-interactive="true" onClick={handleLogout} className="text-red-600 cursor-pointer focus:bg-red-50 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:sticky top-16 left-0 z-30 h-[calc(100vh-4rem)] w-80 bg-white border-r border-slate-200
            transition-[transform,width] duration-200 ease-in-out ${sidebarCollapsed ? 'lg:w-[4.5rem] lg:min-w-[4.5rem] lg:max-w-[4.5rem] lg:flex-none' : 'lg:w-72'}
            flex flex-col justify-between
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          {/* Navigation Links */}
          <nav className={`space-y-1.5 flex-1 overflow-y-auto p-4 ${sidebarCollapsed ? 'lg:p-2' : 'lg:p-4'}`}>
            {user?.role === 'student' && studentProfile && (
              <div className={`mb-3 rounded-lg bg-slate-50 px-3 py-2 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">OJT Stage Progress</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#800000] h-full rounded-full transition-all duration-300"
                        style={{
                          width: 
                            studentProfile.stage.includes('Stage 1') ? '25%' :
                            studentProfile.stage.includes('Stage 2') ? '50%' :
                            studentProfile.stage.includes('Stage 3') ? '75%' : '100%'
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold text-[#800000]">
                      {studentProfile.stage.includes('Stage 1') ? '1/4' :
                       studentProfile.stage.includes('Stage 2') ? '2/4' :
                       studentProfile.stage.includes('Stage 3') ? '3/4' : '4/4'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const isLocked = 'locked' in item && item.locked;
              const group = 'group' in item ? item.group : undefined;
              const previousItem = navItems[index - 1];
              const previousGroup = previousItem && 'group' in previousItem ? previousItem.group : undefined;
              const showGroupLabel = user?.role === 'student' && group && group !== previousGroup;
              
              const navigationLink = (
                <Link
                  key={item.path}
                  to={isLocked ? '#' : item.path}
                  onClick={(e) => {
                    if (isLocked) {
                      handleLockedClick(e, item.label);
                    } else {
                      setSidebarOpen(false);
                    }
                  }}
                  className={`
                    flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all
                    ${group === 'dashboard' ? 'mb-3' : ''}
                    ${sidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}
                    ${
                      isActive
                        ? 'bg-red-50 text-[#800000] font-bold shadow-sm border-l-4 border-[#800000]'
                        : isLocked
                        ? 'text-slate-300 cursor-not-allowed bg-slate-50/50'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }
                  `}
                >
                  <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'lg:gap-0' : ''}`}>
                    <Icon className={`h-5 w-5 ${isLocked ? 'text-slate-300' : isActive ? 'text-[#800000]' : 'text-slate-500'}`} />
                    <span className={`whitespace-nowrap ${sidebarCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                  </div>
                  {isLocked && <Lock className={`h-3.5 w-3.5 text-slate-300 ${sidebarCollapsed ? 'lg:hidden' : ''}`} />}
                </Link>
              );

              const renderedLink = sidebarCollapsed ? (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{navigationLink}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    {item.label}{isLocked ? ' (locked)' : ''}
                  </TooltipContent>
                </Tooltip>
              ) : navigationLink;

              return (
                <React.Fragment key={item.path}>
                  {showGroupLabel && group !== 'dashboard' && (
                    <p className={`mb-1 mt-4 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 first:mt-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                      {group}
                    </p>
                  )}
                  {renderedLink}
                </React.Fragment>
              );
            })}
          </nav>

          {/* Sidebar Bottom Details */}
          <div className={`border-t border-slate-200 p-4 ${sidebarCollapsed ? 'lg:p-2' : ''}`}>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-sm font-semibold cursor-pointer ${sidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}`}
                  title={sidebarCollapsed ? 'Logout Account' : undefined}
                >
                  <LogOut className="h-5 w-5" />
                  <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Logout Account</span>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to end your current session? You will need to re-verify credentials to access data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction data-interactive="true" onClick={handleLogout} className="bg-red-600 hover:bg-red-700">
                    Logout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </aside>

        {/* Backdrop overlay for mobile sidebar */}
        {sidebarOpen && (
          <div data-interactive="true"
            className="fixed inset-0 bg-black/40 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 lg:p-8">
          {loading&&<p role="status" className="mb-3 text-xs text-slate-500">Loading saved records…</p>}
          {error&&<p role="alert" className="mb-3 text-xs text-red-700">{error} <button className="underline" onClick={refresh}>Retry</button></p>}
          {children}
        </main>
      </div>

    </div>
  );
}
