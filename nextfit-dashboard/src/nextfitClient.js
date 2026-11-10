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

// Formato confirmado: { temProximaPagina: boolean, items: [...] }, paginado por Skip/Take.
function lerPagina(corpo) {
  if (Array.isArray(corpo)) return { itens: corpo, temProxima: corpo.length >= config.tamanhoPagina };
  const itens = corpo.items ?? corpo.data ?? corpo.results ?? [];
  return {
    itens: Array.isArray(itens) ? itens : [],
    temProxima: corpo.temProximaPagina === true,
  };
}

function deduplicar(itens) {
  const vistos = new Map();
  for (const it of itens) {
    const chave = it.id ?? JSON.stringify(it);
    if (!vistos.has(chave)) vistos.set(chave, it);
  }
  return [...vistos.values()];
}

// Avança Skip de tamanhoPagina em tamanhoPagina enquanto a API indicar próxima página.
export async function buscarTodos(recurso) {
  const caminho = config.caminhos[recurso];
  const itens = [];
  let skip = 0;
  for (let pagina = 0; pagina < config.maxPaginas; pagina++) {
    const r = lerPagina(await chamar(caminho, {
      [config.parametros.skip]: skip,
      [config.parametros.take]: config.tamanhoPagina,
    }));
    itens.push(...r.itens);
    if (!r.temProxima || r.itens.length === 0) break;
    skip += config.tamanhoPagina;
  }
  return deduplicar(itens);
}
