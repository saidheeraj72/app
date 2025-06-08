// ModelSelector.jsx
import './ModelSelector.css'

const ModelSelector = ({ selectedModel, setSelectedModel, setCurrentView }) => {
  // UPDATED: Model IDs and names to match actual models
  const models = [
    {
      id: 'gemma2-9b-it', // Updated ID
      name: 'Gemma2 9B ', // Updated name
      description: "Google's lightweight model for efficient performance on standard hardware. Best for daily tasks.",
      icon: '⚡'
    },
    {
      id: 'meta-llama/llama-4-scout', // This is the new  Vision model!
      name: 'Llama 4 Scout (Vision)', // Updated name for clarity
      description: "Meta's powerful language model with native image understanding and OCR capabilities.",
      icon: '⚡'
    },
    {
      id: 'llama3-70b-8192', // Updated ID
      name: 'Llama 3 70B', // Updated name
      description: "A powerful open-weight model with strong performance across coding and reasoning tasks.",
      icon: '⚡'
    }
  ]

  const features = [
    { name: 'Voice Assistant', status: 'Feature coming soon', icon: '💬' },
    { name: 'Text-to-Image', status: 'Feature coming soon', icon: '🖼️' },
    { name: 'Image Analysis', status: 'Available with Llama 4 Scout!', icon: '🔍' }, // UPDATED status
    { name: 'API Integration', status: 'Feature coming soon', icon: '💬' },
    { name: 'Database Integration', status: 'Feature coming soon', icon: '💬' },
    { name: 'Website Reading', status: 'Feature coming soon', icon: '💬' }
  ]

  const handleModelSelect = (modelId) => {
    setSelectedModel(modelId)
    setCurrentView('chat')
  }

  return (
    <div className="model-selector">
      <div className="header">
        <div className="notification">
        <div className="profile-icon">
            <span>👤</span>
          </div>
          
        </div>
      </div>
      
      <div className="welcome-section">
        <h1>Welcome to AI Workflow</h1>
        <p>What can I help you with today?</p>
      </div>

      <div className="models-section">
        <h2>Select Language Model</h2>
        <div className="models-grid">
          {models.map((model) => (
            <div 
              key={model.id} 
              className={`model-card ${selectedModel === model.id ? 'selected' : ''}`}
            >
              <div className="model-header">
                <h3>{model.name}</h3>
                <span className="model-icon">{model.icon}</span>
              </div>
              <p className="model-description">{model.description}</p>
              <button 
                className="select-model-btn"
                onClick={() => handleModelSelect(model.id)}
              >
                Select Model
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="features-section">
        <h2>Explore Features</h2>
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.name}</h3>
              <p>{feature.status}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ModelSelector