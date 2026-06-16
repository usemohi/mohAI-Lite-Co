/**
 * Tipos de domínio do sistema mohAI.
 * 
 * Fluxo central:
 *   Pessoa joga lixo no EcoPonto
 *   → EcoPonto acumula até atingir limite
 *   → Drone (na base do próprio EcoPonto) sai, coleta o lixo, leva à Estação Central mais próxima
 *   → Drone volta à base (EcoPonto de origem) para recarregar
 *   → Caminhão de IA visita Estações Centrais com carga acumulada e leva pro lixão
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

export type StatusDrone =
  | "carregando"      // Na base do EcoPonto, recarregando bateria
  | "em_missao"       // Voando com carga (eco ponto → estação central)
  | "retornando"      // Voltando vazio para a base
  | "manutencao"      // Indisponível
  | "bateria_critica" // Abaixo de 15%, não pode voar

export type StatusCaminhao =
  | "parado"
  | "em_rota"
  | "coletando"
  | "descarregando"

export type StatusMissaoDrone =
  | "pendente"
  | "em_andamento"
  | "entregue"       // Drone entregou na estação central
  | "concluida"      // Drone voltou à base
  | "falha"

export type StatusCaminhaoMissao =
  | "planejada"
  | "em_andamento"
  | "concluida"

// ─── EcoPonto ─────────────────────────────────────────────────────────────────

export interface EcoPonto {
  id: string
  nome: string
  latitude: number
  longitude: number
  /** Nível de lixo acumulado (0–100%) */
  nivelLixo: number
  /** IDs dos drones que têm este eco ponto como base */
  dronesNaBase: string[]
  /** Percentual a partir do qual o drone é acionado (padrão: 70%) */
  limiarAcionamento: number
  criadoEm: string
  atualizadoEm: string
}

// ─── Drone ────────────────────────────────────────────────────────────────────

export interface Drone {
  id: string
  /** EcoPonto onde este drone recarrega e fica em standby */
  ecoPontoBaseId: string
  bateriaPercentual: number
  status: StatusDrone
  latitude: number
  longitude: number
  cargaAtualKg: number
  capacidadeMaxKg: number
  criadoEm: string
  atualizadoEm: string
}

// ─── Estação Central ──────────────────────────────────────────────────────────

export interface EstacaoCentral {
  id: string
  nome: string
  latitude: number
  longitude: number
  /** Lixo acumulado recebido dos drones (kg) */
  cargaAcumuladaKg: number
  capacidadeMaxKg: number
  criadoEm: string
  atualizadoEm: string
}

// ─── Caminhão ────────────────────────────────────────────────────────────────

export interface Caminhao {
  id: string
  placa: string
  latitude: number
  longitude: number
  status: StatusCaminhao
  cargaAtualKg: number
  capacidadeMaxKg: number
  /** Rota atual: lista de IDs de EstacaoCentral */
  rotaAtual: string[]
  criadoEm: string
  atualizadoEm: string
}

// ─── Missão do Drone ─────────────────────────────────────────────────────────

export interface MissaoDrone {
  id: string
  droneId: string
  ecoPontoOrigemId: string
  estacaoCentralDestinoId: string
  cargaColetadaKg: number
  status: StatusMissaoDrone
  criadaEm: string
  atualizadaEm: string
}

// ─── Missão do Caminhão ───────────────────────────────────────────────────────

export interface MissaoCaminhao {
  id: string
  caminhaoId: string
  estacoesCentralIds: string[]
  cargaColetadaTotalKg: number
  status: StatusCaminhaoMissao
  criadaEm: string
  atualizadaEm: string
}
