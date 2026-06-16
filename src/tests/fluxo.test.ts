/**
 * Testa o fluxo completo do sistema, sem servidor HTTP.
 * Chama os serviços diretamente para máxima velocidade.
 */

process.env["DATA_DIR"] = "/tmp/mohai-test-data"

import fs from "fs"
import path from "path"

// Limpa dados de testes anteriores
const testDir = "/tmp/mohai-test-data"
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true })
}
fs.mkdirSync(testDir, { recursive: true })

import * as ecoPontoSvc from "../services/ecoPontoService"
import * as droneSvc from "../services/droneService"
import * as estacaoSvc from "../services/estacaoCentralService"
import * as caminhaoSvc from "../services/caminhaoService"

let passou = 0
let falhou = 0

function testar(nome: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✅ ${nome}`)
    passou++
  } catch (e) {
    console.log(`  ❌ ${nome}: ${e instanceof Error ? e.message : e}`)
    falhou++
  }
}

function assertEq<T>(real: T, esperado: T, campo = "") {
  if (real !== esperado) {
    throw new Error(`${campo}: esperado '${esperado}', obteve '${real}'`)
  }
}

function assertTrue(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n🧪 mohAI Backend — Testes de Integração\n")

// ─── Setup: cria as entidades base ────────────────────────────────────────────
console.log("📦 Setup inicial...")

const ec1 = estacaoSvc.criarEstacaoCentral({
  id: "ec-norte", nome: "Estação Norte",
  latitude: -31.74, longitude: -52.30,
  capacidadeMaxKg: 5000,
})
const ec2 = estacaoSvc.criarEstacaoCentral({
  id: "ec-sul", nome: "Estação Sul",
  latitude: -31.80, longitude: -52.35,
  capacidadeMaxKg: 5000,
})

const ep1 = ecoPontoSvc.criarEcoPonto({
  id: "ep-centro", nome: "Eco Ponto Centro",
  latitude: -31.76, longitude: -52.33,
  nivelLixo: 0,
  limiarAcionamento: 70,
})

const drone1 = droneSvc.criarDrone({
  id: "drone-01",
  ecoPontoBaseId: "ep-centro",
  latitude: -31.76, longitude: -52.33,
  bateriaPercentual: 95,
  capacidadeMaxKg: 8,
})

const caminhao1 = caminhaoSvc.criarCaminhao({
  id: "cam-01",
  placa: "ABC-1234",
  latitude: -31.77, longitude: -52.32,
  capacidadeMaxKg: 10000,
})

console.log("  ✔ Entidades criadas\n")

// ═══════════════════════════════════════════════════════════════════════════════
console.log("🔹 FLUXO 1: Eco Ponto acionamento de drone\n")

testar("Nível abaixo do limiar não aciona drone", () => {
  const resultado = ecoPontoSvc.atualizarNivel("ep-centro", { nivelLixo: 50 })
  assertEq(resultado.missaoAcionada, null, "missaoAcionada")
  assertTrue(resultado.mensagem.includes("Abaixo"), resultado.mensagem)
})

testar("Nível acima do limiar aciona drone", () => {
  const resultado = ecoPontoSvc.atualizarNivel("ep-centro", { nivelLixo: 75 })
  assertTrue(resultado.missaoAcionada !== null, "missão deveria ter sido criada")
  assertEq(resultado.missaoAcionada!.droneId, "drone-01", "droneId")
  assertEq(resultado.missaoAcionada!.ecoPontoOrigemId, "ep-centro", "ecoPontoOrigemId")
  assertEq(resultado.missaoAcionada!.status, "em_andamento", "status da missão")
})

testar("Drone muda para em_missao após acionamento", () => {
  const drone = droneSvc.obterDrone("drone-01")
  assertEq(drone.status, "em_missao", "status do drone")
  assertEq(drone.cargaAtualKg, 8, "carga (capacidade máxima)")
})

testar("Segunda atualização de nível não cria nova missão (já existe uma)", () => {
  const resultado = ecoPontoSvc.atualizarNivel("ep-centro", { nivelLixo: 80 })
  assertEq(resultado.missaoAcionada, null, "não deveria criar segunda missão")
  assertTrue(resultado.mensagem.includes("já existe"), resultado.mensagem)
})

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n🔹 FLUXO 2: Drone entrega e retorno\n")

testar("Drone entrega carga na Estação Central mais próxima", () => {
  const resultado = droneSvc.entregarNaEstacaoCentral("drone-01")
  assertEq(resultado.drone.status, "retornando", "status do drone após entrega")
  assertEq(resultado.drone.cargaAtualKg, 0, "carga zerada após entrega")
  assertTrue(resultado.cargaEntregueKg === 8, `esperado 8kg, obteve ${resultado.cargaEntregueKg}`)
})

testar("Estação Central acumulou a carga entregue pelo drone", () => {
  // A estação mais próxima de ep-centro é ec-norte (distância menor)
  const ec = estacaoSvc.listarEstacoesCentralis().find((e) => e.cargaAcumuladaKg > 0)
  assertTrue(ec !== undefined, "nenhuma estação com carga acumulada")
  assertEq(ec!.cargaAcumuladaKg, 8, "cargaAcumuladaKg")
})

testar("Eco Ponto zerou o nível após coleta", () => {
  const ep = ecoPontoSvc.obterEcoPonto("ep-centro")
  assertEq(ep.nivelLixo, 0, "nivelLixo deve ser 0 após coleta")
})

testar("Drone confirma retorno à base — status volta para carregando", () => {
  const drone = droneSvc.confirmarRetorno("drone-01")
  assertEq(drone.status, "carregando", "status após retorno")
})

testar("Missão de drone conclui após retorno", () => {
  const { db } = require("../repositories/db")
  const missao = db.missoesDrone.listar().find((m: any) => m.droneId === "drone-01")
  assertEq(missao?.status, "concluida", "status da missão")
})

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n🔹 FLUXO 3: Caminhão de IA — rota e descarte\n")

testar("Planejar rota falha quando não há estações com carga suficiente", () => {
  // Adiciona outra estação vazia para garantir que a carga de 8kg é relevante
  // com percentualMinimo=50 (50% de 5000 = 2500kg > 8kg), deve falhar
  try {
    caminhaoSvc.planejarRota("cam-01", 50)
    throw new Error("Deveria ter lançado erro")
  } catch (e) {
    assertTrue(
      (e as Error).message.includes("Nenhuma Estação Central"),
      (e as Error).message
    )
  }
})

testar("Planejar rota com percentual mínimo baixo encontra a estação com carga", () => {
  const plano = caminhaoSvc.planejarRota("cam-01", 0.1) // qualquer carga
  assertTrue(plano.rotaOrdenada.length > 0, "rota deve ter pelo menos 1 estação")
  assertEq(plano.missao.status, "em_andamento", "status da missão do caminhão")
})

testar("Caminhão coleta na Estação Central", () => {
  const estacaoComCarga = estacaoSvc.listarEstacoesCentralis().find((e) => e.cargaAcumuladaKg > 0)
  assertTrue(estacaoComCarga !== undefined, "deve existir estação com carga")
  const resultado = caminhaoSvc.coletarNaEstacao("cam-01", estacaoComCarga!.id)
  assertEq(resultado.coletadoKg, 8, "deve ter coletado 8kg")
})

testar("Estação Central está vazia após coleta do caminhão", () => {
  const todasVazias = estacaoSvc.listarEstacoesCentralis().every((e) => e.cargaAcumuladaKg === 0)
  assertTrue(todasVazias, "todas as estações devem estar vazias")
})

testar("Caminhão descarrega no lixão e fica vazio", () => {
  const resultado = caminhaoSvc.descarregarNoLixao("cam-01")
  assertEq(resultado.caminhao.cargaAtualKg, 0, "carga zerada")
  assertEq(resultado.caminhao.status, "parado", "status parado")
  assertEq(resultado.cargaDescartadaKg, 8, "deve ter descartado 8kg")
})

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n🔹 FLUXO 4: Telemetria do drone\n")

testar("Drone reporta telemetria de bateria e posição", () => {
  const drone = droneSvc.atualizarTelemetria("drone-01", {
    bateriaPercentual: 60,
    latitude: -31.761,
    longitude: -52.331,
  })
  assertEq(drone.bateriaPercentual, 60, "bateria")
  assertEq(drone.latitude, -31.761, "latitude")
})

testar("Bateria crítica marca drone como indisponível", () => {
  const drone = droneSvc.atualizarTelemetria("drone-01", { bateriaPercentual: 10 })
  assertEq(drone.status, "bateria_critica", "status")
})

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n🔹 FLUXO 5: Validações de erro\n")

testar("Criar eco ponto duplicado lança erro", () => {
  try {
    ecoPontoSvc.criarEcoPonto({
      id: "ep-centro", nome: "Duplicado",
      latitude: 0, longitude: 0,
      nivelLixo: 0, limiarAcionamento: 70,
    })
    throw new Error("Deveria ter lançado erro")
  } catch (e) {
    assertTrue((e as Error).message.includes("já existe"), (e as Error).message)
  }
})

testar("Criar drone com eco ponto base inexistente lança erro", () => {
  try {
    droneSvc.criarDrone({
      id: "drone-fantasma",
      ecoPontoBaseId: "nao-existe",
      latitude: 0, longitude: 0,
      bateriaPercentual: 100,
      capacidadeMaxKg: 5,
    })
    throw new Error("Deveria ter lançado erro")
  } catch (e) {
    assertTrue((e as Error).message.includes("não encontrado"), (e as Error).message)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// Limpeza
fs.rmSync(testDir, { recursive: true })

console.log(`\n${"─".repeat(50)}`)
console.log(`  Total: ${passou + falhou} | ✅ ${passou} | ❌ ${falhou}`)
console.log(`${"─".repeat(50)}\n`)

if (falhou > 0) process.exit(1)
