# Dashboard Next Fit: alunos e contratos

Painel administrativo que consulta alunos e contratos na API do Next Fit e mostra:

- total de alunos, ativos e inativos;
- distribuição por tipo de contrato (periodicidade, modalidade, grupo personalizado ou plano);
- contagem por modalidade (ex.: quantos alunos em planos **terrestres**), com a lista de planos;
- tabela filtrável, com exportação em CSV (abre no Excel com as colunas separadas).

## Arquitetura

```
Navegador (public/)  ──►  Servidor Node (src/)  ──►  API Next Fit
  render + gráfico        proxy: token, paginação,      (token nunca sai do servidor)
  filtros e CSV           cache de 5 min
        ▲
        └── shared/aggregate.js (mesma lógica no servidor e no navegador)
```

- **Proxy no backend.** O token fica só no servidor (não vai para o navegador) e o CORS deixa de ser problema.
- **Sem dependências.** Servidor com módulos nativos do Node 20+. Front com Tailwind e Chart.js via CDN.
- **`shared/aggregate.js`** classifica contratos (periodicidade, modalidade, recorrência, grupo), interpreta a busca e agrega. Não depende de rede nem de DOM, e é testado com `node --test`.

## Como rodar

```bash
export NEXTFIT_TOKEN="seu-token-da-academia"
export NEXTFIT_PATH_ALUNOS="/caminho/real/alunos"        # confirme no Swagger
export NEXTFIT_PATH_CONTRATOS="/caminho/real/contratos"  # confirme no Swagger
npm start
# abra http://localhost:3000
```

Variáveis principais (todas opcionais, exceto o token):

| Variável | Padrão | Para que serve |
|---|---|---|
| `NEXTFIT_TOKEN` | — | Token de API fornecido pela academia |
| `NEXTFIT_BASE_URL` | `https://integracao.nextfit.com.br` | Host da API |
| `NEXTFIT_AUTH_HEADER` / `NEXTFIT_AUTH_SCHEME` | `X-Api-Key` / (vazio) | Como o token é enviado (confirmado no Swagger) |
| `NEXTFIT_PATH_CONTRATOS` | `/api/v1/ContratoCliente` | Endpoint de contratos (confirmado no Swagger) |
| `NEXTFIT_PATH_ALUNOS` | `/api/v1/Pessoa/GetClientes` | Clientes (nome e situação) |
| `NEXTFIT_PATH_PLANOS` | `/api/v1/ContratoBase` | Catálogo de planos (nome = `descricao`) |
| `NEXTFIT_PARAM_SKIP` / `NEXTFIT_PARAM_TAKE` | `Skip` / `Take` | Paginação da API (`temProximaPagina`) |
| `NEXTFIT_PAGE_SIZE`, `NEXTFIT_MAX_PAGES` | 100 / 500 | Tamanho da página e limite de páginas |
| `NEXTFIT_GRUPOS_FILE` | `src/grupos.json` | Grupos personalizados (ver abaixo) |
| `CACHE_TTL_SECONDS` | 300 | Tempo de cache da base |

> **Importante:** no ambiente em que este código foi escrito, o host `integracao.nextfit.com.br` estava bloqueado, então os caminhos, nomes de campos e paginação **não foram validados contra a API real**. Confirme no Swagger antes de usar em produção. Os campos são lidos com fallbacks em `shared/aggregate.js` (`normalizarAluno`, `normalizarContrato`) e `src/nextfitClient.js` (`lerPagina`).

## Como os dados são classificados

- **Periodicidade** vem do tipo ou do nome do plano: Mensal, Trimestral, Semestral, Anual ou Outros.
- **Modalidade:** planos com "aquática", "piscina", "natação" ou "hidro" são **Aquático**. Os demais são **Terrestre**. Se a API trouxer um campo de modalidade, ele é usado primeiro.
- **Recorrente:** campo booleano da API ou a palavra "recorrente" no nome.
- **Grupo personalizado:** `src/grupos.json`, avaliado na ordem. O primeiro grupo cujos critérios casam vence. Exemplo:

```json
{ "nome": "Longo prazo", "criterios": { "periodicidade": ["Anual", "Semestral"] } }
```

- **Aluno ativo:** campo de situação da API. Se não houver, é ativo quando tem contrato ativo.
- **Contrato principal:** cada aluno aparece em uma única fatia do gráfico (o contrato ativo mais recente que casa com o filtro), então os percentuais somam 100%.
- **Filtros de contrato** consideram só contratos ativos. Um aluno com contratos em duas modalidades aparece nas duas linhas do resumo por modalidade.

## Busca inteligente

A caixa de busca entende as palavras-chave e mostra o que interpretou:

| Digite | Interpretação |
|---|---|
| `terrestre` / `aquático` | Modalidade |
| `mensal`, `trimestral`, `semestral`, `anual` | Periodicidade |
| `recorrente` | Recorrente = sim |
| `ativos` / `inativos` | Status |
| qualquer outra palavra | Texto livre (nome do aluno ou do plano) |

Exemplo: `terrestre mensal recorrente premium` mostra os alunos com contrato terrestre, mensal, recorrente e com "premium" no nome do plano.

## Testes

```bash
npm test
```

## Limitações conhecidas

- A base inteira é carregada na memória do servidor. Para academias muito grandes, vale paginar sob demanda ou guardar o cache em disco.
- A exportação é em CSV. XLSX pode ser adicionado com uma biblioteca como SheetJS.
