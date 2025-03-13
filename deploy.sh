#!/bin/bash

# Configurações
EC2_USER="ubuntu"
EC2_HOST="100.26.31.165"
EC2_KEY="mavi-api-server.pem"
REMOTE_DIR="/home/ubuntu/mavi-web"

echo "🚀 Iniciando deploy da interface web para o servidor EC2..."

# Verificar permissões da chave
chmod 400 $EC2_KEY

# Teste de conexão
echo "🔄 Testando conexão SSH..."
ssh -i $EC2_KEY -o StrictHostKeyChecking=no $EC2_USER@$EC2_HOST "echo 'Conexão SSH estabelecida com sucesso!'" || {
    echo "❌ ERRO: Falha na conexão SSH. Verificando se o servidor está acessível..."
    exit 1
}

# Criar diretório remoto se não existir
ssh -i $EC2_KEY $EC2_USER@$EC2_HOST "mkdir -p $REMOTE_DIR"

# Copiar todos os arquivos do projeto
echo "📁 Copiando arquivos da interface web para o servidor..."
rsync -avz -e "ssh -i $EC2_KEY" \
      --exclude 'node_modules' \
      --exclude 'build' \
      --exclude '.git' \
      --exclude '.vscode' \
      --exclude '*.pem' \
      --exclude '.idea' \
      ./ $EC2_USER@$EC2_HOST:$REMOTE_DIR

# Atualizar docker-compose.yml para evitar conflitos de porta
echo "⚙️ Garantindo que não haja conflitos de porta..."
ssh -i $EC2_KEY $EC2_USER@$EC2_HOST "cat > $REMOTE_DIR/docker-compose.yml << 'EOL'
version: '3'

services:
  mavi-web:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - \"3000:80\"
    restart: unless-stopped
    container_name: mavi-web
EOL"

# Reiniciar os containers
echo "🔄 Reiniciando os containers da interface web..."
ssh -i $EC2_KEY $EC2_USER@$EC2_HOST "cd $REMOTE_DIR && sudo docker-compose down && sudo docker-compose up --build -d"

echo "✅ Deploy da interface web concluído com sucesso!"
echo "🌐 Acesse a interface em: http://$EC2_HOST:3000"
