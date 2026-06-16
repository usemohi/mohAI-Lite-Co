/**
 * Serviço do Caminhão de IA.
 *
 * Responsabilidades:
 * - CRUD de caminhões
 * - Planejamento automático de rota (visita as Estações Centrais mais cheias primeiro)
 * - Coleta nas estações
 * - Descarte no lixão (zera a carga do caminhão)
 */

import { v4 as uuid } from "uuid"
import { db } from "../repositories/db"
import { distanciaKm } from "../utils/geo"
import type { Caminhao, MissaoCaminhao } from "../domain/types"
import type { CriarCaminhaoDTO } from "../domain/schemas"

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function criarCaminhao(dto: CriarCaminhaoDTO): Caminhao {
  if (db.caminhoes.existe(dto.id)) {
    throw new Error(`Caminhão '${dto.id}' já existe`)
  }
  const agora = new Date().toISOString()
  const c: Caminhao = {
    id: dto.id,
    placa: dto.placa,
    latitude: dto.latitude,
    longitude: dto.longitude,
    status: "parado",
    cargaAtualKg: 0,
    capacidadeMaxKg: dto.capacidadeMaxKg,
    rotaAtual: [],
    criadoEm: agora,
    atualizadoEm: agora,
  }
  return db.caminhoes.salvar(c)
}

export function listarCaminhoes(): Caminhao[] {
  return db.caminhoes.listar()
}

export function obterCaminhao(id: string): Caminhao {
  const c = db.caminhoes.obter(id)
  if (!c) throw new Error(`Caminhão '${id}' não encontrado`)
  return c
}

// ─── Planejamento de rota ─────────────────────────────────────────────────────

export interface PlanoRota {
  caminhao: Caminhao
  missao: MissaoCaminhao
  rotaOrdenada: Array<{ estacaoId: string; nome: string; cargaKg: number; distanciaKm: number }>
}

export function planejarRota(
  caminhaoId: string,
  percentualMinimoEstacao = 20
): PlanoRota {
  const caminhao = db.caminhoes.obter(caminhaoId)
  if (!caminhao) throw new Error(`Caminhão '${caminhaoId}' não encontrado`)
  if (caminhao.status === "em_rota") {
    throw new Error(`Caminhão já está em rota`)
  }

  // Estações com carga acima do mínimo
  const candidatas = db.estacoesCentralis
    .listar()
    .filter(
      (e) => e.cargaAcumuladaKg > 0 &&
        (e.cargaAcumuladaKg / e.capacidadeMaxKg) * 100 >= percentualMinimoEstacao
    )

  if (candidatas.length === 0) {
    throw new Error("Nenhuma Estação Central com carga suficiente para coleta")
  }

  // Ordena por "nearest neighbor" simples: começa da posição atual do caminhão
  // e sempre vai para a estação mais próxima ainda não visitada
  let posAtual = { lat: caminhao.latitude, lon: caminhao.longitude }
  const ordenadas: typeof candidatas = []
  const restantes = [...candidatas]

  while (restantes.length > 0) {
    let melhorIdx = 0
    let menorDist = Infinity
    restantes.forEach((e, i) => {
      const d = distanciaKm(posAtual.lat, posAtual.lon, e.latitude, e.longitude)
      if (d < menorDist) { menorDist = d; melhorIdx = i }
    })
    const [escolhida] = restantes.splice(melhorIdx, 1)
    ordenadas.push(escolhida)
    posAtual = { lat: escolhida.latitude, lon: escolhida.longitude }
  }

  // Garante que não ultrapassa capacidade (corta estações se necessário)
  let cargaAcumulada = caminhao.cargaAtualKg
  const rotaFinal = ordenadas.filter((e) => {
    if (cargaAcumulada + e.cargaAcumuladaKg <= caminhao.capacidadeMaxKg) {
      cargaAcumulada += e.cargaAcumuladaKg
      return true
    }
    return false
  })

  if (rotaFinal.length === 0) {
    throw new Error(`Caminhão sem capacidade para coletar (carga atual: ${caminhao.cargaAtualKg}kg / ${caminhao.capacidadeMaxKg}kg)`)
  }

  const agora = new Date().toISOString()
  const missao: MissaoCaminhao = {
    id: uuid(),
    caminhaoId,
    estacoesCentralIds: rotaFinal.map((e) => e.id),
    cargaColetadaTotalKg: 0,
    status: "em_andamento",
    criadaEm: agora,
    atualizadaEm: agora,
  }
  db.missoesCaminhao.salvar(missao)

  db.caminhoes.atualizar(caminhaoId, {
    status: "em_rota",
    rotaAtual: rotaFinal.map((e) => e.id),
  })

  let posAcum = { lat: caminhao.latitude, lon: caminhao.longitude }
  const rotaOrdenada = rotaFinal.map((e) => {
    const dist = distanciaKm(posAcum.lat, posAcum.lon, e.latitude, e.longitude)
    posAcum = { lat: e.latitude, lon: e.longitude }
    return { estacaoId: e.id, nome: e.nome, cargaKg: e.cargaAcumuladaKg, distanciaKm: Math.round(dist * 10) / 10 }
  })

  return { caminhao: db.caminhoes.obter(caminhaoId)!, missao, rotaOrdenada }
}

