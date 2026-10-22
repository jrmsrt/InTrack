import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { PRIVACY_NOTICE_EFFECTIVE_DATE, PRIVACY_NOTICE_VERSION } from '../../lib/privacy';

interface PrivacyConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
}

export function PrivacyConsentDialog({ open, onOpenChange, onAccept }: PrivacyConsentDialogProps) {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!open) setAccepted(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-t-4 border-t-[#800000] bg-white p-0 sm:max-w-lg">
        <DialogHeader className="px-6 pb-0 pt-6 text-left">
          <DialogTitle className="text-xl text-slate-900">Data Privacy Notice</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-slate-600">
            InTrack uses your account, academic, OJT, and submitted information to provide the monitoring service, keep your account secure, and maintain required university records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 text-sm text-slate-700">
          <div className="flex items-start gap-3">
            <Checkbox id="privacy-consent" checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} className="mt-0.5 border-slate-400 data-[state=checked]:border-[#800000] data-[state=checked]:bg-[#800000]" />
            <Label htmlFor="privacy-consent" className="cursor-pointer text-sm font-normal leading-relaxed text-slate-700">
              I have read and agree to the{' '}
              <Link to="/privacy-notice" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#800000] underline underline-offset-2">
                full Privacy Notice
              </Link>.
            </Label>
          </div>

          <p className="text-xs text-slate-500">Version {PRIVACY_NOTICE_VERSION} · Effective {PRIVACY_NOTICE_EFFECTIVE_DATE}</p>
        </div>

        <DialogFooter className="border-t border-slate-100 bg-slate-50/70 px-6 py-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-600">Cancel</Button>
          <Button type="button" disabled={!accepted} onClick={onAccept} className="bg-[#800000] text-white hover:bg-[#6b0000]">Accept and continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
