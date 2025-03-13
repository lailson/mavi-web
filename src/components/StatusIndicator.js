import React from 'react';
import './StatusIndicator.css';

const StatusIndicator = ({ status }) => {
  if (status.loading) {
    return <div className="status-indicator loading">Verificando status da API...</div>;
  }

  return (
    <div className={`status-indicator ${status.online ? 'online' : 'offline'}`}>
      API está {status.online ? 'online' : 'offline'}
    </div>
  );
};

export default StatusIndicator;
