# mohAI Lite Co

> Backend central do sistema **mohAI**: orquestra Eco Pontos, Drones autônomos e Caminhão de IA para coleta inteligente de resíduos urbanos.

---

## Visão geral

O mohAI é um sistema de gerenciamento autônomo de resíduos sólidos. Sensores em **Eco Pontos** monitoram o nível de lixo em tempo real. Quando o nível atinge um limiar configurável, um **Drone** é acionado automaticamente para coletar e levar o lixo à **Estação Central** mais próxima. Quando as estações acumulam carga suficiente, um **Caminhão de IA** planeja a rota otimizada para coletar tudo e levar ao destino final.

---

## Fluxo do sistema

```
Pessoa joga lixo no Eco Ponto
  └─► sensor reporta nível via PATCH /eco-pontos/:id/nivel

        Se nível ≥ limiar (padrão: 70%)
          └─► drone da base é acionado automaticamente
                └─► voa para a Estação Central mais próxima com capacidade

        PUT /drones/:id/entregar
          └─► carga é transferida para a Estação Central
          └─► Eco Ponto é zerado
          └─► drone entra no status "retornando"

        PUT /drones/:id/retornar
          └─► drone volta à base do Eco Ponto (recarregando)

        Estação Central acumula lixo de vários drones ao longo do tempo

        POST /caminhoes/:id/planejar-rota
          └─► IA calcula rota otimizada (algoritmo nearest-neighbor + Haversine)
          └─► visita apenas estações com carga ≥ limiar mínimo configurável

        PUT /caminhoes/:id/coletar/:estacaoId  (por estação)
          └─► lixo é transferido para o caminhão

        PUT /caminhoes/:id/descarregar
          └─► carga descartada no lixão, caminhão fica livre para nova rota
```

---

## Stack técnica

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js |
| Linguagem | TypeScript 5.5 |
| Framework HTTP | Express 4 |
| Validação | Zod 3 |
| IDs | UUID v4 |
| Geolocalização | Fórmula de Haversine (implementação própria) |
| Persistência | JSON em disco (substituível por PostgreSQL/MongoDB) |
| Dev | tsx watch (hot-reload sem build) |

---

## Estrutura do projeto

```
mohai-ts/
├── src/
│   ├── domain/
│   │   ├── types.ts          ← interfaces de todas as entidades (EcoPonto, Drone, EstacaoCentral, Caminhao, Missão)
│   │   └── schemas.ts        ← schemas Zod para validação de request bodies
│   ├── repositories/
│   │   ├── repositorio.ts    ← repositório genérico com persistência JSON (CRUD: salvar, obter, atualizar, listar)
│   │   └── db.ts             ← instâncias de todos os repositórios (singleton)
│   ├── services/
│   │   ├── ecoPontoService.ts      ← CRUD + lógica de nível + acionamento automático de drone
│   │   ├── droneService.ts         ← CRUD + telemetria + ciclo de vida da missão
│   │   ├── estacaoCentralService.ts ← CRUD + consulta de estações prioritárias
│   │   └── caminhaoService.ts      ← CRUD + planejamento de rota (nearest-neighbor) + coleta + descarte
│   ├── routes/
│   │   ├── ecoPontos.ts
│   │   ├── drones.ts
│   │   ├── estacoesCentralis.ts
│   │   ├── caminhao.ts
│   │   └── missoes.ts
│   ├── utils/
│   │   └── geo.ts            ← distanciaKm() via fórmula de Haversine
│   ├── tests/
│   │   └── fluxo.test.ts     ← 18 testes de integração end-to-end (direto nos services, sem HTTP)
│   ├── app.ts                ← Express app com rotas e error handler global
│   └── server.ts             ← ponto de entrada, sobe na porta 3000
└── data/                     ← arquivos JSON gerados em runtime (gitignored)
```

---

## Entidades e estados

