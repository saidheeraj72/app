// src/components/ChatArea.jsx
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './ChatArea.css';

const ChatArea = ({
  selectedModel,
  setSelectedModel,
  messages,
  setMessages,
  currentSessionId,
  setCurrentSessionId,
  selectedDocumentIds,
  setSelectedDocumentIds,
  selectedFolderIds,
  setSelectedFolderIds, // Add this prop
}) => {
  const { user, isAdmin } = useAuth();
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showFileDropdown, setShowFileDropdown] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [documentAction, setDocumentAction] = useState('chat');
  const [selectedDocument, setSelectedDocument] = useState(null);
  
  // Knowledge Base Selection State
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderPath, setFolderPath] = useState([]);
  const [isLoadingKB, setIsLoadingKB] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const models = [
    { id: 'llama3-70b-8192', name: 'Llama 3 70B ', supportsImages: false },
    { id: 'gemma2-9b-it', name: 'Gemma2 9B', supportsImages: false },
    { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout (Vision)', supportsImages: true },
  ];

  // Fetch knowledge base data
  const fetchKnowledgeBase = async () => {
    setIsLoadingKB(true);
    try {
      const response = await axios.get(`http://localhost:8000/folders-with-documents${currentFolder ? `?folder=${currentFolder}` : ''}`);
      if (response.data.folders && response.data.documents) {
        setDocuments(response.data.documents || []);
        setFolders(response.data.folders || []);
      } else {
        setDocuments(response.data.documents || []);
        setFolders([]);
      }
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
      setDocuments([]);
      setFolders([]);
    } finally {
      setIsLoadingKB(false);
    }
  };

  // Load knowledge base when popup opens or folder changes
  useEffect(() => {
    if (showKnowledgeBase) {
      fetchKnowledgeBase();
    }
  }, [showKnowledgeBase, currentFolder]);

  // Knowledge base navigation
  const navigateToFolder = (folderId, folderName) => {
    setCurrentFolder(folderId);
    if (folderId) {
      setFolderPath([...folderPath, { id: folderId, name: folderName }]);
    }
  };

  const navigateToRoot = () => {
    setCurrentFolder(null);
    setFolderPath([]);
  };

  const navigateToBreadcrumb = (index) => {
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    setCurrentFolder(newPath[newPath.length - 1]?.id || null);
  };

  // Document and folder selection
  const handleDocumentToggle = (documentId) => {
    setSelectedDocumentIds(prev => {
      if (prev.includes(documentId)) {
        return prev.filter(id => id !== documentId);
      } else {
        return [...prev, documentId];
      }
    });
  };

  const handleFolderToggle = (folderId) => {
    setSelectedFolderIds(prev => {
      if (prev.includes(folderId)) {
        return prev.filter(id => id !== folderId);
      } else {
        return [...prev, folderId];
      }
    });
  };

  // Select all documents in current view
  const handleSelectAllDocuments = () => {
    const allCurrentDocIds = filteredDocuments.map(doc => doc.id);
    const allSelected = allCurrentDocIds.every(id => selectedDocumentIds.includes(id));
    
    if (allSelected) {
      setSelectedDocumentIds(prev => prev.filter(id => !allCurrentDocIds.includes(id)));
    } else {
      setSelectedDocumentIds(prev => [...new Set([...prev, ...allCurrentDocIds])]);
    }
  };

  // Select all folders in current view
  const handleSelectAllFolders = () => {
    const allCurrentFolderIds = filteredFolders.map(folder => folder.id);
    const allSelected = allCurrentFolderIds.every(id => selectedFolderIds.includes(id));
    
    if (allSelected) {
      setSelectedFolderIds(prev => prev.filter(id => !allCurrentFolderIds.includes(id)));
    } else {
      setSelectedFolderIds(prev => [...new Set([...prev, ...allCurrentFolderIds])]);
    }
  };

  // Select/Deselect all items (both docs and folders)
  const handleSelectAll = () => {
    const allDocIds = filteredDocuments.map(doc => doc.id);
    const allFolderIds = filteredFolders.map(folder => folder.id);
    const allSelected = 
      allDocIds.every(id => selectedDocumentIds.includes(id)) &&
      allFolderIds.every(id => selectedFolderIds.includes(id));
    
    if (allSelected) {
      setSelectedDocumentIds(prev => prev.filter(id => !allDocIds.includes(id)));
      setSelectedFolderIds(prev => prev.filter(id => !allFolderIds.includes(id)));
    } else {
      setSelectedDocumentIds(prev => [...new Set([...prev, ...allDocIds])]);
      setSelectedFolderIds(prev => [...new Set([...prev, ...allFolderIds])]);
    }
  };

  // Clear all selections
  const handleDeselectAll = () => {
    setSelectedDocumentIds([]);
    setSelectedFolderIds([]);
  };

  // Filter documents and folders based on search
  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get file icon
  const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('text')) return '📄';
    return '📁';
  };

  // Rest of your existing useEffect and function code remains the same...
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();

      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setInputMessage((prev) => prev + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Keep all your existing functions (fileToBase64, handleSendMessage, etc.)
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSendMessage = async () => {
    const message = inputMessage.trim();
    
    if (!message && !selectedImage && !selectedDocument) return;
    if (isLoading) return;

    let userMessageContent = message;
    
    if (selectedDocument && !message) {
      userMessageContent = documentAction === 'summarize' 
        ? `📄 Requested summarization of: ${selectedDocument.filename}`
        : `📄 Uploaded document for analysis: ${selectedDocument.filename}`;
    } else if (selectedDocument && message) {
      userMessageContent = `📄 Document: ${selectedDocument.filename} | Question: ${message}`;
    }

    const userMessage = {
      role: 'user',
      content: userMessageContent,
      image_url: imagePreview,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const requestData = {
        message: message,
        model: selectedModel,
        session_id: currentSessionId,
        selected_document_ids: selectedDocumentIds,
        selected_folder_ids: selectedFolderIds,
        action_type: documentAction,
      };

      const currentModelSupportsImages = models.find(
        (m) => m.id === selectedModel
      )?.supportsImages;

      if (selectedImage && currentModelSupportsImages) {
        const base64Image = await fileToBase64(selectedImage);
        requestData.image_data = base64Image;
      }

      if (selectedDocument) {
        requestData.document_data = selectedDocument.base64Data;
        requestData.document_filename = selectedDocument.filename;
      }

      const response = await axios.post('http://localhost:8000/chat', requestData);

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      const botMessage = {
        role: 'assistant',
        content: response.data.response,
        references: response.data.references || [],
      };

      setMessages((prev) => [...prev, botMessage]);

      if (!currentSessionId && response.data.session_id) {
        setCurrentSessionId(response.data.session_id);
      }

      clearSelectedImage();
      clearSelectedDocument();
    } catch (error) {
      console.error('Full error:', error);

      let errorMsg = 'Sorry, I encountered an unexpected error.';

      if (error.response) {
        if (error.response.status === 401) {
          errorMsg = 'Authentication failed. Please login again.';
        } else if (error.response.status === 403) {
          errorMsg = 'Access denied. Insufficient permissions.';
        } else {
          errorMsg = error.response.data?.detail || error.response.data?.message || `Server error: ${error.response.status}`;
        }
      } else if (error.request) {
        errorMsg = 'No response from server. Backend might be down or unreachable.';
      } else {
        errorMsg = error.message;
      }

      const errorMessage = {
        role: 'assistant',
        content: `❌ ${errorMsg}`,
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Keep all your other existing functions...
  const handleNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    clearSelectedImage();
    clearSelectedDocument();
    setSelectedModel(models[0].id);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleVoiceClick = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleFileDropdownToggle = () => {
    setShowFileDropdown(!showFileDropdown);
  };

  const handleDocumentUpload = () => {
    fileInputRef.current?.click();
    setShowFileDropdown(false);
  };

  const handleImageUpload = () => {
    const currentModel = models.find((m) => m.id === selectedModel);
    if (!currentModel?.supportsImages) {
      alert('Image upload is only supported with Llama 4 Scout (Vision) model.');
      return;
    }
    imageInputRef.current?.click();
    setShowFileDropdown(false);
  };

  const handleDocumentChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

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

    try {
      const base64Data = await fileToBase64(file);
      
      setSelectedDocument({
        base64Data: base64Data,
        filename: file.name,
        size: file.size,
        type: file.type
      });

    } catch (error) {
      console.error('Document processing error:', error);
      const errorMessage = {
        role: 'assistant',
        content: `❌ Failed to process document: ${error.message}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    const currentModel = models.find((m) => m.id === selectedModel);
    if (!currentModel?.supportsImages) {
      alert('Image upload is only supported with Llama 4 Scout (Vision) model.');
      return;
    }

    setSelectedImage(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);

    event.target.value = '';
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const clearSelectedDocument = () => {
    setSelectedDocument(null);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFileDropdown && !event.target.closest('.attach-container')) {
        setShowFileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFileDropdown]);

  const formatMessage = (content) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/``````/g, '<pre><code>$1</code></pre>')
      .replace(/\n/g, '<br>');
  };

  const currentModel = models.find((m) => m.id === selectedModel);
  const totalSelectedItems = (selectedDocumentIds?.length || 0) + (selectedFolderIds?.length || 0);

  return (
    <div className="chat-area">
      <div className="chat-header">
        <div className="chat-title">
          <h2>Chat with AI</h2>
          <span className="user-indicator">
            {user?.role === 'admin' ? '👑 Admin' : '👤 User'}
          </span>
          {currentModel?.supportsImages && <span className="image-support-badge">📷 Image Analysis</span>}
        </div>
        <div className="header-controls">
          {/* NEW: Knowledge Base Selection Button */}
          <button
            className={`knowledge-base-btn ${totalSelectedItems > 0 ? 'active' : ''}`}
            onClick={() => setShowKnowledgeBase(true)}
            title="Select Knowledge Base"
          >
            🔍 Select Knowledge Base
            {totalSelectedItems > 0 && (
              <span className="selection-count">({totalSelectedItems})</span>
            )}
          </button>
          
          <div className="model-dropdown">
            <select
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                const newModel = models.find((m) => m.id === e.target.value);
                if (!newModel?.supportsImages && selectedImage) {
                  clearSelectedImage();
                  alert('Image cleared: The newly selected model does not support image analysis.');
                }
              }}
              className="model-select"
              disabled={isLoading}
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} {model.supportsImages ? '📷' : ''}
                </option>
              ))}
            </select>
          </div>
          <button className="new-chat-btn" onClick={handleNewChat} disabled={isLoading}>
            New Chat
          </button>
        </div>
      </div>

      {/* Knowledge Base Selection Modal */}
      {showKnowledgeBase && (
        <div className="knowledge-base-modal-overlay" onClick={() => setShowKnowledgeBase(false)}>
          <div className="knowledge-base-modal" onClick={e => e.stopPropagation()}>
            <div className="knowledge-base-header">
              <h3>📚 Select Knowledge Base</h3>
              <button 
                className="close-modal-btn"
                onClick={() => setShowKnowledgeBase(false)}
              >
                ✕
              </button>
            </div>

            <div className="knowledge-base-controls">
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

              <div className="selection-controls">
                <button
                  className="select-all-btn"
                  onClick={handleSelectAll}
                  disabled={isLoadingKB}
                >
                  ☑️ Select All
                </button>
                <button
                  className="deselect-all-btn"
                  onClick={handleDeselectAll}
                  disabled={isLoadingKB}
                >
                  ☐ Deselect All
                </button>
                <div className="selection-info">
                  Selected: {totalSelectedItems} item(s)
                </div>
              </div>
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

            <div className="knowledge-base-content">
              {isLoadingKB ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Loading knowledge base...</p>
                </div>
              ) : (
                <div className="items-list">
                  {/* Folders */}
                  {filteredFolders.map(folder => (
                    <div key={folder.id} className="folder-item">
                      <div className="item-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedFolderIds.includes(folder.id)}
                          onChange={() => handleFolderToggle(folder.id)}
                          className="folder-checkbox"
                        />
                      </div>
                      <div 
                        className="folder-info"
                        onDoubleClick={() => navigateToFolder(folder.id, folder.name)}
                      >
                        <span className="folder-icon">📁</span>
                        <span className="folder-name">{folder.name}</span>
                        <span className="item-count">({folder.item_count || 0} items)</span>
                      </div>
                      <button
                        className="open-folder-btn"
                        onClick={() => navigateToFolder(folder.id, folder.name)}
                        title="Open folder"
                      >
                        📂
                      </button>
                    </div>
                  ))}

                  {/* Documents */}
                  {filteredDocuments.map(doc => (
                    <div key={doc.id} className="document-item">
                      <div className="item-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedDocumentIds.includes(doc.id)}
                          onChange={() => handleDocumentToggle(doc.id)}
                          className="document-checkbox"
                        />
                      </div>
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
                    </div>
                  ))}

                  {filteredDocuments.length === 0 && filteredFolders.length === 0 && !isLoadingKB && (
                    <div className="no-items">
                      {searchQuery ? (
                        <>
                          <p>No items found</p>
                          <small>Try adjusting your search query</small>
                        </>
                      ) : (
                        <>
                          <p>{currentFolder ? 'This folder is empty' : 'No documents available'}</p>
                          <small>Contact an administrator to upload documents</small>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="knowledge-base-footer">
              <div className="selection-summary">
                <strong>Selected:</strong> {selectedFolderIds.length} folder(s), {selectedDocumentIds.length} document(s)
              </div>
              <button
                className="apply-selection-btn"
                onClick={() => setShowKnowledgeBase(false)}
              >
                Apply Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rest of your existing JSX remains the same... */}
      {isUploading && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '100%' }}></div>
          </div>
          <span>Processing document...</span>
        </div>
      )}

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <div className="greeting">
              <h3>Hi {user?.email?.split('@')[0]}! 👋</h3>
              <p>What can I do for you today? 😊</p>
              <div className="model-info">
                <p>
                  Currently using: <strong>{currentModel?.name}</strong>
                </p>
                {currentModel?.supportsImages ? (
                  <p className="image-support">✨ This model supports image analysis!</p>
                ) : (
                  <p className="image-support">✨ This model is text-only.</p>
                )}
              </div>
              
              <div className="rag-status-info">
                {totalSelectedItems > 0 ? (
                  <div className="rag-active">
                    <p>
                      🔍 <strong>RAG Mode Active:</strong> {totalSelectedItems} item(s) selected
                    </p>
                    <div className="rag-breakdown">
                      {selectedFolderIds?.length > 0 && (
                        <small>📁 {selectedFolderIds.length} folder(s)</small>
                      )}
                      {selectedDocumentIds?.length > 0 && (
                        <small>📄 {selectedDocumentIds.length} document(s)</small>
                      )}
                    </div>
                    <small>I'll answer questions based on the selected items</small>
                  </div>
                ) : (
                  <div className="rag-inactive">
                    <p>
                      💭 <strong>General Chat Mode:</strong> No items selected
                    </p>
                    <small>
                      Click "Select Knowledge Base" to choose documents and folders for RAG mode
                    </small>
                  </div>
                )}
              </div>

              <div className="feature-hints">
                <p>💡 You can:</p>
                <ul>
                  <li>📄 Upload documents with or without questions for analysis</li>
                  <li>📊 Get document summaries using the summarize option</li>
                  <li>🔍 Use RAG mode with folders and documents from knowledge base</li>
                  {currentModel?.supportsImages && <li>🖼️ Upload images for analysis</li>}
                  <li>🎤 Use voice input to dictate messages</li>
                  <li>💬 Have natural conversations</li>
                </ul>
                <div className="document-info">
                  <h4>📂 Document Upload Options:</h4>
                  <ul>
                    <li><strong>Document + Question:</strong> Get specific answers from your document</li>
                    <li><strong>Document Only:</strong> Get general analysis and insights</li>
                    <li><strong>Summarize:</strong> Get a comprehensive summary</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.role}`}>
                <div className="message-avatar">{message.role === 'user' ? '👤' : '🤖'}</div>
                <div className="message-content">
                  {message.image_url && (
                    <div className="message-image">
                      <img
                        src={message.image_url}
                        alt="Uploaded"
                        className="uploaded-message-image-preview"
                      />
                    </div>
                  )}
                  <div className="message-text">
                    {message.role === 'assistant' && message.content.startsWith('❌') ? (
                      <div className="error-message">{message.content}</div>
                    ) : message.role === 'assistant' && message.content.startsWith('✅') ? (
                      <div className="success-message">{message.content}</div>
                    ) : message.role === 'assistant' && message.content.includes('Document Summary') ? (
                      <div className="summary-message">{message.content}</div>
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }} />
                    )}
                  </div>
                  {message.references && message.references.length > 0 && (
                    <div className="message-references">
                      <h5>📚 Sources:</h5>
                      {message.references.map((ref, idx) => (
                        <div key={idx} className="reference-item">
                          <span className="reference-name">
                            {ref.folder_path ? `📁 ${ref.folder_path} > ` : ''}
                            📄 {ref.document_name}
                          </span>
                          {ref.similarity_score && (
                            <span className="similarity-score">
                              {Math.round(ref.similarity_score * 100)}% match
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant">
                <div className="message-avatar">🤖</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="input-area">
        {imagePreview && (
          <div className="input-image-preview-container">
            <div className="input-image-preview">
              <img src={imagePreview} alt="Preview" className="input-image-preview-img" />
              <button
                className="remove-image-btn"
                onClick={clearSelectedImage}
                title="Remove image"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {selectedDocument && (
          <div className="input-document-preview-container">
            <div className="input-document-preview">
              <div className="document-preview-info">
                <span className="document-icon">{getFileIcon(selectedDocument.type)}</span>
                <div className="document-details">
                  <span className="document-name">{selectedDocument.filename}</span>
                  <span className="document-stats">
                    {formatFileSize(selectedDocument.size)} • Ready for {documentAction === 'summarize' ? 'summary' : 'analysis'}
                  </span>
                </div>
              </div>
              <button
                className="remove-document-btn"
                onClick={clearSelectedDocument}
                title="Remove document"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        
        <div className="input-container">
          <div className="attach-container">
            <button
              className="attach-btn"
              disabled={isLoading || isUploading}
              onClick={handleFileDropdownToggle}
              title="Attach file"
            >
              📎
            </button>
            {showFileDropdown && (
              <div className="file-dropdown">
                <div className="document-action-selector">
                  <h5>Document Action:</h5>
                  <div className="action-options">
                    <label>
                      <input
                        type="radio"
                        value="chat"
                        checked={documentAction === 'chat'}
                        onChange={(e) => setDocumentAction(e.target.value)}
                      />
                      Analyze & Q&A
                    </label>
                    <label>
                      <input
                        type="radio"
                        value="summarize"
                        checked={documentAction === 'summarize'}
                        onChange={(e) => setDocumentAction(e.target.value)}
                      />
                      Summarize
                    </label>
                  </div>
                </div>
                <div className="file-option" onClick={handleDocumentUpload}>
                  <span className="file-icon">📄</span>
                  <span>Upload Document</span>
                  <small>
                    PDF, Word, TXT • {documentAction === 'summarize' ? 'Auto-summary' : 'Analysis ready'}
                  </small>
                </div>
                <div
                  className={`file-option ${!currentModel?.supportsImages ? 'disabled' : ''}`}
                  onClick={handleImageUpload}
                  title={
                    !currentModel?.supportsImages
                      ? 'Select Llama 4 Scout (Vision) to enable image upload'
                      : 'Upload JPG, PNG, GIF'
                  }
                >
                  <span className="file-icon">🖼️</span>
                  <span>Upload Image</span>
                  <small>{currentModel?.supportsImages ? 'JPG, PNG, GIF' : 'Llama 4 Scout only'}</small>
                </div>
              </div>
            )}
          </div>

          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              selectedImage && currentModel?.supportsImages 
                ? 'Ask about the image...' 
                : selectedDocument
                  ? documentAction === 'summarize'
                    ? 'Document ready for summary (optional: add specific focus)'
                    : `Ask about ${selectedDocument.filename} or leave empty for general analysis`
                  : totalSelectedItems > 0
                    ? 'Ask about the selected folders and documents...'
                    : 'Type a message or upload a file...'
            }
            className="message-input"
            rows="1"
            disabled={isLoading || isUploading}
            maxLength={4000}
          />

          <div className="input-actions">
            <button
              className="send-btn"
              onClick={handleSendMessage}
              disabled={(!inputMessage.trim() && !selectedImage && !selectedDocument) || isLoading || isUploading}
              title="Send message"
            >
              {isLoading ? '⏳' : '➤'}
            </button>
          </div>

          <button
            className={`voice-btn ${isListening ? 'listening' : ''}`}
            onClick={handleVoiceClick}
            disabled={isLoading || isUploading}
            title={isListening ? 'Stop recording' : 'Start voice input'}
          >
            {isListening ? '🎙️' : '🎤'}
          </button>

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleDocumentChange}
          />
          <input
            type="file"
            ref={imageInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={handleImageChange}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
