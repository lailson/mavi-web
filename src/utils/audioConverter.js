/**
 * Converte um blob de áudio para o formato WAV
 * @param {Blob} audioBlob - O blob de áudio a ser convertido
 * @returns {Promise<Blob>} Uma promise com o blob de áudio convertido para WAV
 */
export const convertToWav = async (audioBlob) => {
  // Cria um URL temporário para o blob
  const blobUrl = URL.createObjectURL(audioBlob);
  
  // Cria um elemento de áudio para decodificar o áudio
  const audio = new Audio();
  
  try {
    // Cria um contexto de áudio
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    
    // Carrega o áudio no elemento
    return new Promise((resolve, reject) => {
      audio.src = blobUrl;
      
      // Quando o áudio estiver carregado
      audio.onloadedmetadata = async () => {
        try {
          // Busca o áudio como ArrayBuffer
          const response = await fetch(blobUrl);
          const arrayBuffer = await response.arrayBuffer();
          
          // Decodifica o áudio para PCM
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Converte para WAV
          const wavBlob = await audioBufferToWav(audioBuffer);
          console.log('Áudio convertido para WAV com sucesso!', {
            originalSize: audioBlob.size,
            newSize: wavBlob.size,
            sampleRate: audioBuffer.sampleRate
          });
          
          resolve(wavBlob);
        } catch (error) {
          console.error('Erro na conversão de áudio:', error);
          reject(error);
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      };
      
      audio.onerror = (e) => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error(`Erro ao carregar áudio: ${e.message || 'Erro desconhecido'}`));
      };
    });
  } catch (error) {
    URL.revokeObjectURL(blobUrl);
    throw error;
  }
};

/**
 * Converte um AudioBuffer para um blob WAV
 * @param {AudioBuffer} audioBuffer - O buffer de áudio a ser convertido
 * @returns {Blob} Um blob WAV
 */
function audioBufferToWav(audioBuffer) {
  const numOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const bitsPerSample = 16; // PCM 16 bits
  const bytesPerSample = bitsPerSample / 8;
  
  // Extrai os dados de áudio
  const channels = [];
  for (let i = 0; i < numOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }
  
  // Cria o buffer WAV
  const dataLength = length * numOfChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength); // 44 bytes para o cabeçalho WAV
  const view = new DataView(buffer);
  
  // Escreve o cabeçalho WAV
  // "RIFF" chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  
  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // tamanho do sub-chunk
  view.setUint16(20, 1, true); // formato de áudio = PCM
  view.setUint16(22, numOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numOfChannels * bytesPerSample, true); // bytes por segundo
  view.setUint16(32, numOfChannels * bytesPerSample, true); // block align
  view.setUint16(34, bitsPerSample, true); // bits per sample
  
  // sub-chunk "data"
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true); // tamanho dos dados
  
  // Escreve os dados de áudio
  const offset = 44;
  const volume = 1;
  
  // Transforma os dados de ponto flutuante em inteiros de 16 bits
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numOfChannels; c++) {
      // Converte de -1.0 a 1.0 para -32768 a 32767
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      const int = Math.floor(sample * volume * 0x7FFF);
      view.setInt16(offset + (i * numOfChannels + c) * bytesPerSample, int, true);
    }
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
