import React, { useState, useEffect } from 'react';
import './App.css';
import AudioRecorder from './components/AudioRecorder';
import { checkApiStatus } from './services/api';

function App() {
  const [apiStatus, setApiStatus] = useState({ status: 'unknown', message: 'Verificando conexão...' });
  
  useEffect(() => {
    // Verificar status da API
    const verifyApiStatus = async () => {
      try {
        const status = await checkApiStatus();
        setApiStatus({ 
          status: 'online', 
          message: `Mavie está online (versão ${status.version})`
        });
      } catch (error) {
        setApiStatus({ 
          status: 'offline', 
          message: 'Mavie está offline no momento. Tente novamente mais tarde.' 
        });
      }
    };

    verifyApiStatus();
  }, []);

  return (
    <div className="app">
      <header>
        <h1>Mavie</h1>
        <p>Assistente Virtual de Consultório Médico</p>
        <div className={`status-indicator ${apiStatus.status}`}>
          {apiStatus.message}
        </div>
        <div className="format-support">
          <small>Usando conversão automática para WAV</small>
        </div>
      </header>
      
      <main>
        <AudioRecorder isApiAvailable={apiStatus.status === 'online'} />
      </main>
      
      <footer>
        <p>© 2025 Mavie - Assistente Médico Virtual</p>
      </footer>
    </div>
  );
}

export default App;
