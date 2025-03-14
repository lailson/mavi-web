#!/bin/bash

# Script de deploy unificado para Mavi (API + Web)
# Este script configura e implanta tanto a API quanto a interface web

set -e  # Parar no primeiro erro
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
DEPLOY_ROOT="/home/ubuntu/mavi-deploy"
API_DIR="/home/ubuntu/mavi-api"
WEB_DIR="/home/ubuntu/mavi-web"
LOG_DIR="${DEPLOY_ROOT}/logs"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções auxiliares
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_directory() {
    if [ ! -d "$1" ]; then
        log_error "Diretório $1 não encontrado."
        exit 1
    fi
}

# Verificar diretórios necessários
log_info "Verificando diretórios necessários..."
check_directory "$API_DIR"
check_directory "$WEB_DIR"

# Criar estrutura de diretórios para o deploy unificado
log_info "Criando estrutura de diretórios para deploy unificado..."
mkdir -p "${DEPLOY_ROOT}/nginx/ssl"
mkdir -p "${LOG_DIR}/nginx"

# Copiar certificados SSL
log_info "Copiando certificados SSL..."
cp "${API_DIR}/nginx/ssl/fullchain.pem" "${DEPLOY_ROOT}/nginx/ssl/" 2>/dev/null || log_warn "Certificado fullchain.pem não encontrado. Verifique o caminho."
cp "${API_DIR}/nginx/ssl/privkey.pem" "${DEPLOY_ROOT}/nginx/ssl/" 2>/dev/null || log_warn "Certificado privkey.pem não encontrado. Verifique o caminho."

