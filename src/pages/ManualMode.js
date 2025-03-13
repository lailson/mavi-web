import React from 'react';
import Microphone from '../components/Microphone';

const ManualMode = ({ apiStatus }) => {
  return (
    <div className="mode-container">
      <h2>Modo Manual</h2>
      <p>Pressione o botão para falar com Mavi</p>
      <Microphone apiStatus={apiStatus} />
    </div>
  );
};

export default ManualMode;
