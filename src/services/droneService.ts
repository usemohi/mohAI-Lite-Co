/**
 * Serviço do Drone — ciclo de vida completo de uma missão:
 *
 *   [carregando na base]
 *       ↓ EcoPonto atinge limiar
 *   [em_missao] → voa para Estação Central
 *       ↓ PUT /drones/:id/entregar
 *   [retornando] → volta para o EcoPonto base
 *       ↓ PUT /drones/:id/retornar
 *   [carregando] → recarrega para a próxima missão
 */

import { db } from "../repositories/db"
import type { Drone } from "../domain/types"
import type { CriarDroneDTO, TelemetriaDroneDTO } from "../domain/schemas"

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function criarDrone(dto: CriarDroneDTO): Drone {
  if (db.drones.existe(dto.id)) {
    throw new Error(`Drone '${dto.id}' já existe`)
  }
  if (!db.ecoPontos.existe(dto.ecoPontoBaseId)) {
    throw new Error(`EcoPonto base '${dto.ecoPontoBaseId}' não encontrado`)
  }

  const agora = new Date().toISOString()
  const drone: Drone = {
    id: dto.id,
    ecoPontoBaseId: dto.ecoPontoBaseId,
    bateriaPercentual: dto.bateriaPercentual,
    status: "carregando",
    latitude: dto.latitude,
    longitude: dto.longitude,
    cargaAtualKg: 0,
    capacidadeMaxKg: dto.capacidadeMaxKg,
    criadoEm: agora,
    atualizadoEm: agora,
  }

  // Registra o drone na lista do eco ponto
  const ep = db.ecoPontos.obter(dto.ecoPontoBaseId)!
  db.ecoPontos.atualizar(dto.ecoPontoBaseId, {
    dronesNaBase: [...ep.dronesNaBase, dto.id],
  })

  return db.drones.salvar(drone)
}

export function listarDrones(): Drone[] {
  return db.drones.listar()
}

export function obterDrone(id: string): Drone {
  const d = db.drones.obter(id)
  if (!d) throw new Error(`Drone '${id}' não encontrado`)
  return d
}

// ─── Telemetria (o firmware do drone reporta posição e bateria) ───────────────

export function atualizarTelemetria(id: string, dto: TelemetriaDroneDTO): Drone {
  const drone = db.drones.obter(id)
  if (!drone) throw new Error(`Drone '${id}' não encontrado`)

  const parcial: Partial<Drone> = {}
  if (dto.bateriaPercentual !== undefined) parcial.bateriaPercentual = dto.bateriaPercentual
  if (dto.latitude !== undefined) parcial.latitude = dto.latitude
  if (dto.longitude !== undefined) parcial.longitude = dto.longitude

  // Bateria crítica — marca como indisponível
  if (dto.bateriaPercentual !== undefined && dto.bateriaPercentual < 15) {
    parcial.status = "bateria_critica"
  }

  return db.drones.atualizar(id, parcial) as Drone
}

// ─── Entregar carga na Estação Central ────────────────────────────────────────

export interface ResultadoEntrega {
  drone: Drone
  mensagem: string
  cargaEntregueKg: number
}

export function entregarNaEstacaoCentral(droneId: string): ResultadoEntrega {
  const drone = db.drones.obter(droneId)
  if (!drone) throw new Error(`Drone '${droneId}' não encontrado`)
  if (drone.status !== "em_missao") {
    throw new Error(`Drone '${droneId}' não está em missão (status: ${drone.status})`)
  }

  // Encontra a missão ativa deste drone
  const missao = db.missoesDrone
    .listar()
    .find((m) => m.droneId === droneId && m.status === "em_andamento")

  if (!missao) {
    throw new Error(`Nenhuma missão em andamento para o drone '${droneId}'`)
  }

  const cargaEntregue = drone.cargaAtualKg

  // Acumula na Estação Central
  const estacao = db.estacoesCentralis.obter(missao.estacaoCentralDestinoId)
  if (estacao) {
    db.estacoesCentralis.atualizar(estacao.id, {
      cargaAcumuladaKg: estacao.cargaAcumuladaKg + cargaEntregue,
    })
  }

  // Atualiza a missão
  db.missoesDrone.atualizar(missao.id, { status: "entregue" })

  // Drone: vazio, retornando à base
  const droneAtualizado = db.drones.atualizar(droneId, {
    status: "retornando",
    cargaAtualKg: 0,
  }) as Drone

  // Zera o nível do eco ponto (foi coletado)
  db.ecoPontos.atualizar(missao.ecoPontoOrigemId, { nivelLixo: 0 })

  return {
    drone: droneAtualizado,
    cargaEntregueKg: cargaEntregue,
    mensagem: `Entregue ${cargaEntregue}kg na Estação '${estacao?.nome ?? missao.estacaoCentralDestinoId}'. Drone retornando à base.`,
  }
}

// ─── Confirmar retorno à base ─────────────────────────────────────────────────

export function confirmarRetorno(droneId: string): Drone {
  const drone = db.drones.obter(droneId)
  if (!drone) throw new Error(`Drone '${droneId}' não encontrado`)
  if (drone.status !== "retornando") {
    throw new Error(`Drone '${droneId}' não está retornando (status: ${drone.status})`)
  }

  // Conclui a missão
  const missao = db.missoesDrone
    .listar()
    .find((m) => m.droneId === droneId && m.status === "entregue")

  if (missao) {
    db.missoesDrone.atualizar(missao.id, { status: "concluida" })
  }

  // Drone: de volta na base, recarregando
  const ep = db.ecoPontos.obter(drone.ecoPontoBaseId)
  return db.drones.atualizar(droneId, {
    status: "carregando",
    latitude: ep?.latitude ?? drone.latitude,
    longitude: ep?.longitude ?? drone.longitude,
  }) as Drone
}
