import { Router, Request, Response, NextFunction } from "express"
import { z } from "zod"
import { CriarEcoPontoSchema, AtualizarNivelEcoPontoSchema } from "../domain/schemas"
import * as svc from "../services/ecoPontoService"

export const ecoPontosRouter = Router()

ecoPontosRouter.get("/", (_req: Request, res: Response) => {
  res.json(svc.listarEcoPontos())
})

ecoPontosRouter.post("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = CriarEcoPontoSchema.parse(req.body)
    res.status(201).json(svc.criarEcoPonto(dto))
  } catch (e) { next(e) }
})

ecoPontosRouter.get("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(svc.obterEcoPonto(String(req.params["id"])))
  } catch (e) { next(e) }
})

/** Endpoint chamado pelo sensor do Eco Ponto para reportar o nível de lixo.
 *  Se atingir o limiar, aciona o drone automaticamente. */
ecoPontosRouter.patch("/:id/nivel", (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = AtualizarNivelEcoPontoSchema.parse(req.body)
    res.json(svc.atualizarNivel(String(req.params["id"]), dto))
  } catch (e) { next(e) }
})
