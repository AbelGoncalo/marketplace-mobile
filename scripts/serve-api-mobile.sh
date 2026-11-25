#!/usr/bin/env bash
# Inicia a API na rede com os limites de anexos exigidos pelo fluxo de devoluções.
# Uso: bash scripts/serve-api-mobile.sh [/caminho/Teste-api]
set -euo pipefail

# Resolve apenas caminhos do projeto e preserva os ficheiros ini padrão do PHP.
script_directory="$(cd -- "$(dirname -- "$0")" && pwd)"
api_directory="${1:-$script_directory/../../Teste-api}"
if [[ ! -f "$api_directory/artisan" ]]; then
  printf 'A pasta da API deve conter o ficheiro artisan.\n' >&2
  exit 1
fi
cd -- "$api_directory"
# --no-reload preserva PHP_INI_SCAN_DIR no processo PHP filho do Laravel.
# A entrada vazia antes de ':' conserva o diretório ini padrão quando não há configuração prévia.
exec env PHP_INI_SCAN_DIR="${PHP_INI_SCAN_DIR:-}:$script_directory/php-config" \
  php artisan serve --host="${MARKETPLACE_API_HOST:-0.0.0.0}" --port="${MARKETPLACE_API_PORT:-8000}" --tries=1 --no-reload
