import React, { useState, useRef } from 'react';
import { FaMicrophone } from 'react-icons/fa';
import { sendAudioToApi } from '../services/api';
import { convertToWav } from '../utils/audioConverter';
import './AudioRecorder.css';

const AudioRecorder = ({ isApiAvailable }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioPlayerRef = useRef(null);

  // Iniciar gravação usando qualquer formato que o navegador suporte
  const startRecording = async () => {
    try {
      setStatus('recording');
      setErrorMessage('');
      setDebugInfo('');
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1
        } 
      });
      
      // Usamos qualquer formato que o navegador suporte bem
      // pois vamos converter para WAV depois
      mediaRecorderRef.current = new MediaRecorder(stream);
      setDebugInfo(`Gravando com formato: ${mediaRecorderRef.current.mimeType}`);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      setErrorMessage(`Não foi possível acessar o microfone: ${error.message}`);
      setStatus('idle');
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return null;
    }

    return new Promise(resolve => {
      mediaRecorderRef.current.onstop = async () => {
        const originalBlob = new Blob(audioChunksRef.current);
        
        // Parar stream do microfone
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        
        setDebugInfo(`Áudio gravado: ${originalBlob.size} bytes, formato: ${originalBlob.type}`);
        resolve(originalBlob);
      };
      
      mediaRecorderRef.current.stop();
    });
  };

  const handleRecordButtonMouseDown = () => {
    if (!isApiAvailable) {
      setErrorMessage('A API está offline. Não é possível gravar áudio.');
      return;
    }
    
    startRecording();
  };

  const handleRecordButtonMouseUp = async () => {
    if (!isRecording) return;
    
    setIsRecording(false);
    setStatus('processing');
    
    try {
      const originalBlob = await stopRecording();
      
      // Verifica se o blob foi criado corretamente
      if (!originalBlob || originalBlob.size === 0) {
        throw new Error("O áudio gravado está vazio");
      }
      
      setDebugInfo(`Convertendo áudio para WAV...`);
      
      try {
        // Converte para WAV explicitamente
        const wavBlob = await convertToWav(originalBlob);
        
        setStatus('sending');
        setDebugInfo(`Enviando áudio WAV: ${wavBlob.size} bytes`);
        
        // Envia o WAV para a API
        const responseBlob = await sendAudioToApi(wavBlob);
        
        setStatus('playing');
        const audioUrl = URL.createObjectURL(responseBlob);
        audioPlayerRef.current.src = audioUrl;
        audioPlayerRef.current.play();
        
        audioPlayerRef.current.onended = () => {
          setStatus('idle');
          URL.revokeObjectURL(audioUrl);
        };
      } catch (apiError) {
        console.error('Erro na comunicação com a API:', apiError);
        
        // Informações detalhadas do erro para depuração
        let errorDetails = `Erro ${apiError.response?.status || 'desconhecido'}: ${apiError.message}`;
        
        if (apiError.response) {
          errorDetails += ` - ${JSON.stringify(apiError.response.data)}`;
        }
        
        setDebugInfo(errorDetails);
        setErrorMessage(`Erro ao enviar ou receber áudio. Código: ${apiError.response?.status || 'N/A'}`);
        setStatus('idle');
      }
    } catch (error) {
      console.error('Erro ao processar áudio:', error);
      setErrorMessage(`Ocorreu um erro: ${error.message}`);
      setDebugInfo(`Stack: ${error.stack}`);
      setStatus('idle');
    }
  };
  
  const getStatusMessage = () => {
    switch (status) {
      case 'recording': return 'Gravando áudio...';
      case 'processing': return 'Processando áudio...';
      case 'sending': return 'Enviando para Mavie...';
      case 'playing': return 'Ouvindo resposta...';
      default: return 'Pressione e segure para falar com Mavie';
    }
  };

  return (
    <div className="audio-recorder">
      <div className="status-message">{getStatusMessage()}</div>
      
      {errorMessage && <div className="error-message">{errorMessage}</div>}
      {debugInfo && <div className="debug-info">{debugInfo}</div>}
      
      <button
        className={`record-button ${isRecording ? 'recording' : ''} ${status}`}
        onMouseDown={handleRecordButtonMouseDown}
        onMouseUp={handleRecordButtonMouseUp}
        onTouchStart={handleRecordButtonMouseDown}
        onTouchEnd={handleRecordButtonMouseUp}
        disabled={!isApiAvailable || status === 'processing' || status === 'sending' || status === 'playing'}
      >
        <FaMicrophone size={30} />
      </button>
      
      <audio ref={audioPlayerRef} style={{ display: 'none' }} />
      
      <div className="instructions">
        {isApiAvailable ? (
          <p>Pressione e segure o botão para falar, solte para enviar.</p>
        ) : (
          <p>Sistema offline. Verifique a conexão de rede.</p>
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;
