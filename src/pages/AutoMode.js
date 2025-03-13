import React, { useState, useEffect } from 'react';
import { FaMicrophone } from 'react-icons/fa';
import './AutoMode.css';

const AutoMode = ({ apiStatus }) => {
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!apiStatus) {
      setIsListening(false);
      setFeedback('API está offline. Modo automático indisponível.');
    } else {
      setFeedback('Aguardando wake word...');
    }
  }, [apiStatus]);

  return (
    <div className="mode-container">
      <h2>Modo Automático</h2>
      <p>Aguardando a palavra de ativação</p>
      
      <div className="auto-microphone-container">
        <div className={`auto-microphone ${isListening ? 'listening' : ''} ${!apiStatus ? 'disabled' : ''}`}>
          <FaMicrophone />
          <div className={`pulse-rings ${isListening ? 'active' : ''}`}>
            <div className="ring ring1"></div>
            <div className="ring ring2"></div>
            <div className="ring ring3"></div>
          </div>
        </div>
        <p className="auto-feedback">{feedback}</p>
      </div>
    </div>
  );
};

export default AutoMode;
