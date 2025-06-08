import React from 'react';
import { Trash2 } from 'lucide-react'; // Import a trash icon

const DocumentList = ({ documents, onDeleteDocument, selectedDocumentIds, onToggleDocumentSelection }) => {
  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-inner">
      <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Uploaded Documents</h3>
      {documents.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">No documents uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedDocumentIds.includes(doc.id)}
                  onChange={() => onToggleDocumentSelection(doc.id)}
                  className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out dark:text-blue-500 dark:bg-gray-900 dark:border-gray-600"
                />
                <span className="text-sm text-gray-800 dark:text-gray-200 truncate" title={doc.name}>
                  {doc.name}
                </span>
              </div>
              <button
                onClick={() => onDeleteDocument(doc.id)}
                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-600 transition-colors"
                aria-label={`Delete document ${doc.name}`}
              >
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DocumentList;