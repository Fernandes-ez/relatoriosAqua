// Lógica de classificação, filtro e agregação. Roda no servidor e no navegador
// (sem dependências, sem acesso a DOM ou rede).

export const SEM_CONTRATO = 'Sem contrato ativo';
export const PERIODICIDADES = ['Mensal', 'Trimestral', 'Semestral', 'Anual', 'Outros'];
export const MODALIDADES = ['Terrestre', 'Aquático'];
export const DIMENSOES = {
  periodicidade: 'Periodicidade',
  modalidade: 'Modalidade',
  grupo: 'Grupo personalizado',
  plano: 'Plano',
};

export const FILTROS_VAZIOS = {
  status: '', // '' | 'Ativo' | 'Inativo'
  texto: '', // busca livre (nome do aluno ou do plano)
  modalidades: [], // ['Terrestre'] etc. (OU dentro do campo, E entre campos)
  periodicidades: [],
  recorrente: '', // '' | 'sim' | 'nao'
  grupos: [],
};

const semAcento = (t = '') =>
  String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pct = (parte, total) => (total ? Math.round((parte / total) * 1000) / 10 : 0);
const norm = (f = {}) => ({ ...FILTROS_VAZIOS, ...f });
const porInicioDesc = (a, b) => String(b.inicio ?? '').localeCompare(String(a.inicio ?? ''));

// ---------- Classificação de um contrato ----------

export function periodicidadeDe(texto) {
  const t = semAcento(texto);
  if (/trimes/.test(t)) return 'Trimestral';
  if (/semes/.test(t)) return 'Semestral';
  if (/anual/.test(t)) return 'Anual';
  if (/mensal|\bmes\b/.test(t)) return 'Mensal';
  return 'Outros';
}

// Regra: aquático se citar piscina/natação/hidro; caso contrário, terrestre.
export function modalidadeDe(texto) {
  return /aqua|piscina|natac|hidro/.test(semAcento(texto)) ? 'Aquático' : 'Terrestre';
}

// Critérios de grupo: todos os campos informados precisam casar.
export function casaCriterios(contrato, criterios = {}) {
  if (criterios.recorrente !== undefined && contrato.recorrente !== criterios.recorrente) return false;
  if (criterios.periodicidade && !criterios.periodicidade.includes(contrato.periodicidade)) return false;
  if (criterios.modalidade && !criterios.modalidade.includes(contrato.modalidade)) return false;
  if (criterios.texto && !criterios.texto.some((t) => semAcento(contrato.plano).includes(semAcento(t)))) return false;
  return true;
}

export function grupoDoContrato(contrato, grupos = []) {
  const achado = grupos.find((g) => casaCriterios(contrato, g.criterios));
  return achado ? achado.nome : 'Outros';
}

// ---------- Normalização dos dados brutos da API ----------

// PessoaView (Pessoa/GetClientes): nome e inativo (boolean).
export function normalizarAluno(r) {
  const situacao = semAcento(r.situacao ?? r.status ?? '');
  let ativo = null;
  if (typeof r.inativo === 'boolean') ativo = !r.inativo;
  else if (typeof r.ativo === 'boolean') ativo = r.ativo;
  else if (situacao) ativo = /ativ/.test(situacao) && !/inativ/.test(situacao);
  return { id: String(r.id ?? r.codigo), nome: r.nome ?? '—', ativo };
}

// Periodicidade pela duração do contrato (ex.: Mes/1, Mes/3, Mes/12). Null se não der para saber.
export function periodicidadeDeDuracao(tipoDuracao, tempo) {
  const t = semAcento(tipoDuracao);
  const n = Number(tempo);
  if (!t) return null;
  if (/mes/.test(t)) return { 1: 'Mensal', 3: 'Trimestral', 6: 'Semestral', 12: 'Anual' }[n] ?? 'Outros';
  if (/ano/.test(t)) return n === 1 ? 'Anual' : 'Outros';
  return null;
}

