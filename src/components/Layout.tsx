import React from 'react';
import type { User } from '../types';
import { LogOut, GraduationCap, User as UserIcon, CreditCard, BarChart3 } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  currentPage?: string;
  onNavigate?: (page: string) => void;
}

export function Layout({ children, user, currentPage = 'dashboard', onNavigate }: LayoutProps) {
  const handleSignOut = () => {
    // Demo mode - just reload the page
    window.location.reload();
  };

  const navigationItems = [
    { label: 'Dashboard', icon: BarChart3, path: 'dashboard' },
    { label: 'Students', icon: GraduationCap, path: 'students' },
    { label: 'Payments', icon: CreditCard, path: 'payments' },
    { label: 'Profile', icon: UserIcon, path: 'profile' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-lg">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">SchoolPay</h1>
                <p className="text-xs text-gray-500">Payment System</p>
              </div>
            </div>

            {user && (
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                  <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation */}
      {user && (
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8 overflow-x-auto">
              {navigationItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => onNavigate?.(item.path)}
                  className={`flex items-center space-x-2 py-4 px-2 border-b-2 transition-colors whitespace-nowrap ${
                    currentPage === item.path
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-blue-600 hover:border-blue-300'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}