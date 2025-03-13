import React, { useEffect, useState } from 'react';
import './App.css';
import Microphone from './components/Microphone';
import StatusIndicator from './components/StatusIndicator';
import { checkApiStatus } from './services/api';

function App() {
  const [apiStatus, setApiStatus] = useState({ online: false, loading: true });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await checkApiStatus();
        setApiStatus({ online: status.status === 'online', loading: false });
      } catch (error) {
        console.error('Erro ao verificar status da API:', error);
        setApiStatus({ online: false, loading: false });
      }
    };

    checkStatus();
    // Verificar status a cada 30 segundos
    const intervalId = setInterval(checkStatus, 30000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Mavi - Assistente de Voz</h1>
        <StatusIndicator status={apiStatus} />
      </header>
      <main className="App-main">
        <Microphone apiStatus={apiStatus.online} />
      </main>
      <footer className="App-footer">
        <p>© {new Date().getFullYear()} Mavi Voice Assistant</p>
      </footer>
    </div>
  );
}

export default App;