### EcoPonto
Ponto de coleta público com sensor de nível.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | Identificador único |
| `nome` | string | Nome do ponto |
| `latitude` / `longitude` | number | Coordenadas GPS |
| `nivelLixo` | number | Percentual de lixo acumulado (0–100%) |
| `limiarAcionamento` | number | Percentual que aciona o drone (padrão: 70%) |
| `dronesNaBase` | string[] | IDs dos drones alocados a este ponto |

### Drone
Veículo aéreo autônomo responsável pela coleta nos Eco Pontos.

| Status | Descrição |
|--------|-----------|
| `carregando` | Na base do Eco Ponto, recarregando bateria |
| `em_missao` | Voando com carga (Eco Ponto → Estação Central) |
| `retornando` | Voltando vazio para a base |
| `manutencao` | Indisponível para missões |
| `bateria_critica` | Abaixo de 15% — não pode voar |

> Drones com bateria abaixo de **30%** não são acionados para novas missões. Abaixo de **15%** entram automaticamente em `bateria_critica` ao receber telemetria.

### Estação Central
Ponto intermediário de acúmulo de lixo recebido dos drones.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `cargaAcumuladaKg` | number | Lixo recebido dos drones (kg) |
| `capacidadeMaxKg` | number | Capacidade máxima (kg) |

### Caminhão de IA

| Status | Descrição |
|--------|-----------|
| `parado` | Aguardando rota |
| `em_rota` | Executando rota planejada |
| `coletando` | Realizando coleta em uma estação |
| `descarregando` | Descartando no lixão |

**Algoritmo de rota:** _nearest-neighbor_ — partindo da posição atual do caminhão, visita sempre a estação com capacidade disponível mais próxima ainda não visitada. Estações excluídas se a coleta ultrapassaria a capacidade do caminhão.

---

## Instalação

```bash
# Clonar e instalar dependências
git clone https://github.com/usemohi/mohAI-Lite-Co
cd mohai-ts
npm install

# Desenvolvimento com hot-reload
npm run dev

# Build de produção
npm run build
npm start

# Testes de integração (18 casos)
npm test
```

O servidor sobe em `http://localhost:3000`.

---

## Endpoints

### Eco Pontos

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/eco-pontos` | Lista todos os Eco Pontos |
| `POST` | `/eco-pontos` | Cria um Eco Ponto |
| `GET` | `/eco-pontos/:id` | Obtém um Eco Ponto por ID |
| `PATCH` | `/eco-pontos/:id/nivel` | **Sensor reporta nível** — aciona drone automaticamente se ≥ limiar |

### Drones

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/drones` | Lista todos os drones |
| `POST` | `/drones` | Cadastra um drone (vincula a um Eco Ponto base) |
| `GET` | `/drones/:id` | Obtém um drone por ID |
| `PATCH` | `/drones/:id/telemetria` | Firmware reporta GPS e bateria (atualiza status se bateria crítica) |
| `PUT` | `/drones/:id/entregar` | **Drone entregou carga** na Estação Central — zera Eco Ponto |
| `PUT` | `/drones/:id/retornar` | **Drone voltou à base** — status muda para `carregando` |

### Estações Centrais

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/estacoes-centrais` | Lista todas as estações |
| `POST` | `/estacoes-centrais` | Cadastra uma estação |
| `GET` | `/estacoes-centrais/:id` | Obtém uma estação por ID |
| `GET` | `/estacoes-centrais/prioritarias?minimo=20` | Estações com carga ≥ X% da capacidade |

### Caminhão de IA

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/caminhoes` | Lista todos os caminhões |
| `POST` | `/caminhoes` | Cadastra um caminhão |
| `GET` | `/caminhoes/:id` | Obtém um caminhão por ID |
| `POST` | `/caminhoes/:id/planejar-rota` | **IA planeja rota otimizada** (nearest-neighbor + Haversine) |
| `PUT` | `/caminhoes/:id/coletar/:estacaoId` | Coleta na estação e atualiza missão ativa |
| `PUT` | `/caminhoes/:id/descarregar` | Descarta no lixão e conclui a missão |

