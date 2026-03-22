'use client';

import { useState } from 'react';
import { useAppSelector } from '../../../../src/store/hooks';
import {
  useGetAdminUsersQuery,
  useCreateAdminUserMutation,
  useUpdateAdminUserMutation,
  useDeleteAdminUserMutation,
} from '../../../../src/store/api';

function UserModal({ user, onClose, onSave, isSaving }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    username: user?.username || '',
    password: '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    role: user?.role || 'agent',
    assignedQueue: user?.assignedQueue || 'General_Queue',
    routingPriority: user?.routingPriority ?? 10,
    maxCalls: user?.maxCalls ?? 1,
    maxConversations: user?.maxConversations ?? 5,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...form, routingPriority: parseInt(form.routingPriority) || 10, maxCalls: parseInt(form.maxCalls) || 1, maxConversations: parseInt(form.maxConversations) || 5 };
    if (isEdit) {
      const { username, password, ...updateData } = payload;
      onSave({ id: user.id, ...updateData });
    } else {
      onSave(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">{isEdit ? 'Edit User' : 'Add User'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assigned Queue</label>
            <input value={form.assignedQueue} onChange={(e) => setForm({ ...form, assignedQueue: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Routing Priority</label>
            <input type="number" min="1" max="100" value={form.routingPriority} onChange={(e) => setForm({ ...form, routingPriority: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Calls</label>
              <input type="number" min="1" max="10" value={form.maxCalls} onChange={(e) => setForm({ ...form, maxCalls: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Conversations</label>
              <input type="number" min="1" max="50" value={form.maxConversations} onChange={(e) => setForm({ ...form, maxConversations: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button type="submit" disabled={isSaving}
              className="rounded-md bg-telnyx-green px-4 py-2 text-sm font-medium text-white hover:bg-telnyx-green-light disabled:opacity-50">
              {isSaving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UserManagementPage() {
  const { username: currentUsername } = useAppSelector((state) => state.auth);
  const [page, setPage] = useState(1);
  const [modalUser, setModalUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data, isLoading, refetch } = useGetAdminUsersQuery({ page, size: 20 });
  const [createUser, { isLoading: isCreating }] = useCreateAdminUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateAdminUserMutation();
  const [deleteUser] = useDeleteAdminUserMutation();

  const handleSave = async (payload) => {
    try {
      if (payload.id) {
        await updateUser(payload).unwrap();
      } else {
        await createUser(payload).unwrap();
      }
      setShowModal(false);
      setModalUser(null);
      refetch();
    } catch (err) {
      alert(err.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteUser(id).unwrap();
      setDeleteConfirm(null);
      refetch();
    } catch (err) {
      alert(err.data?.error || 'Delete failed');
    }
  };

  const statusColor = (status) => {
    const map = { online: 'bg-green-500', busy: 'bg-red-500', away: 'bg-yellow-400', break: 'bg-blue-400', dnd: 'bg-purple-500', offline: 'bg-gray-400' };
    return map[status] || 'bg-gray-400';
  };

  const roleBadge = (role) => {
    if (role === 'admin') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
        <button onClick={() => { setModalUser(null); setShowModal(true); }}
          className="rounded-lg bg-telnyx-green px-4 py-2.5 font-semibold text-white transition-colors hover:bg-telnyx-green-light">
          Add User
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading users...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Username</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Role</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Queue</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Priority</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.users?.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{user.username}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{user.firstName} {user.lastName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${roleBadge(user.role)}`}>{user.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${statusColor(user.status)}`} />
                      <span className="text-gray-600 dark:text-gray-300">{user.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{user.assignedQueue || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{user.routingPriority}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setModalUser(user); setShowModal(true); }}
                      className="mr-2 text-telnyx-green hover:text-telnyx-green-light font-medium">Edit</button>
                    {user.username !== currentUsername && (
                      <button onClick={() => setDeleteConfirm(user)}
                        className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {data?.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Page {data.page} of {data.totalPages} ({data.total} users)
            </span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-600 dark:text-gray-300">Prev</button>
              <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-600 dark:text-gray-300">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <UserModal
          user={modalUser}
          onClose={() => { setShowModal(false); setModalUser(null); }}
          onSave={handleSave}
          isSaving={isCreating || isUpdating}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete User</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Are you sure you want to delete <strong>{deleteConfirm.username}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm.id)}
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
