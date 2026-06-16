import { Router, Request, Response, NextFunction } from "express"
import { CriarDroneSchema, TelemetriaDroneSchema } from "../domain/schemas"
import * as svc from "../services/droneService"

export const dronesRouter = Router()

dronesRouter.get("/", (_req: Request, res: Response) => {
  res.json(svc.listarDrones())
})

dronesRouter.post("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = CriarDroneSchema.parse(req.body)
    res.status(201).json(svc.criarDrone(dto))
  } catch (e) { next(e) }
})

dronesRouter.get("/:id", (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(svc.obterDrone(String(req.params["id"])))
  } catch (e) { next(e) }
})

/** Firmware do drone reporta telemetria (bateria, GPS) */
dronesRouter.patch("/:id/telemetria", (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = TelemetriaDroneSchema.parse(req.body)
    res.json(svc.atualizarTelemetria(String(req.params["id"]), dto))
  } catch (e) { next(e) }
})

/** Drone confirma que chegou na Estação Central e entregou a carga */
dronesRouter.put("/:id/entregar", (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(svc.entregarNaEstacaoCentral(String(req.params["id"])))
  } catch (e) { next(e) }
})

/** Drone confirma que voltou à base (Eco Ponto) e está recarregando */
dronesRouter.put("/:id/retornar", (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(svc.confirmarRetorno(String(req.params["id"])))
  } catch (e) { next(e) }
})