### Missões (histórico)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/missoes/drone` | Histórico completo de missões dos drones |
| `GET` | `/missoes/caminhao` | Histórico completo de missões do caminhão |

---

## Exemplos de uso (curl)

### Configuração inicial

```bash
# 1. Criar um Eco Ponto
curl -X POST http://localhost:3000/eco-pontos \
  -H "Content-Type: application/json" \
  -d '{"id":"ep-1","nome":"Centro","latitude":-23.55,"longitude":-46.63,"nivelLixo":0,"limiarAcionamento":70}'

# 2. Criar uma Estação Central
curl -X POST http://localhost:3000/estacoes-centrais \
  -H "Content-Type: application/json" \
  -d '{"id":"ec-1","nome":"Estação Norte","latitude":-23.54,"longitude":-46.62,"capacidadeMaxKg":500}'

# 3. Cadastrar um drone vinculado ao Eco Ponto
curl -X POST http://localhost:3000/drones \
  -H "Content-Type: application/json" \
  -d '{"id":"d-1","ecoPontoBaseId":"ep-1","latitude":-23.55,"longitude":-46.63,"bateriaPercentual":100,"capacidadeMaxKg":20}'

# 4. Cadastrar um caminhão
curl -X POST http://localhost:3000/caminhoes \
  -H "Content-Type: application/json" \
  -d '{"id":"cam-1","placa":"ABC-1234","latitude":-23.56,"longitude":-46.64,"capacidadeMaxKg":2000}'
```

### Ciclo de coleta dos drones

```bash
# Sensor reporta nível 80% → drone é acionado automaticamente
curl -X PATCH http://localhost:3000/eco-pontos/ep-1/nivel \
  -H "Content-Type: application/json" \
  -d '{"nivelLixo":80}'

# Drone chegou na Estação Central e entregou a carga
curl -X PUT http://localhost:3000/drones/d-1/entregar

# Drone voltou à base e está recarregando
curl -X PUT http://localhost:3000/drones/d-1/retornar
```

### Ciclo do caminhão de IA

```bash
# IA planeja rota otimizada (visita estações com carga ≥ 20% por padrão)
curl -X POST http://localhost:3000/caminhoes/cam-1/planejar-rota

# Coleta na estação
curl -X PUT http://localhost:3000/caminhoes/cam-1/coletar/ec-1

# Descarta no lixão e libera o caminhão
curl -X PUT http://localhost:3000/caminhoes/cam-1/descarregar
```

### Telemetria do drone (firmware)

```bash
# Firmware reporta posição GPS e bateria
curl -X PATCH http://localhost:3000/drones/d-1/telemetria \
  -H "Content-Type: application/json" \
  -d '{"latitude":-23.545,"longitude":-46.625,"bateriaPercentual":72}'
```

---

## Persistência

Os dados ficam em `./data/*.json`, gerados automaticamente em runtime. A pasta é ignorada pelo Git (`.gitignore`).

Para produção, substitua `src/repositories/repositorio.ts` por uma implementação com **PostgreSQL** ou **MongoDB** — os services e rotas não mudam, pois dependem apenas da interface do repositório genérico.

---

## Testes

O arquivo `src/tests/fluxo.test.ts` contém **18 testes de integração** que cobrem o ciclo completo do sistema, chamando os services diretamente (sem overhead de HTTP):

- Criação de entidades com validação de duplicatas
- Acionamento automático de drone ao atingir limiar
- Bloqueio de drones com bateria crítica
- Prevenção de missão dupla no mesmo Eco Ponto
- Ciclo completo drone: coleta → entrega → retorno
- Planejamento de rota do caminhão com nearest-neighbor
- Coleta sequencial em múltiplas estações
- Descarte e conclusão de missão

```bash
npm test
```

---
