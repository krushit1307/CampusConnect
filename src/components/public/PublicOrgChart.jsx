import React, { useState } from 'react';

export default function PublicOrgChart({ treeData }) {
  const [selectedUser, setSelectedUser] = useState(null);

  return (
    <div className="py-8 flex flex-col items-center overflow-x-auto">
      <h3 className="text-xl font-bold mb-6 text-slate-800">Leadership Structure</h3>
      <div className="flex justify-center space-x-4">
        {treeData.map((node) => (
          <TreeNode key={node.id} node={node} onSelect={setSelectedUser} />
        ))}
      </div>

      {selectedUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full text-center relative">
            <button 
              onClick={() => setSelectedUser(null)} 
              className="absolute top-2 right-3 text-gray-400 hover:text-gray-600 font-bold"
            >
              ✕
            </button>
            <img 
              src={selectedUser.user.photo_url || "/default-avatar.png"} 
              alt={selectedUser.user.name} 
              className="w-24 h-24 mx-auto rounded-full object-cover mb-4 border-2 border-indigo-500"
            />
            <h4 className="text-lg font-bold text-slate-900">{selectedUser.user.name}</h4>
            <p className="text-sm font-medium text-indigo-600 mb-4">{selectedUser.title}</p>
            <a 
              href={`mailto:${selectedUser.user.email}`} 
              className="block w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
            >
              Contact
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function TreeNode({ node, onSelect }) {
  return (
    <div className="flex flex-col items-center mx-4">
      <div 
        onClick={() => onSelect(node)}
        className="cursor-pointer bg-white border border-slate-200 shadow-sm hover:shadow-md p-4 rounded-xl text-center min-w-[160px] transition"
      >
        <p className="text-xs uppercase tracking-wider text-indigo-600 font-semibold mb-1">{node.title}</p>
        <p className="text-sm font-bold text-slate-800">{node.user.name}</p>
      </div>

      {node.children && node.children.length > 0 && (
        <>
          <div className="h-6 w-px bg-slate-300"></div>
          <div className="flex space-x-4 relative pt-2 border-t border-slate-300">
            {node.children.map((child) => (
              <TreeNode key={child.id} node={child} onSelect={onSelect} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
