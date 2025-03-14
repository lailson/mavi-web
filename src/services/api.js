import axios from 'axios';

const API_BASE_URL = 'https://100.26.31.165/voice';

export const checkApiStatus = async () => {
  const response = await axios.get(`${API_BASE_URL}/status`);
  return response.data;
};

export const sendAudioToApi = async (audioBlob) => {
  // Confirmar que estamos enviando WAV
  if (!audioBlob.type.includes('wav')) {
    console.warn('O áudio não está em formato WAV. Tipo atual:', audioBlob.type);
  }
  
  // Definir nome de arquivo explicitamente como WAV
  const fileName = `audio_${Date.now()}.wav`;
  
  console.log(`Enviando áudio como ${fileName}, formato: ${audioBlob.type}, tamanho: ${audioBlob.size} bytes`);
  
  const formData = new FormData();
  formData.append('audio', audioBlob, fileName);
  
  try {
    const response = await axios.post(`${API_BASE_URL}/chat`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      responseType: 'blob',
      timeout: 30000,
    });
    
    console.log('Resposta recebida com sucesso:', {
      status: response.status,
      dataType: response.data.type,
      dataSize: response.data.size
    });
    
    return response.data;
  } catch (error) {
    console.error('Erro na chamada da API:', error);
    
    // Se a API enviou uma resposta, mas com um erro
    if (error.response) {
      console.error('Dados da resposta de erro:', {
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data
      });
      
      // Se o erro contém dados em formato blob, tenta converter para texto para ver a mensagem
      if (error.response.data instanceof Blob) {
        const text = await error.response.data.text();
        console.error('Conteúdo do erro:', text);
        
        // Recria o erro com informações mais detalhadas
        const enhancedError = new Error(`Erro ${error.response.status}: ${text}`);
        enhancedError.response = error.response;
        throw enhancedError;
      }
    }
    
    throw error;
  }
};
