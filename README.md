# mohAI Backend — v2.0 (TypeScript)

Backend central do sistema mohAI: orquestra Eco Pontos, Drones e Caminhão de IA.

## Fluxo do sistema

```
Pessoa joga lixo no Eco Ponto
  → sensor reporta o nível via PATCH /eco-pontos/:id/nivel
  → ao atingir o limiar (padrão 70%), o drone da base é acionado automaticamente
  → drone voa para a Estação Central mais próxima com capacidade
  → PUT /drones/:id/entregar  — entrega a carga, Eco Ponto zera
  → drone retorna à base: PUT /drones/:id/retornar
  → Estação Central acumula lixo de vários drones
  → Caminhão de IA planeja rota: POST /caminhoes/:id/planejar-rota
  → coleta em cada estação: PUT /caminhoes/:id/coletar/:estacaoId
  → descarta no lixão: PUT /caminhoes/:id/descarregar
```

## Estrutura

```
src/
  domain/
    types.ts          ← interfaces de todas as entidades
    schemas.ts        ← validação Zod dos requests
  repositories/
    repositorio.ts    ← camada genérica JSON (troque por DB em produção)
    db.ts             ← instâncias de todos os repositórios
  services/
    ecoPontoService.ts      ← lógica de nível e acionamento de drone
    droneService.ts         ← ciclo de vida da missão (coleta → entrega → retorno)
    estacaoCentralService.ts
    caminhaoService.ts      ← roteamento por nearest-neighbor, coleta, descarte
  routes/
    ecoPontos.ts
    drones.ts
    estacoesCentralis.ts
    caminhao.ts
    missoes.ts
  utils/
    geo.ts            ← Haversine para distância entre coordenadas
  tests/
    fluxo.test.ts     ← 18 testes de integração (sem HTTP, direto nos services)
  app.ts              ← Express app + error handler
  server.ts           ← ponto de entrada
data/                 ← JSON persistido em disco (gerado em runtime)
```

## Instalação e uso

```bash
npm install
npm run dev        # desenvolvimento com hot-reload (tsx watch)
npm run build      # compila para dist/
npm start          # roda o build
npm test           # 18 testes de integração
```

## Endpoints

### Eco Pontos
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/eco-pontos` | Lista todos |
| POST | `/eco-pontos` | Cria um eco ponto |
| GET | `/eco-pontos/:id` | Obtém um eco ponto |
| PATCH | `/eco-pontos/:id/nivel` | **Sensor reporta nível** — aciona drone se ≥ limiar |

### Drones
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/drones` | Lista todos |
| POST | `/drones` | Cadastra um drone |
| GET | `/drones/:id` | Obtém um drone |
| PATCH | `/drones/:id/telemetria` | Firmware reporta GPS e bateria |
| PUT | `/drones/:id/entregar` | **Drone entregou na Estação Central** |
| PUT | `/drones/:id/retornar` | **Drone voltou à base** (recarregando) |

### Estações Centrais
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/estacoes-centrais` | Lista todas |
| POST | `/estacoes-centrais` | Cadastra uma estação |
| GET | `/estacoes-centrais/:id` | Obtém uma estação |
| GET | `/estacoes-centrais/prioritarias?minimo=20` | Estações com carga ≥ X% |

### Caminhão de IA
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/caminhoes` | Lista todos |
| POST | `/caminhoes` | Cadastra um caminhão |
| GET | `/caminhoes/:id` | Obtém um caminhão |
| POST | `/caminhoes/:id/planejar-rota` | **IA define rota otimizada** (nearest-neighbor) |
| PUT | `/caminhoes/:id/coletar/:estacaoId` | Coleta na estação |
| PUT | `/caminhoes/:id/descarregar` | Descarta no lixão |

### Missões (consulta)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/missoes/drone` | Histórico de missões dos drones |
| GET | `/missoes/caminhao` | Histórico de missões do caminhão |

## Exemplos rápidos

```bash
# 1. Criar eco ponto com drone
curl -X POST http://localhost:3000/eco-pontos \
  -H "Content-Type: application/json" \
  -d '{"id":"ep-1","nome":"Centro","latitude":-23.55,"longitude":-46.63}'

curl -X POST http://localhost:3000/estacoes-centrais \
  -H "Content-Type: application/json" \
  -d '{"id":"ec-1","nome":"Estação Norte","latitude":-23.54,"longitude":-46.62}'

curl -X POST http://localhost:3000/drones \
  -H "Content-Type: application/json" \
  -d '{"id":"d-1","ecoPontoBaseId":"ep-1","latitude":-23.55,"longitude":-46.63}'

# 2. Sensor reporta nível — drone é acionado automaticamente
curl -X PATCH http://localhost:3000/eco-pontos/ep-1/nivel \
  -H "Content-Type: application/json" \
  -d '{"nivelLixo":80}'

# 3. Drone entrega e volta
curl -X PUT http://localhost:3000/drones/d-1/entregar
curl -X PUT http://localhost:3000/drones/d-1/retornar

# 4. Caminhão planeja rota e coleta
curl -X POST http://localhost:3000/caminhoes/cam-1/planejar-rota
curl -X PUT http://localhost:3000/caminhoes/cam-1/coletar/ec-1
curl -X PUT http://localhost:3000/caminhoes/cam-1/descarregar
```

## Persistência

Os dados ficam em `./data/*.json`. Para produção, substitua `src/repositories/repositorio.ts` por uma implementação com PostgreSQL ou MongoDB — os serviços e rotas não mudam.
