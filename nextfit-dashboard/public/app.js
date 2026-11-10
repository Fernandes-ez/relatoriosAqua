// Renderização. Toda a lógica de filtro e contagem fica em /shared/aggregate.js.
import {
  DIMENSOES, FILTROS_VAZIOS, interpretarBusca, filtrarAlunos, contratoPrincipal,
  agregar, resumir, resumoPorModalidade,
} from '/shared/aggregate.js';

const CORES = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#64748b'];
const LIMITE_TABELA = 200;
const el = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat('pt-BR');
const pf = (v) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const dataBr = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR') : '—';
};

const estado = { base: null, grafico: null };

// ---------- Carregamento e erros ----------

function mensagemDeErro(status, corpo) {
  if (status === 401 || status === 403 || corpo.codigo === 'CREDENCIAIS') {
    return 'Credenciais do Next Fit inválidas ou sem permissão. Confira o token configurado no servidor.';
  }
  if (corpo.codigo === 'SEM_TOKEN') return 'Token do Next Fit não configurado no servidor (NEXTFIT_TOKEN).';
  if (corpo.codigo === 'REDE') return 'Falha de conexão com o Next Fit. Tente novamente em instantes.';
  return corpo.erro || `Erro inesperado (${status}).`;
}

function carregando(ligado) {
  el('skeleton').classList.toggle('hidden', !ligado);
  el('conteudo').classList.toggle('hidden', ligado || !estado.base);
  el('btn-atualizar').disabled = ligado;
}

async function carregar({ atualizar = false } = {}) {
  el('erro').classList.add('hidden');
  carregando(true);
  try {
    const resp = await fetch(`/api/base${atualizar ? '?refresh=1' : ''}`);
    const corpo = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(mensagemDeErro(resp.status, corpo));
    estado.base = corpo;
    preencherGrupos(corpo.grupos);
    el('atualizado').textContent = `Atualizado em ${new Date(corpo.geradoEm).toLocaleString('pt-BR')}`;
    el('btn-exportar').disabled = false;
    renderTudo();
  } catch (err) {
    const msg = err instanceof TypeError ? 'Não foi possível falar com o servidor do painel.' : err.message;
    el('erro').textContent = msg;
    el('erro').classList.remove('hidden');
  } finally {
    carregando(false);
  }
}

function preencherGrupos(nomes) {
  const select = el('f-grupo');
  const atual = select.value;
  select.replaceChildren(new Option('Todos', ''), ...[...nomes, 'Outros'].map((n) => new Option(n, n)));
  select.value = atual;
}

// ---------- Filtros (busca livre + controles) ----------
// Se a busca citar uma modalidade/periodicidade, ela prevalece sobre o controle correspondente.

function lerFiltros() {
  const interpretado = interpretarBusca(el('busca').value);
  const um = (id) => (el(id).value ? [el(id).value] : []);
  const modalidades = interpretado.modalidades.length ? interpretado.modalidades : um('f-modalidade');
  const periodicidades = interpretado.periodicidades.length ? interpretado.periodicidades : um('f-periodicidade');
  return {
    ...FILTROS_VAZIOS,
    status: interpretado.status || el('f-status').value,
    texto: interpretado.texto,
    modalidades,
    periodicidades,
    recorrente: interpretado.recorrente || el('f-recorrente').value,
    grupos: um('f-grupo'),
  };
}

function renderInterpretacao(f, interpretado) {
  const itens = [];
  if (interpretado.modalidades.length) itens.push(`Modalidade: ${interpretado.modalidades.join(', ')}`);
  if (interpretado.periodicidades.length) itens.push(`Periodicidade: ${interpretado.periodicidades.join(', ')}`);
  if (interpretado.recorrente) itens.push(`Recorrente: ${interpretado.recorrente === 'sim' ? 'sim' : 'não'}`);
  if (interpretado.status) itens.push(`Status: ${interpretado.status}`);
  if (interpretado.texto) itens.push(`Texto: "${interpretado.texto}"`);
  el('interpretacao').replaceChildren(...itens.map((t) => {
    const chip = document.createElement('span');
    chip.className = 'rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs';
    chip.textContent = t;
    return chip;
  }));
}

// ---------- Renderização ----------

function renderTudo() {
  if (!estado.base) return;
  const interpretado = interpretarBusca(el('busca').value);
  const f = lerFiltros();
  const filtrados = filtrarAlunos(estado.base.alunos, f);

  renderInterpretacao(f, interpretado);
  renderCards(resumir(filtrados, f));
  renderModalidades(resumoPorModalidade(filtrados, f));
  const agg = agregar(filtrados, f, el('dimensao').value);
  renderGrafico(agg);
  renderTabela(filtrados, f);
}

function renderCards(r) {
  el('card-total').textContent = nf.format(r.totalAlunos);
  el('card-ativos').textContent = nf.format(r.alunosAtivos);
  el('card-ativos-pct').textContent = `${pf(r.percentualAtivos)} do filtro`;
  el('card-inativos').textContent = nf.format(r.alunosInativos);
  el('card-contratos').textContent = nf.format(r.contratosAtivos);
  el('card-tipos').textContent = nf.format(r.tiposDeContrato);
  el('card-planos').textContent = `${nf.format(r.planosDistintos)} planos diferentes`;
}

