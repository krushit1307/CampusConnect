import React, { useState } from 'react';

const AVAILABLE_SCOPES = [
  { id: 'finance:write', label: 'Modify Bank Account / Withdraw Funds' },
  { id: 'finance:read', label: 'View Financial Ledgers' },
  { id: 'events:write', label: 'Create and Delete Events' },
  { id: 'members:write', label: 'Manage Member Roles' },
  { id: 'constitution:write', label: 'Edit Club Constitution' }
];

export function RoleCustomizer({ role, onSave }) {
  const [permissions, setPermissions] = useState(role?.permissions || []);

  const toggleScope = (scopeId) => {
    setPermissions(prev => 
      prev.includes(scopeId) ? prev.filter(s => s !== scopeId) : [...prev, scopeId]
    );
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-6">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          Executive Role Management
        </span>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-1">Configure Scopes for: {role.title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Select granular access scopes to securely delegate club responsibilities.</p>
      </div>

      <div className="space-y-3">
        {AVAILABLE_SCOPES.map(scope => {
          const isChecked = permissions.includes(scope.id);
          return (
            <label
              key={scope.id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                isChecked 
                  ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-500' 
                  : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{scope.label}</span>
                <span className="block text-xs font-mono text-gray-500">{scope.id}</span>
              </div>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleScope(scope.id)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
            </label>
          );
        })}
      </div>

      <button
        onClick={() => onSave(role.id, permissions)}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
      >
        Save Role Permissions
      </button>
    </div>
  );
}
