/**
 * Repositório JSON — substitui banco de dados na fase de desenvolvimento.
 * Guarda em memória (rápido) e sincroniza em disco (persistência entre reinícios).
 *
 * Para produção: troque apenas este arquivo por uma implementação com PostgreSQL/MongoDB.
 * O resto do código não muda.
 */

import fs from "fs"
import path from "path"

const DATA_DIR = process.env["DATA_DIR"]
  ? path.resolve(process.env["DATA_DIR"])
  : path.resolve(__dirname, "../../data")

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

type Registro = { [key: string]: unknown }

export class RepositorioJson<T extends { id: string }> {
  private cache: Map<string, T> = new Map()
  private readonly arquivo: string

  constructor(nome: string) {
    this.arquivo = path.join(DATA_DIR, `${nome}.json`)
    this.carregar()
  }

  private carregar(): void {
    if (!fs.existsSync(this.arquivo)) return
    try {
      const conteudo = fs.readFileSync(this.arquivo, "utf-8")
      const dados = JSON.parse(conteudo) as Record<string, T>
      for (const [id, item] of Object.entries(dados)) {
        this.cache.set(id, item)
      }
    } catch {
      // Arquivo corrompido — começa do zero
    }
  }

  private persistir(): void {
    const obj: Record<string, T> = {}
    for (const [id, item] of this.cache.entries()) {
      obj[id] = item
    }
    fs.writeFileSync(this.arquivo, JSON.stringify(obj, null, 2), "utf-8")
  }

  listar(): T[] {
    return Array.from(this.cache.values())
  }

  obter(id: string): T | undefined {
    return this.cache.get(id)
  }

  salvar(item: T): T {
    this.cache.set(item.id, item)
    this.persistir()
    return item
  }

  atualizar(id: string, parcial: Partial<T>): T | undefined {
    const existente = this.cache.get(id)
    if (!existente) return undefined
    const atualizado = { ...existente, ...parcial, id, atualizadoEm: new Date().toISOString() } as T
    this.cache.set(id, atualizado)
    this.persistir()
    return atualizado
  }

  deletar(id: string): boolean {
    const ok = this.cache.delete(id)
    if (ok) this.persistir()
    return ok
  }

  existe(id: string): boolean {
    return this.cache.has(id)
  }
}
