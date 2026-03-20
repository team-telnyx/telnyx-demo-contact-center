'use client';

import { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../../src/store/hooks';
import { setProfile } from '../../src/features/auth/authSlice';
import { useUpdateProfileMutation } from '../../src/store/api';

const STEPS = [
  { id: 'welcome', title: 'Welcome to Telnyx Contact Center' },
  { id: 'profile', title: 'Your Profile' },
  { id: 'apiKeys', title: 'Telnyx API Keys' },
  { id: 'connections', title: 'Connection IDs' },
  { id: 'numbers', title: 'Phone Numbers & IVR' },
  { id: 'done', title: 'You\'re All Set!' },
];

export default function OnboardingWizard({ onClose }) {
  const dispatch = useAppDispatch();
  const { username, firstName, lastName, telnyxApiKey, telnyxPublicKey, appConnectionId, webrtcConnectionId } = useAppSelector((s) => s.auth);
  const [updateProfile] = useUpdateProfileMutation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    firstName: firstName || '',
    lastName: lastName || '',
    telnyxApiKey: telnyxApiKey || '',
    telnyxPublicKey: telnyxPublicKey || '',
    appConnectionId: appConnectionId || '',
    webrtcConnectionId: webrtcConnectionId || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleFinish();
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = async () => {
    setSaving(true);
    setError('');
    try {
      const body = {
        firstName: form.firstName,
        lastName: form.lastName,
        telnyxApiKey: form.telnyxApiKey,
        telnyxPublicKey: form.telnyxPublicKey,
        appConnectionId: form.appConnectionId,
        webrtcConnectionId: form.webrtcConnectionId,
        onboardingComplete: true,
      };
      await updateProfile({ username, ...body }).unwrap();
      dispatch(setProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        telnyxApiKey: form.telnyxApiKey,
        telnyxPublicKey: form.telnyxPublicKey,
        appConnectionId: form.appConnectionId,
        webrtcConnectionId: form.webrtcConnectionId,
        onboardingComplete: true,
      }));
      onClose();
    } catch (err) {
      setError(err?.data?.message || err?.data?.error || 'Failed to save');
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    try {
      await updateProfile({ username, onboardingComplete: true }).unwrap();
      dispatch(setProfile({ onboardingComplete: true }));
    } catch { /* silent */ }
    onClose();
  };

  const inputClass = "w-full rounded-btn border border-gray-300 bg-white px-3 py-2 text-sm font-mono text-gray-900 focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
  const labelClass = "mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 dark:bg-black/80">
      <div className="w-full max-w-lg rounded-card border border-gray-200 bg-white p-0 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        {/* Progress bar */}
        <div className="flex gap-1 px-6 pt-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-telnyx-green' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{current.title}</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-5 min-h-[220px]">
          {current.id === 'welcome' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Let's get your contact center set up. This wizard will walk you through the essential configuration steps.
              </p>
              <div className="rounded-btn bg-telnyx-green/10 p-4 space-y-2">
                <p className="text-sm font-medium text-telnyx-green">What you'll configure:</p>
                <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                  <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-telnyx-green" /> Your name and profile</li>
                  <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-telnyx-green" /> Telnyx API key and public key</li>
                  <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-telnyx-green" /> Voice application and WebRTC connection IDs</li>
                  <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-telnyx-green" /> How to purchase numbers and create IVR flows</li>
                </ul>
              </div>
              <p className="text-xs text-gray-400">You can always update these later in your Profile settings.</p>
            </div>
          )}

          {current.id === 'profile' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">Set your display name for the agent dashboard.</p>
              <div>
                <label className={labelClass}>First Name</label>
                <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputClass} placeholder="John" />
              </div>
              <div>
                <label className={labelClass}>Last Name</label>
                <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputClass} placeholder="Doe" />
              </div>
            </div>
          )}

          {current.id === 'apiKeys' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Your Telnyx API key is used to provision SIP credentials and manage phone numbers. Find it in the{' '}
                <a href="https://portal.telnyx.com/#/app/api-keys" target="_blank" rel="noopener noreferrer" className="text-telnyx-green underline">Telnyx Portal</a>.
              </p>
              <div>
                <label className={labelClass}>API Key (v2)</label>
                <input type="password" value={form.telnyxApiKey} onChange={(e) => setForm({ ...form, telnyxApiKey: e.target.value })} className={inputClass} placeholder="KEY..." />
                <p className="mt-1 text-[10px] text-gray-400">A SIP credential connection will be auto-created when you save.</p>
              </div>
              <div>
                <label className={labelClass}>Public Key</label>
                <input type="text" value={form.telnyxPublicKey} onChange={(e) => setForm({ ...form, telnyxPublicKey: e.target.value })} className={inputClass} placeholder="GqlF03Fk..." />
                <p className="mt-1 text-[10px] text-gray-400">Found in Telnyx Portal → Auth → Public Key. Used for webhook signature verification.</p>
              </div>
            </div>
          )}

          {current.id === 'connections' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                These IDs connect your app to Telnyx voice services. Find them in{' '}
                <a href="https://portal.telnyx.com/#/app/call-control/applications" target="_blank" rel="noopener noreferrer" className="text-telnyx-green underline">Call Control Applications</a>.
              </p>
              <div>
                <label className={labelClass}>Voice Application Connection ID</label>
                <input type="text" value={form.appConnectionId} onChange={(e) => setForm({ ...form, appConnectionId: e.target.value })} className={inputClass} placeholder="e.g. 2397473570750989860" />
                <p className="mt-1 text-[10px] text-gray-400">The Call Control Application that handles inbound calls and routes to agents.</p>
              </div>
              <div>
                <label className={labelClass}>WebRTC Connection ID</label>
                <input type="text" value={form.webrtcConnectionId} onChange={(e) => setForm({ ...form, webrtcConnectionId: e.target.value })} className={inputClass} placeholder="e.g. 1846572522338780702" />
                <p className="mt-1 text-[10px] text-gray-400">The SIP credential connection for your WebRTC softphone. Auto-created if you provided an API key.</p>
              </div>
            </div>
          )}

          {current.id === 'numbers' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Once configured, here's how to get started with calls:
              </p>
              <div className="space-y-3">
                <div className="flex gap-3 rounded-btn border border-gray-200 p-3 dark:border-gray-700">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-telnyx-green text-xs font-bold text-white">1</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Purchase a Phone Number</p>
                    <p className="text-xs text-gray-500">Go to <strong>Phone Numbers</strong> in the sidebar. Search for available numbers and purchase one.</p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-btn border border-gray-200 p-3 dark:border-gray-700">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-telnyx-green text-xs font-bold text-white">2</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Assign to Voice Application</p>
                    <p className="text-xs text-gray-500">In the Telnyx Portal, assign the number to your Voice Application connection so it receives inbound calls.</p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-btn border border-gray-200 p-3 dark:border-gray-700">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-telnyx-green text-xs font-bold text-white">3</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Set Webhook URLs</p>
                    <p className="text-xs text-gray-500">
                      In your Voice Application, set the webhook URL to: <code className="text-telnyx-green">https://cpaas.telnyx.solutions/api/voice/webhook</code><br/>
                      In your Messaging Profile, set the webhook URL to: <code className="text-telnyx-green">https://cpaas.telnyx.solutions/api/conversations/webhook</code>
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-btn border border-gray-200 p-3 dark:border-gray-700">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-telnyx-green text-xs font-bold text-white">4</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Create an IVR Flow</p>
                    <p className="text-xs text-gray-500">Go to <strong>IVR Builder</strong>, create a flow (e.g. greeting → queue), and publish it to your number.</p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-btn border border-gray-200 p-3 dark:border-gray-700">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-telnyx-green text-xs font-bold text-white">5</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Receive Calls & Messages</p>
                    <p className="text-xs text-gray-500">Set your status to <strong>Online</strong> — calls will auto-route to you through the IVR flow. SMS messages will appear in <strong>Conversations</strong>.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {current.id === 'done' && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-telnyx-green/10">
                <svg className="h-8 w-8 text-telnyx-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Your contact center is ready to go. Click <strong>Finish</strong> to start using the platform.
              </p>
              <p className="mt-2 text-xs text-gray-400">You can update any of these settings later in your Profile page.</p>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-btn bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-300">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button
            onClick={handleSkip}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            I'll set this up later
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={handleBack}
                className="rounded-btn border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={saving}
              className="rounded-btn bg-telnyx-green px-5 py-2 text-sm font-medium text-white hover:bg-telnyx-green/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
