import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { StudentsPage } from './components/StudentsPage';
import { PaymentsPage } from './components/PaymentsPage';
import { ProfilePage } from './components/ProfilePage';
import { RoleSelector } from './components/RoleSelector';
import type { User } from './types';

// Create a shared state for students that can be updated across components
export const globalMockStudents = [
  { id: '1', name: 'Alice Doe', class: 'Primary 6A', session: '2024/2025', term: 'First Term', parent_id: '1', payment_status: 'unpaid', total_fees: 120000, amount_paid: 0, created_at: '' },
  { id: '2', name: 'Bob Doe', class: 'Primary 5B', session: '2024/2025', term: 'First Term', parent_id: '1', payment_status: 'unpaid', total_fees: 120000, amount_paid: 0, created_at: '' },
  { id: '3', name: 'Charlie Smith', class: 'JSS 2C', session: '2024/2025', term: 'First Term', user_id: '3', payment_status: 'unpaid', total_fees: 180000, amount_paid: 0, created_at: '' },
];

// Global payments array
export const globalMockPayments: any[] = [];

// Functions to update global state
export const addGlobalStudent = (newStudent: any) => {
  globalMockStudents.push(newStudent);
};

export const updateGlobalStudent = (studentId: string, updates: any) => {
  const index = globalMockStudents.findIndex(s => s.id === studentId);
  if (index !== -1) {
    globalMockStudents[index] = { ...globalMockStudents[index], ...updates };
  }
};

export const addGlobalPayment = (payment: any) => {
  globalMockPayments.push(payment);
};

function App() {
  const [currentRole, setCurrentRole] = useState<'parent' | 'student' | 'admin'>('parent');
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  // Mock users for different roles
  const mockUsers: Record<string, User> = {
    parent: {
      id: '1',
      email: 'parent@demo.com',
      role: 'parent',
      full_name: 'John Doe',
      phone: '+234 801 234 5678',
      created_at: new Date().toISOString()
    },
    student: {
      id: '3',
      email: 'student@demo.com',
      role: 'student',
      full_name: 'Charlie Smith',
      phone: '+234 802 345 6789',
      created_at: new Date().toISOString()
    },
    admin: {
      id: '4',
      email: 'admin@demo.com',
      role: 'admin',
      full_name: 'Admin User',
      phone: '+234 803 456 7890',
      created_at: new Date().toISOString()
    }
  };

  const currentUser = mockUsers[currentRole];

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'students':
        return <StudentsPage user={currentUser} onStudentAdded={() => setRefreshKey(prev => prev + 1)} />;
      case 'payments':
        return <PaymentsPage user={currentUser} />;
      case 'profile':
        return <ProfilePage user={currentUser} />;
      default:
        return <Dashboard user={currentUser} key={refreshKey} />;
    }
  };

  return (
    <Layout user={currentUser} currentPage={currentPage} onNavigate={setCurrentPage}>
      <RoleSelector currentRole={currentRole} onRoleChange={setCurrentRole} />
      {renderCurrentPage()}
    </Layout>
  );
}

export default App;