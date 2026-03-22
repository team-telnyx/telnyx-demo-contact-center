'use client';

import { useState } from 'react';
import { useAppSelector } from '../../../src/store/hooks';
import {
  useGetMyNumbersQuery,
  useSearchAvailableNumbersQuery,
  usePurchaseNumberMutation,
  useReleaseNumberMutation,
  useAssignNumberMutation,
  useUnassignNumberMutation,
  useGetUserDataQuery,
} from '../../../src/store/api';
import { formatPhoneDisplay } from '../../../src/lib/phone-utils';

export default function NumbersPage() {
  const { username } = useAppSelector((s) => s.auth);
  const { data: userData } = useGetUserDataQuery(username, { skip: !username });
  const appConnectionId = userData?.appConnectionId;

  const [activeTab, setActiveTab] = useState('my-numbers');

  // Search state
  const [searchCountry, setSearchCountry] = useState('US');
  const [searchState, setSearchState] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [doSearch, setDoSearch] = useState(false);

  const { data: myNumbers, isLoading: numbersLoading, error: numbersError, refetch } = useGetMyNumbersQuery({});
  const { data: availableNumbers, isLoading: searchLoading, isFetching: searchFetching } = useSearchAvailableNumbersQuery(
    { country_code: searchCountry, state: searchState || undefined, city: searchCity || undefined },
    { skip: !doSearch }
  );

  const [purchaseNumber, { isLoading: purchasing }] = usePurchaseNumberMutation();
  const [releaseNumber, { isLoading: releasing }] = useReleaseNumberMutation();
  const [assignNumber, { isLoading: assigning }] = useAssignNumberMutation();
  const [unassignNumber, { isLoading: unassigning }] = useUnassignNumberMutation();
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });

  const handlePurchase = async (phoneNumber) => {
    setActionMsg({ type: '', text: '' });
    try {
      await purchaseNumber({ phone_number: phoneNumber }).unwrap();
      setActionMsg({ type: 'success', text: `${formatPhoneDisplay(phoneNumber)} purchased successfully!` });
    } catch (err) {
      setActionMsg({ type: 'error', text: err?.data?.message || 'Failed to purchase number' });
    }
  };

  const handleRelease = async (numberId, phoneNumber) => {
    if (!confirm(`Release ${formatPhoneDisplay(phoneNumber)}? This cannot be undone.`)) return;
    setActionMsg({ type: '', text: '' });
    try {
      await releaseNumber(numberId).unwrap();
      setActionMsg({ type: 'success', text: `${formatPhoneDisplay(phoneNumber)} released.` });
    } catch (err) {
      setActionMsg({ type: 'error', text: err?.data?.message || 'Failed to release number' });
    }
  };

  const handleAssign = async (numberId, phoneNumber) => {
    setActionMsg({ type: '', text: '' });
    try {
      await assignNumber({ numberId }).unwrap();
      setActionMsg({ type: 'success', text: `${formatPhoneDisplay(phoneNumber)} assigned to your Voice App.` });
      refetch();
    } catch (err) {
      setActionMsg({ type: 'error', text: err?.data?.message || 'Failed to assign number' });
    }
  };

  const handleUnassign = async (numberId, phoneNumber) => {
    setActionMsg({ type: '', text: '' });
    try {
      await unassignNumber({ numberId }).unwrap();
      setActionMsg({ type: 'success', text: `${formatPhoneDisplay(phoneNumber)} unassigned from Voice App.` });
      refetch();
    } catch (err) {
      setActionMsg({ type: 'error', text: err?.data?.message || 'Failed to unassign number' });
    }
  };

  const myNumbersList = myNumbers?.data || [];
  const availableList = availableNumbers?.data || [];

  const isAssignedToMe = (num) => num.connection_id === appConnectionId;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Phone Numbers</h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-btn bg-gray-100 dark:bg-gray-800 p-1 w-fit">
        <button
          onClick={() => setActiveTab('my-numbers')}
          className={`rounded-btn px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'my-numbers' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          My Numbers ({myNumbersList.length})
        </button>
        <button
          onClick={() => setActiveTab('purchase')}
          className={`rounded-btn px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'purchase' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Purchase Numbers
        </button>
      </div>

      {actionMsg.text && (
        <div className={`mb-4 rounded-btn px-4 py-2 text-sm ${actionMsg.type === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-50 text-telnyx-green dark:bg-green-900/30 dark:text-green-300'}`}>
          {actionMsg.text}
        </div>
      )}

      {/* My Numbers Tab */}
      {activeTab === 'my-numbers' && (
        <div className="rounded-card border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
          <div className="rounded-t-card bg-gray-950 px-4 py-3">
            <h2 className="text-sm font-semibold text-white">Your Phone Numbers</h2>
          </div>
          {numbersLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-telnyx-green border-t-transparent"></div>
            </div>
          ) : numbersError ? (
            <div className="px-4 py-8 text-center text-sm text-red-400">
              {numbersError?.data?.message || 'Failed to load numbers. Ensure the org API key is configured.'}
            </div>
          ) : myNumbersList.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-gray-400">No phone numbers on the account.</p>
              <button
                onClick={() => setActiveTab('purchase')}
                className="mt-3 rounded-btn bg-telnyx-green px-4 py-2 text-sm font-medium text-white hover:bg-telnyx-green/90"
              >
                Purchase a Number
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-gray-50 dark:bg-gray-900 text-xs uppercase text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Phone Number</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Connection</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {myNumbersList.map((num) => {
                    const assigned = isAssignedToMe(num);
                    return (
                      <tr key={num.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900 dark:text-white">{formatPhoneDisplay(num.phone_number)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            num.status === 'active' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${num.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                            {num.status || 'unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{num.phone_number_type || '-'}</td>
                        <td className="px-4 py-3">
                          {assigned ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-telnyx-green/10 px-2 py-0.5 text-xs font-medium text-telnyx-green">
                              <span className="h-1.5 w-1.5 rounded-full bg-telnyx-green" />
                              My Voice App
                            </span>
                          ) : num.connection_name ? (
                            <span className="text-xs text-gray-500 dark:text-gray-400">{num.connection_name}</span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {assigned ? (
                              <button
                                onClick={() => handleUnassign(num.id, num.phone_number)}
                                disabled={unassigning}
                                className="rounded-btn border border-yellow-300 px-2.5 py-1 text-xs font-medium text-yellow-600 hover:bg-yellow-50 disabled:opacity-50 dark:border-yellow-600 dark:text-yellow-400 dark:hover:bg-yellow-900/20"
                              >
                                Unassign
                              </button>
                            ) : (
                              <button
                                onClick={() => handleAssign(num.id, num.phone_number)}
                                disabled={assigning || !appConnectionId}
                                className="rounded-btn bg-telnyx-green px-2.5 py-1 text-xs font-semibold text-white hover:bg-telnyx-green/90 disabled:opacity-50"
                                title={!appConnectionId ? 'Voice App not provisioned' : 'Assign to your Voice App'}
                              >
                                Assign
                              </button>
                            )}
                            <button
                              onClick={() => handleRelease(num.id, num.phone_number)}
                              disabled={releasing}
                              className="rounded-btn border border-red-200 px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:hover:bg-red-900/20"
                            >
                              Release
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Purchase Tab */}
      {activeTab === 'purchase' && (
        <div className="space-y-4">
          <div className="rounded-card border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Search Available Numbers</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Country</label>
                <select
                  value={searchCountry}
                  onChange={(e) => setSearchCountry(e.target.value)}
                  className="rounded-btn border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green"
                >
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="GB">United Kingdom</option>
                  <option value="AU">Australia</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">State/Region</label>
                <input
                  type="text"
                  value={searchState}
                  onChange={(e) => setSearchState(e.target.value)}
                  placeholder="e.g. CA"
                  className="w-24 rounded-btn border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">City</label>
                <input
                  type="text"
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                  placeholder="e.g. Los Angeles"
                  className="w-40 rounded-btn border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green"
                />
              </div>
              <button
                onClick={() => setDoSearch(true)}
                className="rounded-btn bg-telnyx-green px-5 py-2 text-sm font-medium text-white hover:bg-telnyx-green/90"
              >
                Search
              </button>
            </div>
          </div>

          {doSearch && (
            <div className="rounded-card border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
              <div className="rounded-t-card bg-gray-950 px-4 py-3">
                <h2 className="text-sm font-semibold text-white">Available Numbers</h2>
              </div>
              {searchLoading || searchFetching ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-telnyx-green border-t-transparent"></div>
                </div>
              ) : availableList.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  No numbers found. Try different search criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-gray-50 dark:bg-gray-900 text-xs uppercase text-gray-500 dark:text-gray-400">
                      <tr>
                        <th className="px-4 py-3">Phone Number</th>
                        <th className="px-4 py-3">Region</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Features</th>
                        <th className="px-4 py-3">Cost</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {availableList.map((num, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900 dark:text-white">{formatPhoneDisplay(num.phone_number)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{num.region_information?.[0]?.region_name || '-'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{num.phone_number_type || '-'}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {num.features?.map((f) => (
                                <span key={f.name} className="rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-600 dark:text-gray-300">
                                  {f.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                            {num.cost_information?.monthly_cost ? `$${num.cost_information.monthly_cost}/mo` : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handlePurchase(num.phone_number)}
                              disabled={purchasing}
                              className="rounded-btn bg-telnyx-green px-3 py-1 text-xs font-semibold text-white hover:bg-telnyx-green/90 disabled:opacity-50"
                            >
                              {purchasing ? '...' : 'Buy'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