function renderModalidades(lista) {
  el('modalidades').replaceChildren(...lista.map((m) => {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-xl border border-slate-200 p-4 shadow-sm';

    const topo = document.createElement('div');
    topo.className = 'flex items-baseline justify-between';
    const titulo = document.createElement('h3');
    titulo.className = 'font-semibold';
    titulo.textContent = m.modalidade;
    const numero = document.createElement('span');
    numero.className = 'text-2xl font-semibold';
    numero.textContent = `${nf.format(m.alunos)} alunos`;
    topo.append(titulo, numero);

    const sub = document.createElement('p');
    sub.className = 'text-xs text-slate-500 mt-1';
    sub.textContent = `${nf.format(m.contratos)} contratos ativos · ${nf.format(m.planosDistintos)} planos`;

    const detalhes = document.createElement('details');
    detalhes.className = 'mt-2 text-sm';
    const resumo = document.createElement('summary');
    resumo.className = 'cursor-pointer text-blue-700';
    resumo.textContent = 'Ver planos';
    const lista = document.createElement('ul');
    lista.className = 'mt-2 list-disc pl-5 text-slate-700 max-h-40 overflow-y-auto';
    lista.replaceChildren(...m.planos.map((p) => {
      const li = document.createElement('li');
      li.textContent = p;
      return li;
    }));
    detalhes.append(resumo, lista);

    card.append(topo, sub, detalhes);
    return card;
  }));
}

function renderGrafico(agg) {
  const dados = {
    labels: agg.distribuicao.map((d) => d.categoria),
    datasets: [{
      data: agg.distribuicao.map((d) => d.alunos),
      backgroundColor: agg.distribuicao.map((_, i) => CORES[i % CORES.length]),
      borderWidth: 0,
    }],
  };
  const opcoes = {
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const d = agg.distribuicao[ctx.dataIndex];
            return ` ${d.categoria}: ${nf.format(d.alunos)} alunos (${pf(d.percentual)})`;
          },
        },
      },
    },
  };
  if (estado.grafico) {
    estado.grafico.data = dados;
    estado.grafico.options = opcoes;
    estado.grafico.update();
  } else {
    estado.grafico = new Chart(el('grafico'), { type: 'doughnut', data: dados, options: opcoes });
  }
  el('legenda').replaceChildren(...agg.distribuicao.map((d, i) => {
    const li = document.createElement('li');
    li.className = 'flex items-center justify-between gap-3 text-sm';
    const esq = document.createElement('span');
    esq.className = 'flex items-center gap-2';
    const dot = document.createElement('span');
    dot.className = 'inline-block h-3 w-3 rounded-full';
    dot.style.background = CORES[i % CORES.length];
    const nome = document.createElement('span');
    nome.textContent = d.categoria;
    esq.append(dot, nome);
    const valor = document.createElement('span');
    valor.className = 'tabular-nums text-slate-600';
    valor.textContent = `${nf.format(d.alunos)} · ${pf(d.percentual)}`;
    li.append(esq, valor);
    return li;
  }));
}

// Uma linha por aluno, com o contrato principal que casa com o filtro.
function linhasDaTabela(filtrados, f) {
  return filtrados.map((a) => {
    const c = contratoPrincipal(a, f);
    return {
      nome: a.nome,
      plano: c?.plano ?? '—',
      modalidade: c?.modalidade ?? '—',
      periodicidade: c?.periodicidade ?? '—',
      recorrente: c ? (c.recorrente ? 'Sim' : 'Não') : '—',
      grupo: c?.grupo ?? '—',
      status: a.status,
      inicio: c?.inicio ?? null,
      fim: c?.fim ?? null,
    };
  });
}

let linhasAtuais = [];

function renderTabela(filtrados, f) {
  linhasAtuais = linhasDaTabela(filtrados, f);
  const visiveis = linhasAtuais.slice(0, LIMITE_TABELA);
  el('tabela-corpo').replaceChildren(...visiveis.map((l) => {
    const tr = document.createElement('tr');
    tr.className = 'border-t border-slate-100 hover:bg-slate-50';
    const valores = [l.nome, l.plano, l.modalidade, l.periodicidade, l.recorrente, l.grupo, l.status,
      dataBr(l.inicio), dataBr(l.fim)];
    for (const v of valores) {
      const td = document.createElement('td');
      td.className = 'px-4 py-2 whitespace-nowrap';
      td.textContent = v;
      tr.appendChild(td);
    }
    return tr;
  }));
  el('vazio').classList.toggle('hidden', linhasAtuais.length > 0);
  const extra = linhasAtuais.length > LIMITE_TABELA ? ' (o CSV traz todas)' : '';
  el('contador').textContent =
    `Mostrando ${nf.format(visiveis.length)} de ${nf.format(linhasAtuais.length)} alunos${extra}`;
}

// ---------- Exportação ----------

function exportarCsv() {
  const cabecalho = ['Aluno', 'Plano', 'Modalidade', 'Periodicidade', 'Recorrente', 'Grupo', 'Status', 'Início', 'Fim'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const corpo = linhasAtuais.map((l) => [l.nome, l.plano, l.modalidade, l.periodicidade, l.recorrente,
    l.grupo, l.status, dataBr(l.inicio), dataBr(l.fim)].map(esc).join(';'));
  // BOM + ";" para o Excel em português abrir com as colunas separadas.
  const conteudo = `﻿${[cabecalho.map(esc).join(';'), ...corpo].join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `relatorio-alunos-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Eventos ----------

el('busca').addEventListener('input', renderTudo);
['f-status', 'f-modalidade', 'f-periodicidade', 'f-recorrente', 'f-grupo', 'dimensao']
  .forEach((id) => el(id).addEventListener('change', renderTudo));
el('btn-exportar').addEventListener('click', exportarCsv);
el('btn-atualizar').addEventListener('click', () => carregar({ atualizar: true }));

carregar();
