// Tabla de goleadores de una categoria: ranking de jugadores por
// goles anotados. Igual que calcularTablaPosiciones, se recalcula
// siempre desde los registros de /torneo_goles - nunca se guarda un
// contador en el jugador.
export function calcularTablaGoleadores({ jugadores, goles }) {
  const totales = new Map()
  for (const g of goles) {
    totales.set(g.jugadorId, (totales.get(g.jugadorId) || 0) + (g.cantidad || 0))
  }

  const filas = jugadores
    .filter((j) => (totales.get(j.id) || 0) > 0)
    .map((j) => ({
      jugadorId: j.id,
      nombre: j.nombre,
      equipoId: j.equipoId,
      goles: totales.get(j.id),
    }))

  filas.sort((a, b) => b.goles - a.goles || a.nombre.localeCompare(b.nombre))
  return filas
}
