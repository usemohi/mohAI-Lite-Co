/**
 * Serviço do EcoPonto.
 *
 * Responsabilidades:
 * - CRUD de eco pontos
 * - Atualizar nível de lixo acumulado
 * - Acionar automaticamente o drone quando o nível atinge o limiar
 */

import { v4 as uuid } from "uuid"
import { db } from "../repositories/db"
import { distanciaKm } from "../utils/geo"
import type { EcoPonto, MissaoDrone } from "../domain/types"
import type { CriarEcoPontoDTO, AtualizarNivelEcoPontoDTO } from "../domain/schemas"

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function criarEcoPonto(dto: CriarEcoPontoDTO): EcoPonto {
  if (db.ecoPontos.existe(dto.id)) {
    throw new Error(`EcoPonto '${dto.id}' já existe`)
  }
  const agora = new Date().toISOString()
  const ep: EcoPonto = {
    id: dto.id,
    nome: dto.nome,
    latitude: dto.latitude,
    longitude: dto.longitude,
    nivelLixo: dto.nivelLixo,
    limiarAcionamento: dto.limiarAcionamento,
    dronesNaBase: [],
    criadoEm: agora,
    atualizadoEm: agora,
  }
  return db.ecoPontos.salvar(ep)
}

export function listarEcoPontos(): EcoPonto[] {
  return db.ecoPontos.listar()
}

export function obterEcoPonto(id: string): EcoPonto {
  const ep = db.ecoPontos.obter(id)
  if (!ep) throw new Error(`EcoPonto '${id}' não encontrado`)
  return ep
}

// ─── Atualização de nível (endpoint principal dos sensores) ───────────────────

export interface ResultadoAtualizacaoNivel {
  ecoPonto: EcoPonto
  missaoAcionada: MissaoDrone | null
  mensagem: string
}

export function atualizarNivel(
  id: string,
  dto: AtualizarNivelEcoPontoDTO
): ResultadoAtualizacaoNivel {
  const ep = db.ecoPontos.obter(id)
  if (!ep) throw new Error(`EcoPonto '${id}' não encontrado`)

  const atualizado = db.ecoPontos.atualizar(id, {
    nivelLixo: dto.nivelLixo,
  }) as EcoPonto

  // Se ainda não atingiu o limiar, apenas registra
  if (dto.nivelLixo < ep.limiarAcionamento) {
    return {
      ecoPonto: atualizado,
      missaoAcionada: null,
      mensagem: `Nível atualizado para ${dto.nivelLixo}%. Abaixo do limiar de ${ep.limiarAcionamento}%.`,
    }
  }

  // Verifica se já existe missão em andamento para este eco ponto
  const missaoAtiva = db.missoesDrone
    .listar()
    .find(
      (m) =>
        m.ecoPontoOrigemId === id &&
        (m.status === "pendente" || m.status === "em_andamento")
    )

  if (missaoAtiva) {
    return {
      ecoPonto: atualizado,
      missaoAcionada: null,
      mensagem: `Nível em ${dto.nivelLixo}%, mas já existe missão '${missaoAtiva.id}' em andamento.`,
    }
  }

  // Aciona o drone disponível na base deste eco ponto
  const missao = acionarDroneDaBase(atualizado)
  if (!missao) {
    return {
      ecoPonto: atualizado,
      missaoAcionada: null,
      mensagem: `Nível crítico (${dto.nivelLixo}%), mas nenhum drone disponível na base.`,
    }
  }

  return {
    ecoPonto: atualizado,
    missaoAcionada: missao,
    mensagem: `Limiar atingido! Drone '${missao.droneId}' acionado → Estação Central '${missao.estacaoCentralDestinoId}'.`,
  }
}

// ─── Lógica de acionamento ────────────────────────────────────────────────────

function acionarDroneDaBase(ep: EcoPonto): MissaoDrone | null {
  // 1. Drone disponível com bateria suficiente na base deste eco ponto
  const drone = db.drones
    .listar()
    .find(
      (d) =>
        d.ecoPontoBaseId === ep.id &&
        d.status === "carregando" &&
        d.bateriaPercentual >= 30
    )

  if (!drone) return null

  // 2. Estação Central mais próxima com capacidade disponível
  const estacao = db.estacoesCentralis
    .listar()
    .filter((e) => e.cargaAcumuladaKg < e.capacidadeMaxKg)
    .sort(
      (a, b) =>
        distanciaKm(ep.latitude, ep.longitude, a.latitude, a.longitude) -
        distanciaKm(ep.latitude, ep.longitude, b.latitude, b.longitude)
    )[0]

  if (!estacao) return null

  // 3. Cria a missão
  const agora = new Date().toISOString()
  const missao: MissaoDrone = {
    id: uuid(),
    droneId: drone.id,
    ecoPontoOrigemId: ep.id,
    estacaoCentralDestinoId: estacao.id,
    cargaColetadaKg: drone.capacidadeMaxKg, // coleta tudo que consegue carregar
    status: "em_andamento",
    criadaEm: agora,
    atualizadaEm: agora,
  }
  db.missoesDrone.salvar(missao)

  // 4. Atualiza o drone: em missão, carregado, na posição do eco ponto (decolando)
  db.drones.atualizar(drone.id, {
    status: "em_missao",
    cargaAtualKg: drone.capacidadeMaxKg,
  })

  return missao
}
