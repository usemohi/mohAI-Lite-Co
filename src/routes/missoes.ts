import { Router, Request, Response } from "express"
import { db } from "../repositories/db"

export const missoesRouter = Router()

missoesRouter.get("/drone", (_req: Request, res: Response) => {
  res.json(db.missoesDrone.listar())
})

missoesRouter.get("/caminhao", (_req: Request, res: Response) => {
  res.json(db.missoesCaminhao.listar())
})
