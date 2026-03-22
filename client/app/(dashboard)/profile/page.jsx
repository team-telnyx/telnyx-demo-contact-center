'use client';

import { useState, useRef, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../../src/store/hooks';
import { setProfile } from '../../../src/features/auth/authSlice';
import { useGetUserDataQuery, useUpdateProfileMutation } from '../../../src/store/api';

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const { username, firstName, lastName, avatarUrl } = useAppSelector((s) => s.auth);
  const { data: userData, refetch } = useGetUserDataQuery(username, { skip: !username });
  const [updateProfile, { isLoading: isSaving }] = useUpdateProfileMutation();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    assignedQueue: '',
  });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  // Sync form with Redux/fetched data
  useEffect(() => {
    setForm({
      firstName: firstName || userData?.firstName || '',
      lastName: lastName || userData?.lastName || '',
      assignedQueue: userData?.assignedQueue || 'General_Queue',
    });
    setAvatarPreview(avatarUrl || userData?.avatar || null);
  }, [firstName, lastName, avatarUrl, userData]);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result);
      setAvatarFile(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    const body = {};
    if (form.firstName) body.firstName = form.firstName;
    if (form.lastName) body.lastName = form.lastName;
    body.assignedQueue = form.assignedQueue || 'General_Queue';
    if (avatarFile) body.avatar = avatarFile;

    try {
      await updateProfile({ username, ...body }).unwrap();
      dispatch(setProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        avatarUrl: avatarPreview,
      }));
      setAvatarFile(null);
      setSuccess('Profile updated successfully');
      refetch();
    } catch (err) {
      setError(err?.data?.error || err?.data || 'Failed to update profile');
    }
  };

  const initials = form.firstName && form.lastName ? `${form.firstName[0]}${form.lastName[0]}`.toUpperCase() : 'AG';

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Profile Settings</h1>

      <div className="space-y-6">
        {/* Avatar Section */}
        <div className="rounded-card border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900 uppercase tracking-wider">Profile Picture</h2>
          <div className="flex items-center gap-6">
            <div
              className="relative h-24 w-24 flex-shrink-0 cursor-pointer overflow-hidden rounded-full border-4 border-telnyx-green/20 transition-all hover:border-telnyx-green/50"
              onClick={() => fileRef.current?.click()}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-telnyx-green text-2xl font-bold text-white">
                  {initials}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-btn bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Change Picture
              </button>
              <p className="mt-1 text-xs text-gray-400">JPG or PNG, max 2MB</p>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleAvatarChange} />
          </div>
        </div>

        {/* Name Section */}
        <div className="rounded-card border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900 uppercase tracking-wider">Personal Info</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">First Name</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full rounded-btn border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Last Name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full rounded-btn border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-500">Assigned Queue</label>
            <input
              type="text"
              value={form.assignedQueue}
              onChange={(e) => setForm({ ...form, assignedQueue: e.target.value })}
              placeholder="General_Queue"
              className="w-full rounded-btn border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green"
            />
            <p className="mt-1 text-[10px] text-gray-400">Queue this agent listens on for auto-routing (e.g. General_Queue, Sales_Queue, Support_Queue)</p>
          </div>
        </div>

        {/* Connection Info (read-only) */}
        <div className="rounded-card border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Connection Info</h2>
          <p className="mb-3 text-xs text-gray-400">Auto-generated when your account was created. These are managed by the system.</p>
          <div className="space-y-2 text-sm">
            {[
              { label: 'SIP Credential Connection', value: userData?.webrtcConnectionId },
              { label: 'Voice App ID', value: userData?.appConnectionId },
              { label: 'Outbound Voice Profile', value: userData?.outboundVoiceProfileId },
              { label: 'Messaging Profile', value: userData?.messagingProfileId },
              { label: 'Assigned Queue', value: userData?.assignedQueue || 'General_Queue', alwaysShow: true },
            ].map((item, i) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <span className="text-gray-500 dark:text-gray-400">{item.label}</span>
                <span className="font-mono text-gray-900 dark:text-white text-xs">
                  {item.value || <span className="text-yellow-500 italic">Not provisioned</span>}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        {error && <div className="rounded-btn bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        {success && <div className="rounded-btn bg-green-50 px-4 py-2 text-sm text-telnyx-green">{success}</div>}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full rounded-btn bg-telnyx-green px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-telnyx-green/90 disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
