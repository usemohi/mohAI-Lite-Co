import { app } from "./app"

const PORT = Number(process.env["PORT"] ?? 3000)

app.listen(PORT, () => {
  console.log(`\n🚀 mohAI Backend rodando em http://localhost:${PORT}`)
  console.log(`📋 Rotas disponíveis em http://localhost:${PORT}/`)
  console.log(`💚 Health check em http://localhost:${PORT}/saude\n`)
})
