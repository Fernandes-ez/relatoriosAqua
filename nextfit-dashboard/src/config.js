const env = process.env;
const num = (v, padrao) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : padrao);

// Caminhos e nomes de campos são PLACEHOLDERS: confirme no Swagger do Next Fit
// e ajuste pelas variáveis de ambiente (ver README).
export const config = {
  porta: num(env.PORT, 3000),
  baseUrl: env.NEXTFIT_BASE_URL || 'https://integracao.nextfit.com.br',
  token: env.NEXTFIT_TOKEN || '',
  cabecalho: env.NEXTFIT_AUTH_HEADER || 'Authorization',
  esquemaAuth: env.NEXTFIT_AUTH_SCHEME ?? 'Bearer', // '' envia o token puro
  caminhos: {
    alunos: env.NEXTFIT_PATH_ALUNOS || '/api/alunos',
    contratos: env.NEXTFIT_PATH_CONTRATOS || '/api/contratos',
  },
  parametros: {
    pagina: env.NEXTFIT_PARAM_PAGE || 'page',
    tamanho: env.NEXTFIT_PARAM_SIZE || 'pageSize',
  },
  tamanhoPagina: num(env.NEXTFIT_PAGE_SIZE, 100),
  paralelismo: num(env.NEXTFIT_CONCURRENCY, 4),
  maxPaginas: num(env.NEXTFIT_MAX_PAGES, 500),
  timeoutMs: num(env.NEXTFIT_TIMEOUT_MS, 20000),
  cacheMs: num(env.CACHE_TTL_SECONDS, 300) * 1000,
  arquivoGrupos: env.NEXTFIT_GRUPOS_FILE || new URL('./grupos.json', import.meta.url).pathname,
};
