import express, { Request, Response, NextFunction } from "express"
import { ZodError } from "zod"
import { ecoPontosRouter } from "./routes/ecoPontos"
import { dronesRouter } from "./routes/drones"
import { estacoesCentralisRouter } from "./routes/estacoesCentralis"
import { caminhaoRouter } from "./routes/caminhao"
import { missoesRouter } from "./routes/missoes"

export const app = express()

app.use(express.json())

app.use("/eco-pontos", ecoPontosRouter)
app.use("/drones", dronesRouter)
app.use("/estacoes-centrais", estacoesCentralisRouter)
app.use("/caminhoes", caminhaoRouter)
app.use("/missoes", missoesRouter)

app.get("/", (_req: Request, res: Response) => {
  res.json({
    sistema: "mohAI Backend",
    versao: "2.0.0",
    status: "online",
    rotas: [
      "GET  /eco-pontos",
      "POST /eco-pontos",
      "GET  /eco-pontos/:id",
      "PATCH /eco-pontos/:id/nivel",
      "GET  /drones",
      "POST /drones",
      "GET  /drones/:id",
      "PATCH /drones/:id/telemetria",
      "PUT  /drones/:id/entregar",
      "PUT  /drones/:id/retornar",
      "GET  /estacoes-centrais",
      "POST /estacoes-centrais",
      "GET  /estacoes-centrais/:id",
      "GET  /estacoes-centrais/prioritarias",
      "GET  /caminhoes",
      "POST /caminhoes",
      "GET  /caminhoes/:id",
      "POST /caminhoes/:id/planejar-rota",
      "PUT  /caminhoes/:id/coletar/:estacaoId",
      "PUT  /caminhoes/:id/descarregar",
      "GET  /missoes/drone",
      "GET  /missoes/caminhao",
    ],
  })
})

app.get("/saude", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    const issues = err.issues ?? []
    res.status(400).json({
      erro: "Dados inválidos",
      detalhes: issues.map((e) => ({ campo: e.path.join("."), mensagem: e.message })),
    })
    return
  }

  if (err instanceof Error) {
    const status = err.message.includes("não encontrad") ? 404
      : err.message.includes("já existe") ? 409
      : 400
    res.status(status).json({ erro: err.message })
    return
  }

  res.status(500).json({ erro: "Erro interno do servidor" })
})
