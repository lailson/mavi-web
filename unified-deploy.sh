#!/bin/bash

# Configurações
EC2_USER="ubuntu"
EC2_HOST="100.26.31.165"
EC2_KEY="mavi-api-server.pem"
DEPLOY_DIR="/home/ubuntu/mavi-deploy"
API_DIR="/home/ubuntu/mavi-api"
WEB_DIR="/home/ubuntu/mavi-web"

echo "🚀 Iniciando implantação unificada da API e interface web..."

# Verificar permissões da chave
chmod 400 $EC2_KEY

# Teste de conexão
echo "🔄 Testando conexão SSH..."
ssh -i $EC2_KEY -o StrictHostKeyChecking=no $EC2_USER@$EC2_HOST "echo 'Conexão SSH estabelecida com sucesso!'" || {
    echo "❌ ERRO: Falha na conexão SSH. Verificando se o servidor está acessível..."
    exit 1
}

# Criar diretório de implantação unificada
echo "📁 Criando estrutura de diretórios no servidor..."
ssh -i $EC2_KEY $EC2_USER@$EC2_HOST "mkdir -p $DEPLOY_DIR/nginx"

# Criar configuração do Nginx unificada
echo "⚙️ Configurando Nginx como proxy reverso unificado..."
ssh -i $EC2_KEY $EC2_USER@$EC2_HOST "cat > $DEPLOY_DIR/nginx/nginx.conf << 'EOL'
# Configuração básica do Nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # Logs
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;
    
    # Configurações de performance
    sendfile on;
    keepalive_timeout 65;
    
    # Configuração do servidor
    server {
        listen 80;
        listen 443 ssl;
        server_name _;
        
        # Configuração SSL
        ssl_certificate     /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols       TLSv1.2 TLSv1.3;
        
        # Endpoint para API
        location /voice/ {
            proxy_pass http://mavi-api:8000/voice/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
        
        # Endpoint para documentação da API
        location /docs {
            proxy_pass http://mavi-api:8000/docs;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
        
        location /openapi.json {
            proxy_pass http://mavi-api:8000/openapi.json;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
        }
        
        # Interface web na raiz
        location / {
            proxy_pass http://mavi-web:80;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
EOL"

# Criar docker-compose unificado
echo "🐳 Criando configuração Docker unificada..."
ssh -i $EC2_KEY $EC2_USER@$EC2_HOST "cat > $DEPLOY_DIR/docker-compose.yml << 'EOL'
version: '3'

services:
  # Nginx como proxy reverso unificado
  nginx:
    image: nginx:alpine
    ports:
      - \"80:80\"
      - \"443:443\"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - $API_DIR/nginx/ssl:/etc/nginx/ssl:ro
      - $API_DIR/logs/nginx:/var/log/nginx
    depends_on:
      - mavi-api
      - mavi-web
    networks:
      - mavi-network
    restart: unless-stopped

  # API Mavi
  mavi-api:
    build:
      context: $API_DIR
      dockerfile: Dockerfile
    volumes:
      - $API_DIR:/app
    environment:
      - ENVIRONMENT=production
      - PYTHONPATH=/app
      - GOOGLE_APPLICATION_CREDENTIALS=/app/credentials-tts.json
    healthcheck:
      test: [\"CMD\", \"curl\", \"-f\", \"http://localhost:8000/voice/status\"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - mavi-network
    restart: unless-stopped
    command: uvicorn main:app --host 0.0.0.0 --port 8000

  # Interface web Mavi
  mavi-web:
    build:
      context: $WEB_DIR
      dockerfile: Dockerfile
    networks:
      - mavi-network
    restart: unless-stopped

networks:
  mavi-network:
    driver: bridge
EOL"

# Criar script para iniciar a aplicação unificada
echo "📜 Criando script de inicialização..."
ssh -i $EC2_KEY $EC2_USER@$EC2_HOST "cat > $DEPLOY_DIR/start.sh << 'EOL'
#!/bin/bash

# Parar todos os containers em execução relacionados ao Mavi
echo "🔄 Parando serviços existentes..."
cd /home/ubuntu/mavi-api && sudo docker-compose down || true
cd /home/ubuntu/mavi-web && sudo docker-compose down || true

# Iniciar a implantação unificada
echo "🚀 Iniciando serviços unificados..."
cd /home/ubuntu/mavi-deploy && sudo docker-compose down || true
cd /home/ubuntu/mavi-deploy && sudo docker-compose up --build -d

# Verificar se os serviços estão em execução
echo "✅ Verificando status dos serviços:"
sudo docker ps | grep mavi
EOL"

# Tornar o script executável
ssh -i $EC2_KEY $EC2_USER@$EC2_HOST "chmod +x $DEPLOY_DIR/start.sh"

# Executar o script de inicialização
echo "🚀 Iniciando os serviços unificados..."
ssh -i $EC2_KEY $EC2_USER@$EC2_HOST "cd $DEPLOY_DIR && ./start.sh"

echo "✅ Implantação unificada concluída com sucesso!"
echo "🌐 Acesse a interface web em: https://$EC2_HOST"
echo "🌐 Acesse a API em: https://$EC2_HOST/voice/"
echo "🌐 Acesse a documentação da API em: https://$EC2_HOST/docs"
