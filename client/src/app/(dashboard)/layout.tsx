'use client';

import React, { ReactNode } from 'react';
import Dashboard from '@/components/Dashboard';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ProtectedRoute>
      <Dashboard>
        {children}
      </Dashboard>
    </ProtectedRoute>
  );
}
