import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface CaptchaChallenge {
  challengeId: string;
  prompt: string;
  expiresAt: string;
}

interface AdaptiveCaptchaProps {
  onVerified: () => void;
  resetKey?: number;
}

export function AdaptiveCaptcha({ onVerified, resetKey = 0 }: AdaptiveCaptchaProps) {
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  const loadChallenge = useCallback(async () => {
    setLoading(true);
    setError('');
    setAnswer('');
    setVerified(false);

    try {
      const response = await fetch('/api/captcha/challenge', { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load the security check.');
      setChallenge(await response.json());
    } catch (requestError) {
      setChallenge(null);
      setError(requestError instanceof Error ? requestError.message : 'Unable to load the security check.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChallenge();
  }, [loadChallenge, resetKey]);

  const verify = async () => {
    if (!challenge || !answer.trim()) {
      setError('Enter your answer to continue.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/captcha/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: challenge.challengeId, answer: answer.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.verified) {
        setError(payload.error || 'That answer was not correct. A new challenge has been generated.');
        await loadChallenge();
        return;
      }
      setVerified(true);
      onVerified();
    } catch {
      setError('The security check could not be verified. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5" aria-live="polite">
      <div className="mb-3 flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#800000]" />
        <div>
          <p className="text-sm font-semibold text-slate-800">Security check</p>
          <p className="text-xs leading-relaxed text-slate-600">Required after several unsuccessful attempts.</p>
        </div>
      </div>

      {verified ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          Security check completed.
        </p>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="captcha-answer" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {challenge?.prompt || 'Loading challenge…'}
              </Label>
              <Input
                id="captcha-answer"
                inputMode="numeric"
                autoComplete="off"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                disabled={loading || !challenge}
                className="h-10 rounded-lg border-slate-200 bg-white px-3 text-sm"
                aria-describedby={error ? 'captcha-error' : undefined}
              />
            </div>
            <Button type="button" variant="outline" size="icon" onClick={() => void loadChallenge()} disabled={loading} aria-label="Get a new security challenge" className="h-10 w-10 shrink-0">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {error && <p id="captcha-error" className="text-xs text-red-700">{error}</p>}
          <Button type="button" variant="outline" onClick={() => void verify()} disabled={loading || !challenge || !answer.trim()} className="h-9 w-full border-[#800000]/30 text-xs font-semibold text-[#800000] hover:bg-[#800000]/5">
            {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Verify security check
          </Button>
        </div>
      )}
    </div>
  );
}