// Formato real do ContratoCliente: codigoCliente, status (Ativo/Bloqueado/Cancelado),
// tipoDuracao, tempoDuracao, recorrente, modalidades (IDs), dataInicio, dataValidade.
// Campos antigos (alunoId, plano.nome, situacao) continuam aceitos como fallback.
// planosPorId: Map(codigoContratoBase -> descricao do plano), vindo de ContratoBase.
export function normalizarContrato(r, grupos = [], planosPorId = new Map()) {
  const descricaoPlano = planosPorId.get(r.codigoContratoBase);
  const plano = r.plano?.nome ?? r.nomePlano
    ?? (typeof r.plano === 'string' ? r.plano : descricaoPlano ?? `Contrato base ${r.codigoContratoBase ?? '—'}`);
  const duracao = r.tipoDuracao ? `${r.tempoDuracao ?? ''} ${r.tipoDuracao}` : '';
  const textoPeriodo = `${r.tipo ?? r.tipoContrato ?? ''} ${duracao} ${plano}`;
  const situacao = semAcento(r.situacao ?? r.status ?? '');
  const contrato = {
    id: String(r.id),
    alunoId: String(r.codigoCliente ?? r.alunoId ?? r.idAluno ?? r.aluno?.id),
    plano,
    modalidade: modalidadeDe(`${r.modalidade ?? r.plano?.modalidade ?? ''} ${plano}`),
    periodicidade: periodicidadeDeDuracao(r.tipoDuracao, r.tempoDuracao) ?? periodicidadeDe(textoPeriodo),
    recorrente: r.recorrente === true || /recorr/.test(semAcento(textoPeriodo)),
    ativo: typeof r.ativo === 'boolean' ? r.ativo : /ativ/.test(situacao) && !/inativ/.test(situacao),
    inicio: r.dataInicio ?? r.inicio ?? null,
    fim: r.dataEncerramento ?? r.dataValidade ?? r.dataFim ?? r.fim ?? null,
  };
  contrato.grupo = grupoDoContrato(contrato, grupos);
  return contrato;
}

// Junta alunos e contratos. Aluno sem situação explícita é ativo se tiver contrato ativo.
export function montarBase({ alunos, contratos, grupos = [] }) {
  const porAluno = new Map();
  for (const c of contratos) {
    if (!porAluno.has(c.alunoId)) porAluno.set(c.alunoId, []);
    porAluno.get(c.alunoId).push(c);
  }
  return alunos.map((a) => {
    const cs = porAluno.get(a.id) ?? [];
    const ativo = a.ativo ?? cs.some((c) => c.ativo);
    return { id: a.id, nome: a.nome, status: ativo ? 'Ativo' : 'Inativo', contratos: cs };
  });
}

// ---------- Interpretação da busca livre ----------
// Ex.: "terrestre mensal recorrente premium" vira modalidade=Terrestre,
// periodicidade=Mensal, recorrente=sim e texto="premium".

const REGRAS_BUSCA = [
  { re: /\bterrestres?\b/, aplica: (f) => (f.modalidades = ['Terrestre']) },
  { re: /\b(aquaticos?|aquaticas?|piscina)\b/, aplica: (f) => (f.modalidades = ['Aquático']) },
  { re: /\bmensal(is)?\b/, aplica: (f) => f.periodicidades.push('Mensal') },
  { re: /\btrimestr(al|ais)\b/, aplica: (f) => f.periodicidades.push('Trimestral') },
  { re: /\bsemestr(al|ais)\b/, aplica: (f) => f.periodicidades.push('Semestral') },
  { re: /\banu(al|ais)\b/, aplica: (f) => f.periodicidades.push('Anual') },
  { re: /\brecorrentes?\b/, aplica: (f) => (f.recorrente = 'sim') },
  { re: /\binativos?\b/, aplica: (f) => (f.status = 'Inativo') },
  { re: /\bativos?\b/, aplica: (f) => (f.status = 'Ativo') },
];

export function interpretarBusca(texto = '') {
  const f = norm({ modalidades: [], periodicidades: [] });
  let resto = semAcento(texto);
  for (const { re, aplica } of REGRAS_BUSCA) {
    if (re.test(resto)) {
      aplica(f);
      resto = resto.replace(new RegExp(re.source, 'g'), ' ');
    }
  }
  f.texto = resto.replace(/\s+/g, ' ').trim();
  return f;
}

