import { fileURLToPath } from 'node:url';

const env = process.env;
const num = (v, padrao) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : padrao);

// Caminhos e nomes de campos são PLACEHOLDERS: confirme no Swagger do Next Fit
// e ajuste pelas variáveis de ambiente (ver README).
export const config = {
  porta: num(env.PORT, 3000),
  baseUrl: env.NEXTFIT_BASE_URL || 'https://integracao.nextfit.com.br',
  token: env.NEXTFIT_TOKEN || '',
  // Confirmado no Swagger: chave no cabeçalho X-Api-Key, sem prefixo.
  cabecalho: env.NEXTFIT_AUTH_HEADER || 'X-Api-Key',
  esquemaAuth: env.NEXTFIT_AUTH_SCHEME ?? '',
  caminhos: {
    // Vazio = alunos são derivados dos contratos (só o código do cliente).
    // Preencha com o endpoint de clientes quando for confirmado no Swagger.
    alunos: env.NEXTFIT_PATH_ALUNOS || '',
    contratos: env.NEXTFIT_PATH_CONTRATOS || '/api/v1/ContratoCliente',
  },
  parametros: {
    skip: env.NEXTFIT_PARAM_SKIP || 'Skip',
    take: env.NEXTFIT_PARAM_TAKE || 'Take',
  },
  tamanhoPagina: num(env.NEXTFIT_PAGE_SIZE, 100),
  maxPaginas: num(env.NEXTFIT_MAX_PAGES, 500),
  timeoutMs: num(env.NEXTFIT_TIMEOUT_MS, 20000),
  cacheMs: num(env.CACHE_TTL_SECONDS, 300) * 1000,
  arquivoGrupos: env.NEXTFIT_GRUPOS_FILE || fileURLToPath(new URL('./grupos.json', import.meta.url)),
};
