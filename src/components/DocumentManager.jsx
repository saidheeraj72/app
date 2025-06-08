import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './DocumentManager.css';

const DocumentManager = ({ 
  onDocumentSelect, 
  selectedDocumentIds, 
  onClose,
  isAdmin 
}) => {
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderPath, setFolderPath] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  
  // State for multiple selection and deletion
  const [selectedForDeletion, setSelectedForDeletion] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  useEffect(() => {
    fetchDocuments();
  }, [currentFolder]);

  // Set folder upload attributes when component mounts
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
    }
  }, []);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`http://localhost:8000/documents${currentFolder ? `?folder=${currentFolder}` : ''}`);
      if (response.data.folders && response.data.documents) {
        setDocuments(response.data.documents || []);
        setFolders(response.data.folders || []);
      } else {
        setDocuments(response.data || []);
        setFolders([]);
      }
      // Clear selection when changing folders
      setSelectedForDeletion([]);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setDocuments([]);
      setFolders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (files, targetFolder = currentFolder) => {
    console.log('=== UPLOAD DEBUG ===');
    console.log('Target folder:', targetFolder);
    console.log('Current folder:', currentFolder);
    console.log('Files to upload:', files.length);

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];

    const validFiles = Array.from(files).filter(file => 
      allowedTypes.includes(file.type) || 
      file.name.toLowerCase().endsWith('.pdf') ||
      file.name.toLowerCase().endsWith('.doc') ||
      file.name.toLowerCase().endsWith('.docx') ||
      file.name.toLowerCase().endsWith('.txt')
    );

    if (validFiles.length === 0) {
      alert('Please select PDF, Word documents, or text files only.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Uploading files...');

    let successCount = 0;
    let skippedCount = 0;
    const skippedFiles = [];

    try {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        console.log(`Uploading file ${i + 1}/${validFiles.length}: ${file.name}`);
        console.log('Using folder_id:', targetFolder);
        
        const formData = new FormData();
        formData.append('file', file);
        
        // FIXED: Always add folder_id to FormData, even if it's null/empty
        if (targetFolder) {
          formData.append('folder_id', String(targetFolder));
          console.log('Added folder_id to formData:', String(targetFolder));
        } else {
          // For root uploads, we can either not add folder_id or add an empty string
          // The backend now properly handles both cases
          console.log('No folder_id added - uploading to root');
        }

        // Log formData contents
        for (let pair of formData.entries()) {
          console.log('FormData:', pair[0], pair[1]);
        }

        try {
          const response = await axios.post('http://localhost:8000/upload-document', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
              const fileProgress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              const totalProgress = Math.round(((i * 100) + fileProgress) / validFiles.length);
              setUploadProgress(totalProgress);
            },
          });
          console.log(`Upload response for ${file.name}:`, response.data);
          successCount++;
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          if (error.response?.data?.detail?.includes('No text content')) {
            skippedCount++;
            skippedFiles.push(file.name);
          } else {
            throw error;
          }
        }
      }

      await fetchDocuments();
      
      let message = `Successfully uploaded ${successCount} document(s)!`;
      if (skippedCount > 0) {
        message += `\n\nSkipped ${skippedCount} file(s) with no text content:\n${skippedFiles.join('\n')}`;
      }
      alert(message);
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Failed to upload documents: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFolderUpload = async (files) => {
    if (!files || files.length === 0) return;

    console.log('=== FOLDER UPLOAD DEBUG ===');
    console.log('Total files in folder upload:', files.length);

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Processing folder structure...');

    try {
      // Group files by their directory structure
      const folderStructure = {};
      
      Array.from(files).forEach(file => {
        if (file.webkitRelativePath) {
          const pathParts = file.webkitRelativePath.split('/');
          const fileName = pathParts[pathParts.length - 1];
          const folderPath = pathParts.slice(0, -1);
          
          console.log('Processing file:', file.webkitRelativePath);
          console.log('Path parts:', pathParts);
          console.log('Folder path:', folderPath);
          
          // Only include valid files
          if (isValidFile(file)) {
            let currentLevel = folderStructure;
            
            // Build nested folder structure
            folderPath.forEach((folderName, index) => {
              if (!currentLevel[folderName]) {
                currentLevel[folderName] = {
                  files: [],
                  subfolders: {},
                  path: pathParts.slice(0, index + 1).join('/'),
                  folderId: null
                };
              }
              if (index === folderPath.length - 1) {
                currentLevel[folderName].files.push(file);
              }
              currentLevel = currentLevel[folderName].subfolders;
            });
          }
        }
      });

      console.log('Final folder structure:', JSON.stringify(folderStructure, null, 2));

      // Upload folder structure
      const result = await uploadFolderStructure(folderStructure, currentFolder);
      
      await fetchDocuments();
      
      let message = 'Folder uploaded successfully!';
      if (result.skippedCount > 0) {
        message += `\n\nSkipped ${result.skippedCount} file(s) with no text content:\n${result.skippedFiles.join('\n')}`;
      }
      alert(message);
    } catch (error) {
      console.error('Folder upload error:', error);
      alert(`Failed to upload folder: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const uploadFolderStructure = async (structure, parentFolderId = null) => {
    console.log('=== UPLOADING FOLDER STRUCTURE ===');
    console.log('Parent folder ID:', parentFolderId);
    console.log('Structure to upload:', structure);

    const folderNames = Object.keys(structure);
    const totalFolders = folderNames.length;
    let processedFolders = 0;
    let totalSkippedCount = 0;
    let totalSkippedFiles = [];

    for (const [folderName, content] of Object.entries(structure)) {
      try {
        setUploadStatus(`Creating folder: ${folderName}`);
        console.log(`\n--- Creating folder: ${folderName} ---`);
        console.log('Parent folder ID:', parentFolderId);
        
        // Create folder
        const folderPayload = {
          name: folderName,
          parent_id: parentFolderId
        };
        console.log('Folder creation payload:', folderPayload);
        
        const folderResponse = await axios.post('http://localhost:8000/create-folder', folderPayload);
        console.log('Folder creation response:', folderResponse.data);
        
        const newFolderId = folderResponse.data.folder_id;
        content.folderId = newFolderId;
        
        console.log(`Folder "${folderName}" created with ID: ${newFolderId}`);
        
        // Wait a bit to ensure folder is fully created
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Upload files in this folder one by one
        if (content.files.length > 0) {
          setUploadStatus(`Uploading ${content.files.length} files to ${folderName}...`);
          console.log(`\n--- Uploading ${content.files.length} files to folder "${folderName}" (ID: ${newFolderId}) ---`);
          
          let successCount = 0;
          let skippedCount = 0;
          const skippedFiles = [];
          
          for (let i = 0; i < content.files.length; i++) {
            const file = content.files[i];
            console.log(`\nUploading file ${i + 1}/${content.files.length}: ${file.name}`);
            console.log('Target folder ID:', newFolderId);
            
            const formData = new FormData();
            formData.append('file', file);
            // FIXED: Always add folder_id, even if it's the root
            formData.append('folder_id', String(newFolderId));

            // Log formData contents
            console.log('FormData contents:');
            for (let pair of formData.entries()) {
              console.log('  ', pair[0], ':', pair[1] instanceof File ? `File: ${pair[1].name}` : pair[1]);
            }

            try {
              const uploadResponse = await axios.post('http://localhost:8000/upload-document', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                  const fileProgress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                  const folderProgress = Math.round(((i * 100) + fileProgress) / content.files.length);
                  const totalProgress = Math.round(((processedFolders * 100) + folderProgress) / totalFolders);
                  setUploadProgress(totalProgress);
                },
              });
              console.log(`✅ Successfully uploaded ${file.name}:`, uploadResponse.data);
              successCount++;
              
              // Small delay between uploads
              await new Promise(resolve => setTimeout(resolve, 100));
              
            } catch (error) {
              console.error(`❌ Error uploading ${file.name}:`, error);
              console.error('Error response:', error.response?.data);
              
              if (error.response?.data?.detail?.includes('No text content')) {
                skippedCount++;
                skippedFiles.push(`${folderName}/${file.name}`);
                console.log(`⚠️ Skipped ${file.name} - no text content`);
              } else {
                console.error(`Failed to upload ${file.name}:`, error.response?.data?.detail || error.message);
                skippedCount++;
                skippedFiles.push(`${folderName}/${file.name} (Error: ${error.response?.data?.detail || error.message})`);
              }
            }
          }
          
          console.log(`\n📊 Folder "${folderName}" summary: ${successCount} uploaded, ${skippedCount} skipped`);
          totalSkippedCount += skippedCount;
          totalSkippedFiles = totalSkippedFiles.concat(skippedFiles);
        }
        
        // Recursively upload subfolders
        if (Object.keys(content.subfolders).length > 0) {
          console.log(`\n🔄 Processing subfolders of "${folderName}"`);
          const subResult = await uploadFolderStructure(content.subfolders, newFolderId);
          totalSkippedCount += subResult.skippedCount;
          totalSkippedFiles = totalSkippedFiles.concat(subResult.skippedFiles);
        }

        processedFolders++;
        
      } catch (error) {
        console.error(`❌ Error processing folder ${folderName}:`, error);
        console.error('Error details:', error.response?.data);
        processedFolders++;
      }
    }
    
    return {
      skippedCount: totalSkippedCount,
      skippedFiles: totalSkippedFiles
    };
  };

  const isValidFile = (file) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    const fileName = file.name.toLowerCase();
    
    return allowedTypes.includes(file.type) || 
           allowedExtensions.some(ext => fileName.endsWith(ext));
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      console.log('Creating folder:', newFolderName.trim(), 'in parent:', currentFolder);
      const response = await axios.post('http://localhost:8000/create-folder', {
        name: newFolderName.trim(),
        parent_id: currentFolder
      });
      console.log('Folder created:', response.data);
      
      setNewFolderName('');
      setShowCreateFolder(false);
      await fetchDocuments();
    } catch (error) {
      console.error('Folder creation error:', error);
      alert(`Failed to create folder: ${error.response?.data?.detail || error.message}`);
    }
  };

  // Rest of the component remains the same...
  const deleteDocument = async (docId) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await axios.delete(`http://localhost:8000/documents/${docId}`);
      await fetchDocuments();
    } catch (error) {
      alert(`Failed to delete document: ${error.response?.data?.detail || error.message}`);
    }
  };

  // Multiple document deletion
  const deleteSelectedDocuments = async () => {
    if (selectedForDeletion.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedForDeletion.length} document(s)?`)) return;

    setIsDeleting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const docId of selectedForDeletion) {
        try {
          await axios.delete(`http://localhost:8000/documents/${docId}`);
          successCount++;
        } catch (error) {
          console.error(`Failed to delete document ${docId}:`, error);
          failCount++;
        }
      }

      setSelectedForDeletion([]);
      await fetchDocuments();
      
      if (failCount === 0) {
        alert(`Successfully deleted ${successCount} document(s)!`);
      } else {
        alert(`Deleted ${successCount} document(s). Failed to delete ${failCount} document(s).`);
      }
    } catch (error) {
      alert('Failed to delete documents');
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteFolder = async (folderId) => {
    if (!confirm('Are you sure you want to delete this folder and all its contents?')) return;

    try {
      await axios.delete(`http://localhost:8000/folders/${folderId}`);
      await fetchDocuments();
    } catch (error) {
      alert(`Failed to delete folder: ${error.response?.data?.detail || error.message}`);
    }
  };

  // Toggle selection for deletion
  const toggleDocumentForDeletion = (docId) => {
    setSelectedForDeletion(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  // Select all documents
  const selectAllForDeletion = () => {
    if (selectedForDeletion.length === documents.length) {
      setSelectedForDeletion([]);
    } else {
      setSelectedForDeletion(documents.map(doc => doc.id));
    }
  };

  const navigateToFolder = async (folderId, folderName) => {
    console.log('Navigating to folder:', folderId, folderName);
    setCurrentFolder(folderId);
    if (folderId) {
      setFolderPath([...folderPath, { id: folderId, name: folderName }]);
    }
  };

  const navigateToRoot = () => {
    console.log('Navigating to root');
    setCurrentFolder(null);
    setFolderPath([]);
  };

  const navigateToBreadcrumb = (index) => {
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    setCurrentFolder(newPath[newPath.length - 1]?.id || null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const items = Array.from(e.dataTransfer.items);
    
    // Check if any items are directories
    const hasDirectories = items.some(item => item.webkitGetAsEntry && item.webkitGetAsEntry().isDirectory);
    
    if (hasDirectories) {
      // Handle folder drop
      handleFolderDrop(items);
    } else {
      // Handle file drop
      const validFiles = files.filter(file => isValidFile(file));
      if (validFiles.length > 0) {
        handleFileUpload(validFiles);
      } else {
        alert('Please drop valid document files (PDF, Word, TXT) only.');
      }
    }
  };

  const handleFolderDrop = async (items) => {
    const allFiles = [];
    
    const processEntry = (entry, path = '') => {
      return new Promise((resolve) => {
        if (entry.isFile) {
          entry.file(file => {
            file.webkitRelativePath = path + file.name;
            allFiles.push(file);
            resolve();
          });
        } else if (entry.isDirectory) {
          const dirReader = entry.createReader();
          dirReader.readEntries(entries => {
            const promises = entries.map(childEntry => 
              processEntry(childEntry, path + entry.name + '/')
            );
            Promise.all(promises).then(() => resolve());
          });
        } else {
          resolve();
        }
      });
    };

    const promises = items.map(item => {
      const entry = item.webkitGetAsEntry();
      return entry ? processEntry(entry) : Promise.resolve();
    });

    await Promise.all(promises);
    
    if (allFiles.length > 0) {
      await handleFolderUpload(allFiles);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(false);
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('text')) return '📄';
    return '📁';
  };

  return (
    <div className="document-manager">
      <div className="document-manager-header">
        <div className="header-title">
          <h2>📁 Document Manager</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search documents and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        {/* Breadcrumb Navigation */}
        <div className="breadcrumb">
          <button 
            className={`breadcrumb-item ${!currentFolder ? 'active' : ''}`}
            onClick={navigateToRoot}
          >
            📁 Root
          </button>
          {folderPath.map((folder, index) => (
            <React.Fragment key={folder.id}>
              <span className="breadcrumb-separator">{'>'}</span>
              <button 
                className={`breadcrumb-item ${index === folderPath.length - 1 ? 'active' : ''}`}
                onClick={() => navigateToBreadcrumb(index)}
              >
                📁 {folder.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {isAdmin && (
        <div className="upload-controls">
          <div className="upload-buttons">
            <button
              className="upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              📄 Upload Files
            </button>

            <button
              className="folder-upload-btn"
              onClick={() => folderInputRef.current?.click()}
              disabled={isUploading}
            >
              📁 Upload Folder
            </button>

            <button
              className="create-folder-btn"
              onClick={() => setShowCreateFolder(true)}
              disabled={isUploading}
            >
              📁 Create Folder
            </button>

            {/* Multiple deletion controls */}
            {documents.length > 0 && (
              <>
                <button
                  className="select-all-btn"
                  onClick={selectAllForDeletion}
                  disabled={isUploading || isDeleting}
                >
                  {selectedForDeletion.length === documents.length ? '☑️ Deselect All' : '☑️ Select All'}
                </button>

                {selectedForDeletion.length > 0 && (
                  <button
                    className="delete-selected-btn"
                    onClick={deleteSelectedDocuments}
                    disabled={isUploading || isDeleting}
                  >
                    {isDeleting ? '🗑️ Deleting...' : `🗑️ Delete Selected (${selectedForDeletion.length})`}
                  </button>
                )}
              </>
            )}
          </div>

          {showCreateFolder && (
            <div className="create-folder-form">
              <input
                type="text"
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && createFolder()}
                className="folder-name-input"
                autoFocus
              />
              <button onClick={createFolder} className="create-btn">Create</button>
              <button onClick={() => setShowCreateFolder(false)} className="cancel-btn">Cancel</button>
            </div>
          )}

          {isUploading && (
            <div className="upload-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
              </div>
              <div className="upload-status">
                <span>{uploadStatus}</span>
                <span>{uploadProgress}%</span>
              </div>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.txt"
            multiple
            onChange={(e) => handleFileUpload(e.target.files)}
          />
          
          <input
            type="file"
            ref={folderInputRef}
            style={{ display: 'none' }}
            multiple
            onChange={(e) => handleFolderUpload(e.target.files)}
          />
        </div>
      )}

      <div 
        className={`content-area ${dragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isLoading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading documents...</p>
          </div>
        ) : (
          <div className="items-list">
            {/* Folders */}
            {filteredFolders.map(folder => (
              <div key={folder.id} className="folder-item">
                <div 
                  className="folder-header"
                  onDoubleClick={() => navigateToFolder(folder.id, folder.name)}
                >
                  <span className="folder-icon">📁</span>
                  <span className="folder-name">{folder.name}</span>
                  <span className="item-count">({folder.item_count || 0} items)</span>
                  {isAdmin && (
                    <div className="folder-actions">
                      <button
                        className="action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToFolder(folder.id, folder.name);
                        }}
                        title="Open folder"
                      >
                        📂
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFolder(folder.id);
                        }}
                        title="Delete folder"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Documents */}
            {filteredDocuments.map(doc => (
              <div key={doc.id} className="document-item">
                <div className="doc-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedDocumentIds.includes(doc.id)}
                    onChange={() => onDocumentSelect(doc.id)}
                    className="document-checkbox"
                  />
                </div>

                {/* Deletion checkbox - only for admins */}
                {isAdmin && (
                  <div className="doc-delete-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedForDeletion.includes(doc.id)}
                      onChange={() => toggleDocumentForDeletion(doc.id)}
                      className="delete-checkbox"
                      title="Select for deletion"
                    />
                  </div>
                )}
                
                <div className="doc-info">
                  <div className="doc-header">
                    <span className="doc-icon">{getFileIcon(doc.type)}</span>
                    <span className="doc-name" title={doc.name}>{doc.name}</span>
                  </div>
                  <div className="doc-details">
                    <small>{formatFileSize(doc.size)}</small>
                    <small>Modified: {new Date(doc.upload_date).toLocaleDateString()}</small>
                    <small>Type: {doc.type}</small>
                    {doc.folder_path && <small>Path: {doc.folder_path}</small>}
                  </div>
                </div>

                {isAdmin && (
                  <div className="doc-actions">
                    <button
                      className="action-btn delete-btn"
                      onClick={() => deleteDocument(doc.id)}
                      title="Delete document"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            ))}

            {filteredDocuments.length === 0 && filteredFolders.length === 0 && !isLoading && (
              <div className="no-items">
                {searchQuery ? (
                  <>
                    <p>No documents found</p>
                    <small>Try adjusting your search query</small>
                  </>
                ) : (
                  <>
                    <p>{currentFolder ? 'This folder is empty' : 'No documents yet'}</p>
                    {isAdmin && (
                      <small>Upload documents or folders to get started</small>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {dragOver && (
        <div className="drag-overlay">
          <div className="drag-message">
            <span className="drag-icon">📁</span>
            <p>Drop files or folders here to upload</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentManager;
