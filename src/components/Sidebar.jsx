// src/components/Sidebar.jsx
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import DocumentManager from './DocumentManager';
import './Sidebar.css';

const Sidebar = ({
  currentView,
  setCurrentView,
  sidebarSection,
  setSidebarSection,
  setMessages,
  setSelectedModel,
  setCurrentSessionId,
  currentSessionId,
  selectedDocumentIds,
  setSelectedDocumentIds,
  collapsed,
  setCollapsed,
  width,
  setWidth,
  isMobile
}) => {
  const { user, logout, isAdmin } = useAuth();
  const [chatHistory, setChatHistory] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showDocumentManager, setShowDocumentManager] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const sidebarRef = useRef(null);
  const dropdownRef = useRef(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Drag functionality
  const handleMouseDown = (e) => {
    if (collapsed || isMobile) return;
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = width;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartX.current;
    const newWidth = Math.max(200, Math.min(500, dragStartWidth.current + deltaX));
    setWidth(newWidth);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    const fetchChatHistory = async () => {
      setIsLoadingChats(true);
      try {
        const response = await axios.get('http://localhost:8000/sessions');
        setChatHistory(response.data);
      } catch (error) {
        console.error('Error fetching chat history:', error);
      } finally {
        setIsLoadingChats(false);
      }
    };

    fetchChatHistory();
  }, [currentSessionId]);

  useEffect(() => {
    fetchDocuments();
  }, [sidebarSection]);

  const fetchDocuments = async () => {
    setIsLoadingDocs(true);
    try {
      const response = await axios.get('http://localhost:8000/documents');
      if (response.data.documents) {
        setDocuments(response.data.documents);
      } else {
        setDocuments(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      setDocuments([]);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleNewChat = () => {
    setCurrentView('chat');
    setSidebarSection('chats');
    setMessages([]);
    setCurrentSessionId(null);
    setSelectedModel('llama3-70b-8192');
    if (isMobile) setCollapsed(true);
  };

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this chat? This will also delete all personal documents uploaded in this chat.')) {
      return;
    }

    try {
      await axios.delete(`http://localhost:8000/sessions/${sessionId}`);
      setChatHistory((prev) => prev.filter((session) => session.id !== sessionId));

      if (currentSessionId === sessionId) {
        setMessages([]);
        setCurrentSessionId(null);
        setCurrentView('home');
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete chat. Please try again.');
    }
  };

  const handleDeleteDocument = async (documentId, e) => {
    e.stopPropagation();

    if (!isAdmin()) {
      alert('Only administrators can delete documents.');
      return;
    }

    if (!confirm('Are you sure you want to delete this admin document? This will remove it for all users.')) {
      return;
    }

    try {
      await axios.delete(`http://localhost:8000/documents/${documentId}`);
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
      setSelectedDocumentIds((prev) => prev.filter((id) => id !== documentId));
      alert('Admin document deleted successfully.');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document. Please try again.');
    }
  };

  const handleDocumentUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!isAdmin()) {
      alert('Only administrators can upload documents to the shared library.');
      return;
    }

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a PDF, Word document, or text file.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      await axios.post('http://localhost:8000/upload-document', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });

      fetchDocuments();
      alert(`Admin document "${file.name}" uploaded successfully! It's now available for all users.`);
    } catch (error) {
      console.error('Document upload error:', error);
      alert(`Failed to upload document: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      event.target.value = '';
    }
  };

  const loadSession = async (sessionId) => {
    try {
      const response = await axios.get(`http://localhost:8000/sessions/${sessionId}`);
      setMessages(response.data.messages);
      setSelectedModel(response.data.model);
      setCurrentSessionId(sessionId);
      setCurrentView('chat');
      setSidebarSection('chats');
      if (isMobile) setCollapsed(true);
    } catch (error) {
      console.error('Error loading session:', error);
      alert('Failed to load chat. Please try again.');
    }
  };

  const handleDocumentToggle = (documentId) => {
    setSelectedDocumentIds((prev) => {
      if (prev.includes(documentId)) {
        return prev.filter((id) => id !== documentId);
      } else {
        return [...prev, documentId];
      }
    });
  };

  const handleSelectAllDocuments = () => {
    if (selectedDocumentIds.length === documents.length) {
      setSelectedDocumentIds([]);
    } else {
      setSelectedDocumentIds(documents.map((doc) => doc.id));
    }
  };

  const handleLogout = () => {
    setShowProfileDropdown(false);
    logout();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown date';
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('text')) return '📄';
    return '📁';
  };

  return (
    <>
      <div 
        ref={sidebarRef}
        className={`sidebar ${collapsed ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''}`}
        style={{ width: collapsed ? (isMobile ? '0' : '60px') : `${width}px` }}
      >
        {/* Collapse Toggle Button */}
        <button 
          className="collapse-toggle"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? '→' : '←'}
        </button>

        {!collapsed && (
          <>
            <div className="sidebar-header">
              <div className="profile-section" ref={dropdownRef}>
                <div 
                  className="profile-icon-container"
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                >
                  <div className="profile-icon">
                    <span>👤</span>
                  </div>
                  <div className="user-info">
                    <span className="email">{user?.email}</span>
                    <span className={`role-badge ${user?.role}`}>
                      {user?.role === 'admin' ? '👑 Admin' : '👤 User'}
                    </span>
                  </div>
                  <span className={`dropdown-arrow ${showProfileDropdown ? 'rotated' : ''}`}>▼</span>
                </div>
                
                {showProfileDropdown && (
                  <div className="profile-dropdown">
                    <div className="dropdown-item profile-info">
                      <strong>{user?.email}</strong>
                      <small>{user?.role === 'admin' ? '👑 Administrator' : '👤 User'}</small>
                    </div>
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item logout-btn" onClick={handleLogout}>
                      🚪 Logout
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="personal-space">
              <h3>Personal Space</h3>
            </div>

            <div className="nav-items">
              <div
                className={`nav-item ${currentView === 'home' ? 'active' : ''}`}
                onClick={() => setCurrentView('home')}
              >
                <span className="nav-icon">🏠</span>
                Home
              </div>
              <div className="nav-item" onClick={handleNewChat}>
                <span className="nav-icon">💬</span>
                New Chat
              </div>
              <div
                className={`nav-item ${sidebarSection === 'documents' ? 'active' : ''}`}
                onClick={() => setSidebarSection('documents')}
              >
                <span className="nav-icon">📄</span>
                Admin Documents
                {documents.length > 0 && <span className="count-badge">{documents.length}</span>}
              </div>
            </div>

            <div className="scrollable-content">
              {/* Documents Section */}
              {sidebarSection === 'documents' && (
                <div className="documents-section">
                  <div className="section-header">
                    <h4>
                      {isAdmin() ? 'ADMIN DOCUMENTS' : 'AVAILABLE DOCUMENTS'}
                      <span className="section-subtitle">
                        {isAdmin() ? '(Manage shared documents)' : '(Read-only access)'}
                      </span>
                    </h4>
                    <div className="document-controls">
                      {isAdmin() && (
                        <>
                          <input
                            type="file"
                            id="document-upload"
                            style={{ display: 'none' }}
                            accept=".pdf,.doc,.docx,.txt"
                            onChange={handleDocumentUpload}
                            disabled={isUploading}
                          />
                          
                          <button
                            className="manage-btn"
                            onClick={() => setShowDocumentManager(true)}
                            title="Manage Documents & Folders"
                          >
                            📁
                          </button>
                        </>
                      )}
                      <button
                        className="refresh-btn"
                        onClick={fetchDocuments}
                        disabled={isLoadingDocs}
                        title="Refresh documents"
                      >
                        {isLoadingDocs ? '⏳' : '🔄'}
                      </button>
                    </div>
                  </div>

                  {/* Document Manager Modal */}
                  {showDocumentManager && (
                    <DocumentManager
                      onDocumentSelect={handleDocumentToggle}
                      selectedDocumentIds={selectedDocumentIds}
                      onClose={() => setShowDocumentManager(false)}
                      isAdmin={isAdmin()}
                    />
                  )}

                  {isUploading && (
                    <div className="upload-progress">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                      <span>Uploading admin document... {uploadProgress}%</span>
                    </div>
                  )}

                  <div className="document-types-info">
                    <div className="info-card">
                      <h5>📚 Admin Documents</h5>
                      <p>
                        {isAdmin() 
                          ? 'Shared knowledge base for all users. You can upload, manage, and delete these documents.'
                          : 'Shared knowledge base. You can select and query these documents but cannot modify them.'
                        }
                      </p>
                    </div>
                  </div>

                  {documents.length > 0 && (
                    <div className="rag-controls">
                      <div className="rag-status">
                        <span className="rag-indicator">
                          {selectedDocumentIds.length > 0 ? '🔍' : '💭'}
                        </span>
                        <span className="rag-text">
                          {selectedDocumentIds.length > 0 
                            ? `Admin RAG Mode: ${selectedDocumentIds.length} selected`
                            : 'General Chat Mode'
                          }
                        </span>
                      </div>
                      <button
                        className="select-all-btn"
                        onClick={handleSelectAllDocuments}
                        title={selectedDocumentIds.length === documents.length ? 'Deselect all' : 'Select all'}
                      >
                        {selectedDocumentIds.length === documents.length ? '☑️' : '☐'}
                      </button>
                    </div>
                  )}

                  <div className="documents-list">
                    {isLoadingDocs ? (
                      <div className="loading-state">
                        <p>Loading admin documents...</p>
                      </div>
                    ) : documents.length === 0 ? (
                      <div className="no-items">
                        <p>No admin documents available</p>
                        <small>
                          {isAdmin() 
                            ? 'Upload documents above to make them available for all users'
                            : 'Ask an administrator to upload documents for RAG functionality'
                          }
                        </small>
                      </div>
                    ) : (
                      documents.map((doc) => (
                        <div key={doc.id} className="document-item">
                          <div className="doc-checkbox">
                          <input
                              type="checkbox"
                              id={`doc-${doc.id}`}
                              checked={selectedDocumentIds.includes(doc.id)}
                              onChange={() => handleDocumentToggle(doc.id)}
                              className="document-checkbox"
                            />
                            <label htmlFor={`doc-${doc.id}`} className="checkbox-label">
                              <span className="custom-checkbox">
                                {selectedDocumentIds.includes(doc.id) ? '✓' : ''}
                              </span>
                            </label>
                          </div>
                          
                          <div className="doc-info">
                            <div className="doc-header">
                              <span className="doc-icon">{getFileIcon(doc.type)}</span>
                              <span className="doc-name" title={doc.name}>
                                {doc.name}
                              </span>
                              <span className="doc-type-badge">Admin</span>
                            </div>
                            <div className="doc-details">
                              <small>{formatFileSize(doc.size)}</small>
                              <small>by {doc.uploaded_by || 'admin'}</small>
                              <small>{formatDate(doc.upload_date)}</small>
                            </div>
                          </div>
                          {isAdmin() && (
                            <button
                              className="delete-doc-btn"
                              onClick={(e) => handleDeleteDocument(doc.id, e)}
                              title="Delete admin document (Admin only)"
                              aria-label="Delete admin document"
                            >
                              🗑️
                            </button>
                          )}
                          {!isAdmin() && (
                            <div className="read-only-indicator" title="Read-only access">
                              👁️
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Chat History Section */}
              {sidebarSection !== 'documents' && (
                <div className="chat-history">
                  <h4>CHAT HISTORY</h4>
                  <div className="chat-history-list">
                    {isLoadingChats ? (
                      <div className="loading-state">
                        <p>Loading chats...</p>
                      </div>
                    ) : chatHistory.length === 0 ? (
                      <div className="no-items">
                        <p>No chat history yet</p>
                        <small>Start a new chat to begin</small>
                      </div>
                    ) : (
                      chatHistory.map((session) => (
                        <div
                          key={session.id}
                          className={`chat-item ${currentSessionId === session.id ? 'active' : ''}`}
                          onClick={() => loadSession(session.id)}
                        >
                          <span className="chat-icon">💬</span>
                          <div className="chat-details">
                            <span className="chat-title" title={session.title}>
                              {session.title}
                            </span>
                            <small className="message-count">{session.message_count} messages</small>
                          </div>
                          <button
                            className="delete-btn"
                            onClick={(e) => handleDeleteSession(session.id, e)}
                            title="Delete chat and personal documents"
                            aria-label="Delete chat and personal documents"
                          >
                            🗑️
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="sidebar-footer">
              <div className="theme-toggle">
                <span>Theme</span>
                <span className="theme-icon">🌙</span>
              </div>
              <div className="upgrade-plan">
                <span className="star-icon">⭐</span>
                Upgrade Plan
              </div>
            </div>
          </>
        )}

        {/* Collapsed Sidebar Icons */}
        {collapsed && !isMobile && (
          <div className="collapsed-icons">
            <div
              className={`collapsed-icon ${currentView === 'home' ? 'active' : ''}`}
              onClick={() => setCurrentView('home')}
              title="Home"
            >
              🏠
            </div>
            <div
              className="collapsed-icon"
              onClick={handleNewChat}
              title="New Chat"
            >
              💬
            </div>
            <div
              className={`collapsed-icon ${sidebarSection === 'documents' ? 'active' : ''}`}
              onClick={() => {
                setSidebarSection('documents');
                setCollapsed(false);
              }}
              title="Admin Documents"
            >
              📄
            </div>
          </div>
        )}

        {/* Drag Handle */}
        {!collapsed && !isMobile && (
          <div 
            className="drag-handle"
            onMouseDown={handleMouseDown}
            style={{ cursor: isDragging ? 'col-resize' : 'col-resize' }}
          />
        )}
      </div>
    </>
  );
};

export default Sidebar;

