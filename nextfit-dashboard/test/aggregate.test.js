import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  periodicidadeDe, modalidadeDe, modalidadesDe, publicoDe, resumoPorPublico, normalizarAluno, normalizarContrato, montarBase,
  interpretarBusca, filtrarAlunos, agregar, resumir, resumoPorModalidade, SEM_CONTRATO, periodicidadeDeDuracao,
} from '../shared/aggregate.js';
import grupos from '../src/grupos.json' with { type: 'json' };

const base = () => {
  const alunos = [
    { id: '1', nome: 'Ana', situacao: 'Ativo' },
    { id: '2', nome: 'Bruno', ativo: false },
    { id: '3', nome: 'Caio', ativo: true },
    { id: '4', nome: 'Dani', ativo: true },
  ].map(normalizarAluno);
  const contratos = [
    { id: 'a', alunoId: '1', plano: 'Plano Terrestre Mensal Recorrente', status: 'ativo', dataInicio: '2026-01-01' },
    { id: 'b', alunoId: '1', plano: 'Plano Anual', status: 'ativo', dataInicio: '2026-03-01' },
    { id: 'c', alunoId: '2', plano: 'Trimestral Aquática', status: 'inativo', dataInicio: '2025-01-01' },
    { id: 'd', alunoId: '3', plano: 'Semestral Terrestre', status: 'ativo', dataInicio: '2026-02-01' },
    { id: 'e', alunoId: '4', plano: 'Piscina Mensal', status: 'ativo', dataInicio: '2026-02-01' },
  ].map((r) => normalizarContrato(r, grupos));
  return montarBase({ alunos, contratos });
};

test('classifica periodicidade e modalidade', () => {
  assert.equal(periodicidadeDe('Plano Trimestral'), 'Trimestral');
  assert.equal(periodicidadeDe('Semestral'), 'Semestral');
  assert.equal(periodicidadeDe('Anual Premium'), 'Anual');
  assert.equal(periodicidadeDe('Mensal'), 'Mensal');
  assert.equal(periodicidadeDe('Vip'), 'Outros');
  assert.equal(modalidadeDe('Plano Terrestre'), 'Terrestre');
  assert.equal(modalidadeDe('Plano Básico'), 'Terrestre');
  assert.equal(modalidadeDe('Natação Mensal'), 'Aquático');
});

test('plano com duas modalidades conta nas duas', () => {
  assert.deepEqual(modalidadesDe('Musculação + Natação'), ['Terrestre', 'Aquático']);
  assert.deepEqual(modalidadesDe('Terrestre e Aquática'), ['Terrestre', 'Aquático']);
  assert.deepEqual(modalidadesDe('Natação Mensal'), ['Aquático']);
  assert.deepEqual(modalidadesDe('Plano Básico'), ['Terrestre']);
  const c = normalizarContrato({ id: 1, codigoCliente: 9, status: 'Ativo' }, [], new Map([[1, 'Musculação + Natação']]));
  const alunos = montarBase({ alunos: [{ id: '9', nome: 'Gil', ativo: true }], contratos: [c] });
  assert.equal(resumoPorModalidade(alunos, {}).find((m) => m.modalidade === 'Terrestre').alunos, 1);
  assert.equal(filtrarAlunos(alunos, { modalidades: ['Terrestre'] }).length, 1);
});

test('separa planos Kids dos adultos', () => {
  assert.equal(publicoDe('Kids Musculação'), 'Kids');
  assert.equal(publicoDe('Plano Infantil Natação'), 'Kids');
  assert.equal(publicoDe('Musculação Mensal'), 'Adulto');
  const alunos = montarBase({
    alunos: [{ id: '1', nome: 'Lia', ativo: true }, { id: '2', nome: 'Rui', ativo: true }],
    contratos: [
      normalizarContrato({ id: 1, codigoCliente: 1, codigoContratoBase: 1, status: 'Ativo' }, [], new Map([[1, 'Kids Natação']])),
      normalizarContrato({ id: 2, codigoCliente: 2, codigoContratoBase: 2, status: 'Ativo' }, [], new Map([[2, 'Musculação']])),
    ],
  });
  const resumo = resumoPorPublico(alunos, {});
  assert.equal(resumo.find((r) => r.publico === 'Kids').alunos, 1);
  assert.equal(resumo.find((r) => r.publico === 'Adulto').alunos, 1);
  assert.deepEqual(filtrarAlunos(alunos, interpretarBusca('kids')).map((a) => a.nome), ['Lia']);
});

test('grupos juntam periodicidades e recorrência', () => {
  const c = normalizarContrato({ id: 'x', alunoId: '1', plano: 'Anual Recorrente' }, grupos);
  assert.equal(c.recorrente, true);
  assert.equal(c.grupo, 'Recorrente');
  const m = normalizarContrato({ id: 'y', alunoId: '1', plano: 'Plano Mensal' }, grupos);
  assert.equal(m.grupo, 'Mensal');
  const s = normalizarContrato({ id: 'z', alunoId: '1', plano: 'Semestral' }, grupos);
  assert.equal(s.grupo, 'Semestral e trimestral');
});

