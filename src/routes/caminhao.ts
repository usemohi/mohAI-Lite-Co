import { Router, Request, Response, NextFunction } from "express"
import { CriarCaminhaoSchema } from "../domain/schemas"
import * as svc from "../services/caminhaoService"

export const caminhaoRouter = Router()

caminhaoRouter.get("/", (_req: Request, res: Response) => {
  res.json(svc.listarCaminhoes())
})

caminhaoRouter.post("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = CriarCaminhaoSchema.parse(req.body)
    res.status(201).json(svc.criarCaminhao(dto))
  } catch (e) { next(e) }
})

caminhaoRouter.get("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(svc.obterCaminhao(String(req.params["id"])))
  } catch (e) { next(e) }
})

/** IA planeja a rota automática — visita as estações mais cheias primeiro */
caminhaoRouter.post("/:id/planejar-rota", (req: Request, res: Response, next: NextFunction) => {
  try {
    const percentual = req.body?.percentualMinimo ? Number(req.body.percentualMinimo) : 20
    res.json(svc.planejarRota(String(req.params["id"]), percentual))
  } catch (e) { next(e) }
})

/** Caminhão coleta em uma estação central específica */
caminhaoRouter.put("/:id/coletar/:estacaoId", (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(svc.coletarNaEstacao(String(req.params["id"]), String(req.params["estacaoId"])))
  } catch (e) { next(e) }
})

/** Caminhão chegou no lixão e descarregou */
caminhaoRouter.put("/:id/descarregar", (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(svc.descarregarNoLixao(String(req.params["id"])))
  } catch (e) { next(e) }
})
