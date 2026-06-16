import { RepositorioJson } from "./repositorio"
import type {
  EcoPonto,
  Drone,
  EstacaoCentral,
  Caminhao,
  MissaoDrone,
  MissaoCaminhao,
} from "../domain/types"

export const db = {
  ecoPontos: new RepositorioJson<EcoPonto>("eco_pontos"),
  drones: new RepositorioJson<Drone>("drones"),
  estacoesCentralis: new RepositorioJson<EstacaoCentral>("estacoes_centrais"),
  caminhoes: new RepositorioJson<Caminhao>("caminhoes"),
  missoesDrone: new RepositorioJson<MissaoDrone>("missoes_drone"),
  missoesCaminhao: new RepositorioJson<MissaoCaminhao>("missoes_caminhao"),
}
