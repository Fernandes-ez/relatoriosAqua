import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { buscarTodos, NextFitError } from './nextfitClient.js';
import { normalizarAluno, normalizarContrato, montarBase } from '../shared/aggregate.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(aqui, '..', 'public');
const SHARED_DIR = path.join(aqui, '..', 'shared');
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const grupos = JSON.parse(await readFile(config.arquivoGrupos, 'utf8'));

let cache = { em: 0, dados: null };
let emVoo = null;

// Sem endpoint de clientes configurado, cada código de cliente vira um aluno.
function derivarAlunos(contratosBrutos) {
  const ids = new Set(contratosBrutos.map((c) => c.codigoCliente).filter((v) => v != null));
  return [...ids].map((id) => ({ id, nome: `Cliente ${id}` }));
}

async function gerarBase() {
  const contratosBrutos = await buscarTodos('contratos');
  const alunosBrutos = config.caminhos.alunos ? await buscarTodos('alunos') : derivarAlunos(contratosBrutos);
  return {
    geradoEm: new Date().toISOString(),
    grupos: grupos.map((g) => g.nome),
    alunos: montarBase({
      alunos: alunosBrutos.map(normalizarAluno),
      contratos: contratosBrutos.map((c) => normalizarContrato(c, grupos)),
    }),
  };
}

// Uma única busca por vez; requisições concorrentes reaproveitam a mesma.
async function obterBase({ atualizar }) {
  if (!atualizar && cache.dados && Date.now() - cache.em < config.cacheMs) return cache.dados;
  if (!emVoo) {
    emVoo = gerarBase()
      .then((dados) => {
        cache = { em: Date.now(), dados };
        return dados;
      })
      .finally(() => {
        emVoo = null;
      });
  }
  return emVoo;
}

function enviarJson(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(corpo));
}

async function servirArquivo(res, diretorio, relativo) {
  const arquivo = path.normalize(path.join(diretorio, relativo));
  if (!arquivo.startsWith(diretorio + path.sep)) return enviarJson(res, 400, { erro: 'Caminho inválido' });
  try {
    const conteudo = await readFile(arquivo);
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] ?? 'application/octet-stream' });
    res.end(conteudo);
  } catch {
    enviarJson(res, 404, { erro: 'Não encontrado' });
  }
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method !== 'GET') return enviarJson(res, 405, { erro: 'Método não permitido' });

    if (url.pathname === '/api/health') {
      return enviarJson(res, 200, { ok: true, tokenConfigurado: Boolean(config.token) });
    }
    if (url.pathname === '/api/base') {
      const dados = await obterBase({ atualizar: url.searchParams.get('refresh') === '1' });
      return enviarJson(res, 200, dados);
    }
    if (url.pathname.startsWith('/api/')) return enviarJson(res, 404, { erro: 'Rota não encontrada' });

    if (url.pathname.startsWith('/shared/')) {
      return servirArquivo(res, SHARED_DIR, url.pathname.slice('/shared/'.length));
    }
    const relativo = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    return servirArquivo(res, PUBLIC_DIR, relativo);
  } catch (err) {
    const status = err instanceof NextFitError ? err.status : 500;
    if (status >= 500 && !(err instanceof NextFitError)) console.error(err);
    enviarJson(res, status, { erro: err.message ?? 'Erro interno', codigo: err.code ?? 'INTERNO' });
  }
});

servidor.listen(config.porta, () => console.log(`Dashboard em http://localhost:${config.porta}`));
