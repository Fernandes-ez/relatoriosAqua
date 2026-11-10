import { config } from './config.js';

export class NextFitError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'NextFitError';
    this.status = status;
    this.code = code;
  }
}

function cabecalhos() {
  if (!config.token) {
    throw new NextFitError('Token do Next Fit não configurado (variável NEXTFIT_TOKEN).', 500, 'SEM_TOKEN');
  }
  const valor = config.esquemaAuth ? `${config.esquemaAuth} ${config.token}` : config.token;
  return { [config.cabecalho]: valor, Accept: 'application/json' };
}

async function chamar(caminho, query) {
  const url = new URL(caminho, config.baseUrl);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));

  let resp;
  try {
    resp = await fetch(url, { headers: cabecalhos(), signal: AbortSignal.timeout(config.timeoutMs) });
  } catch (err) {
    if (err instanceof NextFitError) throw err;
    const motivo = err.name === 'TimeoutError' ? 'tempo esgotado' : err.message;
    throw new NextFitError(`Não foi possível conectar ao Next Fit (${motivo}).`, 502, 'REDE');
  }
  if (resp.status === 401 || resp.status === 403) {
    throw new NextFitError('Credenciais inválidas ou sem permissão no Next Fit.', resp.status, 'CREDENCIAIS');
  }
  if (!resp.ok) throw new NextFitError(`O Next Fit respondeu com erro ${resp.status}.`, 502, 'UPSTREAM');
  try {
    return await resp.json();
  } catch {
    throw new NextFitError('A resposta do Next Fit não é JSON válido.', 502, 'JSON');
  }
}

// Aceita array puro ou envelope { items|data|results|content, totalPages }.
function lerPagina(corpo) {
  if (Array.isArray(corpo)) return { itens: corpo, totalPaginas: null };
  const itens = corpo.items ?? corpo.data ?? corpo.results ?? corpo.content ?? [];
  const totalPaginas = corpo.totalPages ?? corpo.totalPaginas ?? corpo.total_pages ?? null;
  return { itens: Array.isArray(itens) ? itens : [], totalPaginas };
}

const paginaDe = async (caminho, n) =>
  lerPagina(await chamar(caminho, { [config.parametros.pagina]: n, [config.parametros.tamanho]: config.tamanhoPagina }));

const emLotes = (lista, tamanho) =>
  Array.from({ length: Math.ceil(lista.length / tamanho) }, (_, i) => lista.slice(i * tamanho, (i + 1) * tamanho));

function deduplicar(itens) {
  const vistos = new Map();
  for (const it of itens) {
    const chave = it.id ?? JSON.stringify(it);
    if (!vistos.has(chave)) vistos.set(chave, it);
  }
  return [...vistos.values()];
}

// Com total de páginas conhecido, busca o restante em lotes paralelos.
// Sem ele, avança sequencialmente enquanto a página vier cheia.
export async function buscarTodos(recurso) {
  const caminho = config.caminhos[recurso];
  const primeira = await paginaDe(caminho, 1);
  const paginas = [primeira.itens];

  if (primeira.totalPaginas) {
    const fim = Math.min(primeira.totalPaginas, config.maxPaginas);
    const restantes = Array.from({ length: Math.max(fim - 1, 0) }, (_, i) => i + 2);
    for (const lote of emLotes(restantes, config.paralelismo)) {
      const respostas = await Promise.all(lote.map((n) => paginaDe(caminho, n)));
      for (const r of respostas) paginas.push(r.itens);
    }
  } else {
    let n = 2;
    let cheia = primeira.itens.length >= config.tamanhoPagina;
    while (cheia && n <= config.maxPaginas) {
      const r = await paginaDe(caminho, n);
      paginas.push(r.itens);
      cheia = r.itens.length >= config.tamanhoPagina;
      n++;
    }
  }
  return deduplicar(paginas.flat());
}
