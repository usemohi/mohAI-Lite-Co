import { Router, Request, Response, NextFunction } from "express"
import { z } from "zod"
import { CriarEstacaoCentralSchema } from "../domain/schemas"
import * as svc from "../services/estacaoCentralService"

export const estacoesCentralisRouter = Router()

estacoesCentralisRouter.get("/", (_req: Request, res: Response) => {
  res.json(svc.listarEstacoesCentralis())
})

estacoesCentralisRouter.post("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = CriarEstacaoCentralSchema.parse(req.body)
    res.status(201).json(svc.criarEstacaoCentral(dto))
  } catch (e) { next(e) }
})

estacoesCentralisRouter.get("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(svc.obterEstacaoCentral(String(req.params["id"])))
  } catch (e) { next(e) }
})

/** Retorna estações com carga acima do limiar — usado pelo Caminhão de IA para decidir rota */
estacoesCentralisRouter.get("/prioritarias", (req: Request, res: Response, next: NextFunction) => {
  try {
    const percentual = req.query["minimo"] ? Number(req.query["minimo"]) : 20
    res.json(svc.estacoesComCargaPrioritaria(percentual))
  } catch (e) { next(e) }
})
