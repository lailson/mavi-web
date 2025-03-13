import axios from 'axios';

const API_BASE_URL = 'https://ec2-100-26-31-165.compute-1.amazonaws.com';

export const checkApiStatus = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/voice/status`);
    return response.data;
  } catch (error) {
    console.error('Erro ao verificar status da API:', error);
    throw error;
  }
};

export const sendAudio = async (audioBlob) => {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.wav');

    const response = await axios.post(`${API_BASE_URL}/voice/process`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Erro ao enviar áudio:', error);
    throw error;
  }
};