// ─── Coletar em uma Estação Central ───────────────────────────────────────────

export interface ResultadoColeta {
  caminhao: Caminhao
  coletadoKg: number
  estacaoId: string
  mensagem: string
}

export function coletarNaEstacao(
  caminhaoId: string,
  estacaoId: string
): ResultadoColeta {
  const caminhao = db.caminhoes.obter(caminhaoId)
  if (!caminhao) throw new Error(`Caminhão '${caminhaoId}' não encontrado`)

  const estacao = db.estacoesCentralis.obter(estacaoId)
  if (!estacao) throw new Error(`Estação Central '${estacaoId}' não encontrada`)

  const coletado = Math.min(
    estacao.cargaAcumuladaKg,
    caminhao.capacidadeMaxKg - caminhao.cargaAtualKg
  )

  if (coletado <= 0) {
    throw new Error(`Caminhão cheio ou estação vazia`)
  }

  // Zera a carga da estação central
  db.estacoesCentralis.atualizar(estacaoId, { cargaAcumuladaKg: 0 })

  // Atualiza a carga do caminhão
  const caminhaoAtualizado = db.caminhoes.atualizar(caminhaoId, {
    cargaAtualKg: caminhao.cargaAtualKg + coletado,
    latitude: estacao.latitude,
    longitude: estacao.longitude,
    status: "coletando",
  }) as Caminhao

  // Atualiza a missão ativa
  const missao = db.missoesCaminhao
    .listar()
    .find((m) => m.caminhaoId === caminhaoId && m.status === "em_andamento")

  if (missao) {
    db.missoesCaminhao.atualizar(missao.id, {
      cargaColetadaTotalKg: missao.cargaColetadaTotalKg + coletado,
    })
  }

  return {
    caminhao: caminhaoAtualizado,
    coletadoKg: coletado,
    estacaoId,
    mensagem: `Coletado ${coletado}kg na Estação '${estacao.nome}'. Carga total: ${caminhaoAtualizado.cargaAtualKg}kg.`,
  }
}

// ─── Descarregar no lixão ─────────────────────────────────────────────────────

export interface ResultadoDescarte {
  caminhao: Caminhao
  cargaDescartadaKg: number
  mensagem: string
}

export function descarregarNoLixao(caminhaoId: string): ResultadoDescarte {
  const caminhao = db.caminhoes.obter(caminhaoId)
  if (!caminhao) throw new Error(`Caminhão '${caminhaoId}' não encontrado`)
  if (caminhao.cargaAtualKg === 0) {
    throw new Error(`Caminhão '${caminhaoId}' está vazio`)
  }

  const cargaDescartada = caminhao.cargaAtualKg

  const caminhaoAtualizado = db.caminhoes.atualizar(caminhaoId, {
    cargaAtualKg: 0,
    status: "parado",
    rotaAtual: [],
  }) as Caminhao

  // Conclui a missão ativa
  const missao = db.missoesCaminhao
    .listar()
    .find((m) => m.caminhaoId === caminhaoId && m.status === "em_andamento")

  if (missao) {
    db.missoesCaminhao.atualizar(missao.id, { status: "concluida" })
  }

  return {
    caminhao: caminhaoAtualizado,
    cargaDescartadaKg: cargaDescartada,
    mensagem: `${cargaDescartada}kg descartados no lixão. Caminhão livre para nova rota.`,
  }
}
