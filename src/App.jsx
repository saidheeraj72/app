// src/App.jsx
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import ModelSelector from './components/ModelSelector';
import Login from './components/Login';
import './App.css';

const AppContent = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('home');
  const [sidebarSection, setSidebarSection] = useState('chats');
  const [selectedModel, setSelectedModel] = useState('llama3-70b-8192');
  const [messages, setMessages] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Handle window resize
  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${isMobile ? 'mobile' : ''}`}>
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        sidebarSection={sidebarSection}
        setSidebarSection={setSidebarSection}
        setMessages={setMessages}
        setSelectedModel={setSelectedModel}
        setCurrentSessionId={setCurrentSessionId}
        currentSessionId={currentSessionId}
        selectedDocumentIds={selectedDocumentIds}
        setSelectedDocumentIds={setSelectedDocumentIds}
        selectedFolderIds={selectedFolderIds} // NEW: Added folder selection props
        setSelectedFolderIds={setSelectedFolderIds} // NEW: Added folder selection props
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        width={sidebarWidth}
        setWidth={setSidebarWidth}
        isMobile={isMobile}
      />
      
      <div 
        className="main-content"
        style={{
          marginLeft: isMobile ? 0 : (sidebarCollapsed ? 60 : sidebarWidth),
          transition: 'margin-left 0.3s ease'
        }}
      >
        {/* Mobile overlay */}
        {isMobile && !sidebarCollapsed && (
          <div 
            className="mobile-overlay"
            onClick={() => setSidebarCollapsed(true)}
          />
        )}
        
        {currentView === 'home' && (
          <ModelSelector
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            setCurrentView={setCurrentView}
          />
        )}
        
        {currentView === 'chat' && (
          <ChatArea
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          messages={messages}
          setMessages={setMessages}
          currentSessionId={currentSessionId}
          setCurrentSessionId={setCurrentSessionId}
          selectedDocumentIds={selectedDocumentIds}
          setSelectedDocumentIds={setSelectedDocumentIds}
          selectedFolderIds={selectedFolderIds}
          setSelectedFolderIds={setSelectedFolderIds}
        />
        )}
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
