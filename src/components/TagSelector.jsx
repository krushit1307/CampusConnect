import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

export default function TagSelector({ ontologyTree, selectedTagId, onSelectTag }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [flattenedTags, setFlattenedTags] = useState([]);

  useEffect(() => {
    // Helper to flatten tree for quick searching if needed
    const flatten = (nodes, parentPath = '') => {
      let list = [];
      nodes.forEach((node) => {
        const currentPath = parentPath ? `${parentPath} > ${node.name}` : node.name;
        list.push({ ...node, path: currentPath });
        if (node.children) {
          list = list.concat(flatten(node.children, currentPath));
        }
      });
      return list;
    };
    setFlattenedTags(flatten(ontologyTree));
  }, [ontologyTree]);

  const filteredTags = flattenedTags.filter((t) =>
    t.path.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="tag-selector-container" style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem' }}>
        Event Tag Ontology
      </label>
      <input
        type="text"
        placeholder="Search hierarchy (e.g. React, Technology)..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
      />
      <div 
        className="tag-tree-list" 
        style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', background: '#fff' }}
      >
        {filteredTags.map((tag) => (
          <div
            key={tag.id}
            onClick={() => onSelectTag(tag.id)}
            style={{
              padding: '0.5rem 0.75rem',
              cursor: 'pointer',
              background: selectedTagId === tag.id ? '#e0f2fe' : 'transparent',
              borderBottom: '1px solid #f0f0f0',
              fontSize: '0.9rem'
            }}
          >
            {tag.path}
          </div>
        ))}
      </div>
    </div>
  );
}

TagSelector.propTypes = {
  ontologyTree: PropTypes.array.isRequired,
  selectedTagId: PropTypes.string,
  onSelectTag: PropTypes.func.isRequired,
};
