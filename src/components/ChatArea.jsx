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
  // Document preview states (simple icon display)
  const [selectedDocument, setSelectedDocument] = useState(null);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const models = [
    { id: 'llama3-70b-8192', name: 'Llama 3 70B ', supportsImages: false },
    { id: 'gemma2-9b-it', name: 'Gemma2 9B', supportsImages: false },
    { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout (Vision)', supportsImages: true },
  ];

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
    
    // Allow sending if there's a message, image, or document
    if (!message && !selectedImage && !selectedDocument) return;
    if (isLoading) return;

    let userMessageContent = message;
    
    // If only document is uploaded without text
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
        message: message, // Can be empty if only document is uploaded
        model: selectedModel,
        session_id: currentSessionId,
        selected_document_ids: selectedDocumentIds,
        action_type: documentAction,
      };

      const currentModelSupportsImages = models.find(
        (m) => m.id === selectedModel
      )?.supportsImages;

      if (selectedImage && currentModelSupportsImages) {
        const base64Image = await fileToBase64(selectedImage);
        requestData.image_data = base64Image;
      }

      // Add document data if document is selected
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
      // Convert file to base64
      const base64Data = await fileToBase64(file);
      
      // Set document for preview (simple icon display)
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

      {/* Upload Progress Bar */}
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
                {selectedDocumentIds && selectedDocumentIds.length > 0 ? (
                  <div className="rag-active">
                    <p>
                      🔍 <strong>RAG Mode Active:</strong> {selectedDocumentIds.length} document(s) selected
                    </p>
                    <small>I'll answer questions based on the selected documents</small>
                  </div>
                ) : (
                  <div className="rag-inactive">
                    <p>
                      💭 <strong>General Chat Mode:</strong> No documents selected
                    </p>
                    <small>
                      {isAdmin() 
                        ? 'Select documents in the sidebar to enable RAG mode' 
                        : 'Admin documents are available in the sidebar for RAG mode'
                      }
                    </small>
                  </div>
                )}
              </div>

              <div className="feature-hints">
                <p>💡 You can:</p>
                <ul>
                  <li>📄 Upload documents with or without questions for analysis</li>
                  <li>📊 Get document summaries using the summarize option</li>
                  <li>🔍 Use RAG mode with documents from sidebar</li>
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
        {/* Image Preview */}
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

        {/* Document Preview (Simple Icon Style) */}
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
                  : selectedDocumentIds && selectedDocumentIds.length > 0
                    ? 'Ask about the selected documents...'
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
