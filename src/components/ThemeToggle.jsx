// src/components/ThemeToggle.jsx
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import './ThemeToggle.css';

const ThemeToggle = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button 
      className={`theme-toggle ${className}`}
      onClick={toggleTheme}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <div className="theme-toggle-track">
        <div className="theme-toggle-thumb">
          <span className="theme-icon">
            {theme === 'light' ? '🌙' : '☀️'}
          </span>
        </div>
      </div>
    </button>
  );
};

export default ThemeToggle;
