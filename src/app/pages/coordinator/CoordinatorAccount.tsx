import React, { useState,useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {useCoordinatorIdentity} from '../../components/shared/CoordinatorPortal';
import {getSupabaseClient} from '../../lib/supabaseClient';
import {toast} from 'sonner';
import { User, Lock, Bell, Briefcase, MailCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';

const programOptions = [
  'BSIT — Bachelor of Science in Information Technology',
  'BSOA — Bachelor of Science in Office Administration',
  'BSCpE — Bachelor of Science in Computer Engineering',
  'BSHM — Bachelor of Science in Hospitality Management',
];

const sectionOptions = [
  '1-1',
  '1-2',
  '2-1',
  '2-2',
  '3-1',
  '3-2',
  '4-1',
  '4-2',
];

export function CoordinatorAccount() {
  const identity=useCoordinatorIdentity();
  const user={name:identity.profile.displayName,email:'',role:'coordinator',accountStatus:'Verified',emailVerified:true} as any;
  const updateUser=()=>toast.error('Profile editing is not connected yet. No changes were saved.');
  const resendVerificationEmail=()=>toast.info('Your account is already verified. Use normal login to request a sign-in code.');
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    studentNumber: user?.studentNumber || user?.studentId || '',
    program: user?.program || '',
    section: user?.section || '',
    contactNumber: user?.contactNumber || '',
    company: user?.company || '',
    position: user?.position || '',
    companyAddress: user?.companyAddress || '',
  });
  useEffect(()=>{let alive=true;void getSupabaseClient().auth.getUser().then(({data,error})=>{if(alive&&!error&&data.user)setProfileData(current=>({...current,email:data.user.email||''}));});return()=>{alive=false;};},[identity.profile.id]);
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    taskReminders: true,
    attendanceAlerts: true,
    weeklyReports: false,
  });
  const [verificationResent, setVerificationResent] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const updateProfileField = (name: keyof typeof profileData, value: string) => {
    setProfileData((current) => ({ ...current, [name]: value }));
  };

  const handleSaveProfile = () => {
    updateUser({
      name: profileData.name,
      email: profileData.email,
      studentNumber: profileData.studentNumber,
      studentId: profileData.studentNumber,
      program: profileData.program,
      section: profileData.section,
      contactNumber: profileData.contactNumber,
      company: profileData.company,
      position: profileData.position,
      companyAddress: profileData.companyAddress,
    });
  };

  const handleResendVerification = () => {
    resendVerificationEmail(profileData.email);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-1">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          {user?.role === 'student' && (
            <TabsTrigger value="internship" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Internship
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-20 w-20 rounded-full bg-indigo-600 text-white flex items-center justify-center text-2xl font-medium">
                  {user?.name.charAt(0)}
                </div>
                <div>
                  <Button variant="outline" size="sm">Change Photo</Button>
                  <p className="text-xs text-slate-500 mt-1">JPG, PNG or GIF. Max 2MB</p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">Email Verification Status</p>
                  <p className="text-sm text-slate-500">Verified accounts can access all role features.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <Badge className={user?.accountStatus === 'Pending Verification' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : 'bg-green-100 text-green-800 hover:bg-green-100'}>
                    {user?.accountStatus === 'Pending Verification' ? 'Pending Verification' : 'Verified'}
                  </Badge>
                  {user?.accountStatus === 'Pending Verification' && (
                    <Button variant="outline" size="sm" onClick={handleResendVerification} className="gap-2">
                      <MailCheck className="h-4 w-4" />
                      Resend Verification Email
                    </Button>
                  )}
                </div>
              </div>

              {verificationResent && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 flex gap-2">
                  <MailCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  Verification email resent. Please check your inbox.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(event) => updateProfileField('name', event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(event) => updateProfileField('email', event.target.value)}
                  />
                </div>
                {user?.role === 'student' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="studentNumber">Student Number</Label>
                      <Input
                        id="studentNumber"
                        value={profileData.studentNumber}
                        onChange={(event) => updateProfileField('studentNumber', event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Program/Course</Label>
                      <Select value={profileData.program} onValueChange={(value) => updateProfileField('program', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select program/course" />
                        </SelectTrigger>
                        <SelectContent>
                          {programOptions.map((program) => (
                            <SelectItem key={program} value={program}>{program}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="section">Section</Label>
                      <Select value={profileData.section} onValueChange={(value) => updateProfileField('section', value)}>
                        <SelectTrigger id="section">
                          <SelectValue placeholder="Select section" />
                        </SelectTrigger>
                        <SelectContent>
                          {sectionOptions.map((section) => (
                            <SelectItem key={section} value={section}>{section}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactNumber">Contact Number</Label>
                      <Input
                        id="contactNumber"
                        value={profileData.contactNumber}
                        onChange={(event) => updateProfileField('contactNumber', event.target.value)}
                      />
                    </div>
                  </>
                )}
                {user?.role === 'coordinator' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="coordinatorOrganization">Organization</Label>
                      <Input id="coordinatorOrganization" defaultValue={user?.university || user?.company} />
                    </div>
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex gap-2 text-sm text-blue-800 md:col-span-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      Coordinator accounts are managed internally and do not use public registration.
                    </div>
                  </>
                )}
              </div>

              <Button className="bg-indigo-600 hover:bg-indigo-700" disabled title="Profile editing is not connected yet" onClick={handleSaveProfile}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage your password and security preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#800000] focus:outline-none transition-colors"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#800000] focus:outline-none transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#800000] focus:outline-none transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button disabled title="Use password recovery from the login page" className="bg-indigo-600 hover:bg-indigo-700">Update Password</Button>

              <div className="pt-6 border-t border-slate-200">
                <h4 className="font-medium text-slate-900 mb-4">Two-Factor Authentication</h4>
                <p className="text-sm text-slate-600 mb-4">
                  Authenticator verification is required for coordinator access.
                </p>
                <Button variant="outline" disabled>Authenticator required</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose what notifications you want to receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications">Email Notifications</Label>
                  <p className="text-sm text-slate-500">Receive email updates about your account</p>
                </div>
                <Switch disabled title="Notification preferences are not connected yet"
                  id="email-notifications"
                  checked={notificationSettings.emailNotifications}
                  onCheckedChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, emailNotifications: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="task-reminders">Task Reminders</Label>
                  <p className="text-sm text-slate-500">Get reminded about upcoming task deadlines</p>
                </div>
                <Switch
                  id="task-reminders"
                  checked={notificationSettings.taskReminders}
                  onCheckedChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, taskReminders: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="attendance-alerts">Attendance Alerts</Label>
                  <p className="text-sm text-slate-500">Daily reminders to check in and out</p>
                </div>
                <Switch
                  id="attendance-alerts"
                  checked={notificationSettings.attendanceAlerts}
                  onCheckedChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, attendanceAlerts: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="weekly-reports">Weekly Report Reminders</Label>
                  <p className="text-sm text-slate-500">Get reminded to submit weekly progress reports</p>
                </div>
                <Switch
                  id="weekly-reports"
                  checked={notificationSettings.weeklyReports}
                  onCheckedChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, weeklyReports: checked })
                  }
                />
              </div>

              <Button className="bg-indigo-600 hover:bg-indigo-700">Save Preferences</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {user?.role === 'student' && (
          <TabsContent value="internship">
            <Card>
              <CardHeader>
                <CardTitle>Internship Details</CardTitle>
                <CardDescription>Your internship information and requirements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Company Name</Label>
                    <Input id="company-name" defaultValue="TechCorp Inc." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input id="department" defaultValue="Engineering" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input id="start-date" type="date" defaultValue="2025-09-01" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-date">End Date</Label>
                    <Input id="end-date" type="date" defaultValue="2026-03-31" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="required-hours">Required Hours</Label>
                    <Input id="required-hours" type="number" defaultValue="480" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supervisor">Supervisor</Label>
                    <Input id="supervisor" defaultValue="Michael Chen" />
                  </div>
                </div>
                <Button className="bg-indigo-600 hover:bg-indigo-700">Update Information</Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
