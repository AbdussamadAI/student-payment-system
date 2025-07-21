import React from 'react';
import { User, GraduationCap, Shield } from 'lucide-react';

interface RoleSelectorProps {
  currentRole: 'parent' | 'student' | 'admin';
  onRoleChange: (role: 'parent' | 'student' | 'admin') => void;
}

export function RoleSelector({ currentRole, onRoleChange }: RoleSelectorProps) {
  const roles = [
    {
      id: 'parent' as const,
      name: 'Parent',
      icon: User,
      description: 'Manage multiple children\'s payments',
      color: 'blue'
    },
    {
      id: 'student' as const,
      name: 'Student',
      icon: GraduationCap,
      description: 'View and pay your own fees',
      color: 'green'
    },
    {
      id: 'admin' as const,
      name: 'Admin',
      icon: Shield,
      description: 'Monitor all school payments',
      color: 'purple'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Demo Mode - Select User Role</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {roles.map((role) => (
          <button
            key={role.id}
            onClick={() => onRoleChange(role.id)}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              currentRole === role.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center space-x-3 mb-2">
              <div className={`p-2 rounded-lg ${
                currentRole === role.id
                  ? 'bg-blue-100'
                  : 'bg-gray-100'
              }`}>
                <role.icon className={`w-5 h-5 ${
                  currentRole === role.id
                    ? 'text-blue-600'
                    : 'text-gray-600'
                }`} />
              </div>
              <h3 className={`font-medium ${
                currentRole === role.id
                  ? 'text-blue-900'
                  : 'text-gray-900'
              }`}>
                {role.name}
              </h3>
            </div>
            <p className={`text-sm ${
              currentRole === role.id
                ? 'text-blue-700'
                : 'text-gray-600'
            }`}>
              {role.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}