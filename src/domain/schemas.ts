import { z } from "zod"

// ─── EcoPonto ────────────────────────────────────────────────────────────────

export const CriarEcoPontoSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  nivelLixo: z.number().min(0).max(100).default(0),
  limiarAcionamento: z.number().min(10).max(100).default(70),
})

export const AtualizarNivelEcoPontoSchema = z.object({
  nivelLixo: z.number().min(0).max(100),
})

// ─── Drone ───────────────────────────────────────────────────────────────────

export const CriarDroneSchema = z.object({
  id: z.string().min(1),
  ecoPontoBaseId: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  bateriaPercentual: z.number().min(0).max(100).default(100),
  capacidadeMaxKg: z.number().positive().default(10),
})

export const TelemetriaDroneSchema = z.object({
  bateriaPercentual: z.number().min(0).max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
})

// ─── Estação Central ─────────────────────────────────────────────────────────

export const CriarEstacaoCentralSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  capacidadeMaxKg: z.number().positive().default(5000),
})

// ─── Caminhão ────────────────────────────────────────────────────────────────

export const CriarCaminhaoSchema = z.object({
  id: z.string().min(1),
  placa: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  capacidadeMaxKg: z.number().positive().default(10000),
})

// ─── Tipos inferidos ─────────────────────────────────────────────────────────

export type CriarEcoPontoDTO = z.infer<typeof CriarEcoPontoSchema>
export type AtualizarNivelEcoPontoDTO = z.infer<typeof AtualizarNivelEcoPontoSchema>
export type CriarDroneDTO = z.infer<typeof CriarDroneSchema>
export type TelemetriaDroneDTO = z.infer<typeof TelemetriaDroneSchema>
export type CriarEstacaoCentralDTO = z.infer<typeof CriarEstacaoCentralSchema>
export type CriarCaminhaoDTO = z.infer<typeof CriarCaminhaoSchema>