// ---------- Filtro ----------

// Um contrato casa com o filtro se atender modalidade, periodicidade, recorrência e grupo.
export function contratoCasa(c, filtro = {}) {
  const f = norm(filtro);
  return (
    (!f.modalidades.length || f.modalidades.includes(c.modalidade)) &&
    (!f.periodicidades.length || f.periodicidades.includes(c.periodicidade)) &&
    (f.recorrente === '' || c.recorrente === (f.recorrente === 'sim')) &&
    (!f.grupos.length || f.grupos.includes(c.grupo))
  );
}

// Filtros de contrato consideram apenas contratos ativos.
export function filtrarAlunos(alunos, filtro = {}) {
  const f = norm(filtro);
  const texto = semAcento(f.texto).trim();
  const temFiltroDeContrato = f.modalidades.length || f.periodicidades.length || f.recorrente !== '' || f.grupos.length;
  return alunos.filter((a) => {
    if (f.status && a.status !== f.status) return false;
    if (texto && !semAcento(a.nome).includes(texto) && !a.contratos.some((c) => semAcento(c.plano).includes(texto))) {
      return false;
    }
    if (temFiltroDeContrato) return a.contratos.some((c) => c.ativo && contratoCasa(c, f));
    return true;
  });
}

// Contrato que representa o aluno na tabela e no gráfico: o ativo mais recente que casa com o filtro.
export function contratoPrincipal(aluno, filtro = {}) {
  const f = norm(filtro);
  return aluno.contratos.filter((c) => c.ativo && contratoCasa(c, f)).sort(porInicioDesc)[0] ?? null;
}

// ---------- Agregação ----------

// Cada aluno entra em exatamente uma fatia, então os percentuais somam 100%.
export function agregar(alunosFiltrados, filtro = {}, dimensao = 'periodicidade') {
  const f = norm(filtro);
  const contagem = new Map();
  for (const a of alunosFiltrados) {
    const p = contratoPrincipal(a, f);
    const chave = p ? p[dimensao] : SEM_CONTRATO;
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }
  const total = alunosFiltrados.length;
  const distribuicao = [...contagem]
    .map(([categoria, alunos]) => ({ categoria, alunos, percentual: pct(alunos, total) }))
    .sort((x, y) => y.alunos - x.alunos);
  return { dimensao, total, distribuicao };
}

export function resumir(alunosFiltrados, filtro = {}) {
  const f = norm(filtro);
  const ativos = alunosFiltrados.filter((a) => a.status === 'Ativo').length;
  const contratos = alunosFiltrados.flatMap((a) => a.contratos.filter((c) => c.ativo && contratoCasa(c, f)));
  return {
    totalAlunos: alunosFiltrados.length,
    alunosAtivos: ativos,
    alunosInativos: alunosFiltrados.length - ativos,
    percentualAtivos: pct(ativos, alunosFiltrados.length),
    contratosAtivos: contratos.length,
    tiposDeContrato: new Set(contratos.map((c) => c.periodicidade)).size,
    planosDistintos: new Set(contratos.map((c) => c.plano)).size,
  };
}

// Resposta direta para perguntas como "quantos alunos em planos terrestres?".
// Um aluno com contratos nas duas modalidades aparece nas duas linhas.
export function resumoPorModalidade(alunosFiltrados, filtro = {}) {
  const f = norm(filtro);
  return MODALIDADES.map((modalidade) => {
    const cs = alunosFiltrados.flatMap((a) =>
      a.contratos
        .filter((c) => c.ativo && c.modalidade === modalidade && contratoCasa(c, f))
        .map((c) => ({ alunoId: a.id, plano: c.plano })),
    );
    const planos = [...new Set(cs.map((c) => c.plano))].sort((x, y) => x.localeCompare(y, 'pt-BR'));
    return {
      modalidade,
      alunos: new Set(cs.map((c) => c.alunoId)).size,
      contratos: cs.length,
      planosDistintos: planos.length,
      planos,
    };
  });
}