# Criar arquivo de configuração do Nginx
log_info "Criando configuração do Nginx unificado..."
cat > "${DEPLOY_ROOT}/nginx/nginx.conf" << 'EOF'
# Configuração do Nginx para deploy unificado Mavi
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Configurações de logging
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';
    access_log  /var/log/nginx/access.log  main;
    error_log   /var/log/nginx/error.log warn;

    # Configurações gerais
    sendfile        on;
    keepalive_timeout  65;
    client_max_body_size 10M;
    
    # Configurações para WebSockets
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    # Redirecionar HTTP para HTTPS
    server {
        listen 80 default_server;
        server_name _;

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # Servidor HTTPS
    server {
        listen 443 ssl default_server;
        server_name _;

        # SSL
        ssl_certificate     /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols       TLSv1.2 TLSv1.3;
        ssl_prefer_server_ciphers on;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_session_timeout 1d;
        ssl_session_cache shared:SSL:10m;

        # Configurações de timeout
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;

        # Rota para a API (/voice/)
        location /voice/ {
            proxy_pass http://mavi-api:8000/voice/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_buffering off;
        }

        # Rota para documentação da API
        location /docs {
            proxy_pass http://mavi-api:8000/docs;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # OpenAPI JSON
        location /openapi.json {
            proxy_pass http://mavi-api:8000/openapi.json;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
        }

        # Interface Web (todo o resto)
        location / {
            proxy_pass http://mavi-web:80;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Adicionar headers para permissão de microfone
            add_header Permissions-Policy "microphone=(), camera=()";
        }

        # Diretório temporário para arquivos de áudio
        location /tmp/ {
            proxy_pass http://mavi-web:80/tmp/;
            client_max_body_size 10M;
        }
    }
}
EOF

# Criar arquivo Docker Compose unificado
log_info "Criando Docker Compose unificado..."
cat > "${DEPLOY_ROOT}/docker-compose.yml" << EOF
version: '3'

services:
  # Nginx como proxy reverso unificado
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ${LOG_DIR}/nginx:/var/log/nginx
    depends_on:
      - mavi-api
      - mavi-web
    networks:
      - mavi-network
    restart: unless-stopped

  # API Mavi
  mavi-api:
    build:
      context: ${API_DIR}
      dockerfile: Dockerfile
    volumes:
      - ${API_DIR}:/app
    env_file:
      - ${API_DIR}/.env
    environment:
      - ENVIRONMENT=production
      - PYTHONPATH=/app
      - GOOGLE_APPLICATION_CREDENTIALS=/app/credentials-tts.json
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/voice/status"]
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
      context: ${WEB_DIR}
      dockerfile: Dockerfile
    volumes:
      - ${WEB_DIR}/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - mavi-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:80"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  mavi-network:
    driver: bridge
EOF

# Criar script de inicialização
log_info "Criando script de inicialização..."
cat > "${DEPLOY_ROOT}/start.sh" << 'EOF'
#!/bin/bash
set -e

echo "🔄 Parando serviços existentes..."
sudo docker-compose -f /home/ubuntu/mavi-api/docker-compose.yml down 2>/dev/null || true
sudo docker-compose -f /home/ubuntu/mavi-web/docker-compose.yml down 2>/dev/null || true
sudo docker-compose -f /home/ubuntu/mavi-deploy/docker-compose.yml down 2>/dev/null || true

echo "🔍 Verificando necessidade de rebuild..."
if [ -f "/home/ubuntu/mavi-deploy/.rebuild" ]; then
  echo "🏗️ Reconstruindo containers..."
  sudo docker-compose -f /home/ubuntu/mavi-deploy/docker-compose.yml build --no-cache
  rm /home/ubuntu/mavi-deploy/.rebuild
else
  echo "✅ Usando builds existentes"
fi

echo "🚀 Iniciando serviços unificados..."
sudo docker-compose -f /home/ubuntu/mavi-deploy/docker-compose.yml up -d

echo "📊 Status dos containers:"
sudo docker ps | grep -E 'mavi-api|mavi-web|nginx'

echo "🌟 Deploy concluído com sucesso!"
echo "🔗 Você pode acessar:"
echo "   - Interface web: https://$(curl -s ifconfig.me)"
echo "   - API: https://$(curl -s ifconfig.me)/voice/"
echo "   - Documentação da API: https://$(curl -s ifconfig.me)/docs"
EOF

# Tornar executável
chmod +x "${DEPLOY_ROOT}/start.sh"

# Criar script de deploy remoto (para execução local)
log_info "Criando script para deploy remoto..."
cat > "./deploy-to-server.sh" << EOF
#!/bin/bash
set -e

EC2_USER="ubuntu"
EC2_HOST="100.26.31.165"
EC2_KEY="\${1:-mavi-api-server.pem}"

if [ ! -f "\$EC2_KEY" ]; then
  echo "❌ Arquivo de chave SSH não encontrado: \$EC2_KEY"
  echo "📝 Uso: ./deploy-to-server.sh [caminho-para-chave-ssh]"
  exit 1
fi

chmod 400 "\$EC2_KEY"

echo "🔄 Atualizando código no servidor..."
rsync -avz --exclude="node_modules" --exclude="build" -e "ssh -i \$EC2_KEY" ./ \$EC2_USER@\$EC2_HOST:/home/ubuntu/mavi-web/

echo "🔧 Executando deploy unificado..."
ssh -i "\$EC2_KEY" \$EC2_USER@\$EC2_HOST "cd /home/ubuntu/mavi-web && ./unified-deploy.sh"

echo "✅ Deploy concluído com sucesso!"
EOF

chmod +x "./deploy-to-server.sh"

# Verificar se estamos executando no servidor ou localmente
if [ "$(hostname)" = "ip-172-31-18-193" ] || [ -d "/home/ubuntu" ]; then
  log_info "Executando no servidor EC2. Iniciando deploy local..."
  
  # Tocar no arquivo .rebuild para forçar reconstrução na próxima execução
  touch "${DEPLOY_ROOT}/.rebuild"
  
  # Executar o script de inicialização
  "${DEPLOY_ROOT}/start.sh"
else
  log_info "${BLUE}Este script foi preparado para execução no servidor${NC}"
  log_info "Para fazer o deploy remoto a partir desta máquina:"
  log_info "${BLUE}./deploy-to-server.sh caminho-para-chave-ssh.pem${NC}"
fi

log_info "💯 Configuração de deploy unificado concluída!"