test('formato real do ContratoCliente: periodicidade pela duração e status', () => {
  assert.equal(periodicidadeDeDuracao('Mes', 1), 'Mensal');
  assert.equal(periodicidadeDeDuracao('Mes', 3), 'Trimestral');
  assert.equal(periodicidadeDeDuracao('Mes', 12), 'Anual');
  const c = normalizarContrato({
    id: 74100573, codigoCliente: 40441872, codigoContratoBase: 1019649, status: 'Ativo',
    tipoDuracao: 'Mes', tempoDuracao: 1, recorrente: true, modalidades: [{ codigoModalidade: 262136 }],
    dataInicio: '2026-11-10T00:00:00', dataValidade: '2027-11-10T00:00:00',
  }, grupos);
  assert.equal(c.alunoId, '40441872');
  assert.equal(c.ativo, true);
  assert.equal(c.periodicidade, 'Mensal');
  assert.equal(c.grupo, 'Recorrente');
  assert.equal(normalizarContrato({ id: 1, codigoCliente: 2, status: 'Bloqueado' }).ativo, false);
  assert.equal(normalizarContrato({ id: 1, codigoCliente: 2, status: 'Cancelado' }).ativo, false);
});

test('aluno ativo é quem tem contrato Ativo, não só cadastro ativo', () => {
  const alunos = [
    { id: '1', nome: 'Com contrato', ativo: true },
    { id: '2', nome: 'Só cadastro', ativo: true },
    { id: '3', nome: 'Contrato bloqueado', ativo: true },
  ].map(normalizarAluno);
  const contratos = [
    normalizarContrato({ id: 1, codigoCliente: 1, status: 'Ativo' }),
    normalizarContrato({ id: 2, codigoCliente: 3, status: 'Bloqueado' }),
  ];
  const base = montarBase({ alunos, contratos });
  assert.deepEqual(base.map((a) => a.status), ['Ativo', 'Inativo', 'Inativo']);
  assert.equal(base[1].cadastroAtivo, true);
});

test('cliente usa inativo e contrato usa a descrição do plano', () => {
  assert.equal(normalizarAluno({ id: 7, nome: 'Eva', inativo: true }).ativo, false);
  assert.equal(normalizarAluno({ id: 8, nome: 'Fabi', inativo: false }).ativo, true);
  const planos = new Map([[1019649, 'Musculação Trimestral']]);
  const c = normalizarContrato({ id: 1, codigoCliente: 7, codigoContratoBase: 1019649, status: 'Ativo', tipoDuracao: 'Mes', tempoDuracao: 3 }, [], planos);
  assert.equal(c.plano, 'Musculação Trimestral');
  assert.equal(c.modalidade, 'Terrestre');
  assert.equal(c.periodicidade, 'Trimestral');
  const n = normalizarContrato({ id: 2, codigoCliente: 7, codigoContratoBase: 1, status: 'Ativo' }, [], new Map([[1, 'Natação Mensal']]));
  assert.equal(n.modalidade, 'Aquático');
});

test('aluno sem situação explícita é ativo só com contrato ativo', () => {
  const alunos = base();
  assert.equal(alunos.find((a) => a.id === '1').status, 'Ativo');
  assert.equal(alunos.find((a) => a.id === '2').status, 'Inativo');
});

test('busca livre interpreta modalidade, periodicidade e recorrência', () => {
  const f = interpretarBusca('terrestre mensal recorrente premium');
  assert.deepEqual(f.modalidades, ['Terrestre']);
  assert.deepEqual(f.periodicidades, ['Mensal']);
  assert.equal(f.recorrente, 'sim');
  assert.equal(f.texto, 'premium');
  assert.equal(interpretarBusca('inativos').status, 'Inativo');
  assert.equal(interpretarBusca('inativos').texto, '');
});

test('conta planos terrestres e combina periodicidades', () => {
  const alunos = base();
  const f = { ...interpretarBusca('terrestre'), status: 'Ativo' };
  const terr = filtrarAlunos(alunos, f);
  const modal = resumoPorModalidade(terr, f);
  const terrestre = modal.find((m) => m.modalidade === 'Terrestre');
  assert.equal(terrestre.alunos, 2); // Ana (mensal) e Caio (semestral)
  assert.equal(terrestre.planosDistintos, 3);

  const longo = filtrarAlunos(alunos, { status: 'Ativo', periodicidades: ['Anual', 'Semestral'] });
  assert.deepEqual(longo.map((a) => a.nome), ['Ana', 'Caio']);
});

test('distribuição soma 100% e usa o contrato principal', () => {
  const alunos = base();
  const agg = agregar(filtrarAlunos(alunos, { status: 'Ativo' }), { status: 'Ativo' }, 'periodicidade');
  const soma = agg.distribuicao.reduce((s, d) => s + d.alunos, 0);
  assert.equal(soma, agg.total);
  // Ana tem Anual (mais recente) como principal, não Mensal.
  assert.equal(agg.distribuicao.find((d) => d.categoria === 'Anual').alunos, 1);
  assert.equal(agg.distribuicao.find((d) => d.categoria === 'Mensal').alunos, 1);
});

test('resumo de contratos e planos distintos', () => {
  const alunos = base();
  const f = { status: 'Ativo' };
  const r = resumir(filtrarAlunos(alunos, f), f);
  assert.equal(r.totalAlunos, 3);
  assert.equal(r.alunosAtivos, 3);
  assert.equal(r.contratosAtivos, 4);
  assert.equal(r.percentualAtivos, 100);
});

test('agrupamento sem contrato ativo', () => {
  const alunos = base();
  const agg = agregar(alunos, { status: '' }, 'grupo');
  assert.ok(agg.distribuicao.every((d) => d.categoria !== undefined));
  assert.ok(SEM_CONTRATO);
});
