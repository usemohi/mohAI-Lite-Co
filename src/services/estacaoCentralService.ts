import { db } from "../repositories/db"
import type { EstacaoCentral } from "../domain/types"
import type { CriarEstacaoCentralDTO } from "../domain/schemas"

export function criarEstacaoCentral(dto: CriarEstacaoCentralDTO): EstacaoCentral {
  if (db.estacoesCentralis.existe(dto.id)) {
    throw new Error(`Estação Central '${dto.id}' já existe`)
  }
  const agora = new Date().toISOString()
  const ec: EstacaoCentral = {
    id: dto.id,
    nome: dto.nome,
    latitude: dto.latitude,
    longitude: dto.longitude,
    cargaAcumuladaKg: 0,
    capacidadeMaxKg: dto.capacidadeMaxKg,
    criadoEm: agora,
    atualizadoEm: agora,
  }
  return db.estacoesCentralis.salvar(ec)
}

export function listarEstacoesCentralis(): EstacaoCentral[] {
  return db.estacoesCentralis.listar()
}

export function obterEstacaoCentral(id: string): EstacaoCentral {
  const ec = db.estacoesCentralis.obter(id)
  if (!ec) throw new Error(`Estação Central '${id}' não encontrada`)
  return ec
}

/** Retorna as estações com carga acima do percentual indicado, ordenadas do mais cheio pro mais vazio */
export function estacoesComCargaPrioritaria(percentualMinimo = 60): EstacaoCentral[] {
  return db.estacoesCentralis
    .listar()
    .filter((e) => e.cargaAcumuladaKg / e.capacidadeMaxKg >= percentualMinimo / 100)
    .sort((a, b) => b.cargaAcumuladaKg / b.capacidadeMaxKg - a.cargaAcumuladaKg / a.capacidadeMaxKg)
}
