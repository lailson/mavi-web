import React, { useState } from 'react';
import { FaMicrophone, FaStop } from 'react-icons/fa';
import './Microphone.css';
import { sendAudio } from '../services/api';

const Microphone = ({ apiStatus }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('');

  const showFeedback = (message, type) => {
    setFeedback(message);
    setFeedbackType(type);
    setTimeout(() => {
      setFeedback('');
      setFeedbackType('');
    }, 5000);
  };

  const startRecording = async () => {
    if (!apiStatus) {
      showFeedback('A API está offline. Não é possível gravar.', 'error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          setAudioChunks(prevChunks => [...prevChunks, e.data]);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        
        try {
          showFeedback('Enviando áudio...', 'info');
          await sendAudio(audioBlob);
          showFeedback('Áudio enviado com sucesso!', 'success');
        } catch (error) {
          console.error('Erro ao enviar áudio:', error);
          showFeedback('Erro ao enviar áudio.', 'error');
        }
        
        // Limpar chunks para próxima gravação
        setAudioChunks([]);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      showFeedback('Gravando áudio...', 'info');
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      showFeedback('Não foi possível acessar o microfone.', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  return (
    <div className="microphone-container">
      <button
        className={`microphone-button ${isRecording ? 'recording' : ''}`}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={!apiStatus && !isRecording}
      >
        {isRecording ? <FaStop /> : <FaMicrophone />}
      </button>
      <p className="microphone-text">
        {isRecording ? 'Clique para parar' : 'Clique para falar com Mavi'}
      </p>
      {feedback && (
        <div className={`feedback ${feedbackType}`}>
          {feedback}
        </div>
      )}
    </div>
  );
};

export default Microphone;
