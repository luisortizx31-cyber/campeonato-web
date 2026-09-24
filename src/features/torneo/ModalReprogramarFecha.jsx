import { useState } from 'react'
import { programarHorariosDeFecha } from '../../services/torneoPartidosService'
import { formatearFechaProgramada } from '../../utils/fixtureTorneo'
import { EscudoEquipo } from '../shared/EscudoEquipo'
import { SelectorFechaHora } from '../shared/SelectorFechaHora'

function aDate(fecha) {
  return fecha?.toDate ? fecha.toDate() : fecha || null
}

function mismoInstante(a, b) {
  return (a?.getTime() ?? null) === (b?.getTime() ?? null)
}

/**
 * Programa el dia/hora de cada partido de una Fecha (boton "Programar
 * fecha" en Fechas): muestra TODOS los partidos de esa Fecha, cada uno
 * con su propio selector de dia y hora (12 horas, AM/PM), para poner
 * un horario distinto a cada uno - lo normal cuando se juegan varios
 * partidos el mismo dia uno tras otro. Los partidos ya jugados se
 * muestran pero no se pueden mover: conservan su fecha real como
 * registro historico.
 *
 * El orden es el que traen `partidosDeFecha` (de menor a mayor horario,
 * los que todavia no tienen horario al final) al abrir el modal, y no
 * se reordena mientras se edita para que una fila no salte de lugar
 * mientras se esta tocando. Como atajo, "Mismo día para todos" pone el
 * dia elegido en todos los partidos de una vez (cada uno conserva su
 * hora) para no tener que elegirlo fila por fila.
 *
 * Solo se guardan los partidos cuyo horario cambio. Si la Fecha ya tenia
 * dia puesto y hay fechas siguientes con dia, se ofrece (sin marcar) el
 * correr tambien esas fechas lo mismo que se movio esta - para cuando
 * se suspende por lluvia (ver
 * torneoPartidosService.programarHorariosDeFecha).
 */
export default function ModalReprogramarFecha({ torneoId, categoria, fechaNumero, partidosDeFecha, partidos, nombreEquipo, onCerrar, onGuardado }) {
  const [horarios, setHorarios] = useState(() =>
    Object.fromEntries(partidosDeFecha.map((p) => [p.id, aDate(p.fecha)]))
  )
  const [diaParaTodos, setDiaParaTodos] = useState('')
  const [correrSiguientes, setCorrerSiguientes] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const jugado = (p) => p.golesLocal != null
  const editables = partidosDeFecha.filter((p) => !jugado(p))

  const hayFechaPrevia = editables.some((p) => p.fecha)
  const hayFechasSiguientes = partidos.some((p) => p.fechaNumero > fechaNumero && p.golesLocal == null && p.fecha)

  function cambiarHorario(partidoId, fecha) {
    setHorarios((h) => ({ ...h, [partidoId]: fecha }))
  }

  // Pone el dia elegido en todos los partidos pendientes conservando la
  // hora que cada uno ya tenia (los que no tenian ninguna quedan en
  // 12:00 AM, el valor inicial del selector de hora).
  function aplicarDiaATodos(fechaStr) {
    setDiaParaTodos(fechaStr)
    if (!fechaStr) return
    const [anio, mes, dia] = fechaStr.split('-').map(Number)
    setHorarios((h) => {
      const nuevos = { ...h }
      editables.forEach((p) => {
        const actual = h[p.id]
        nuevos[p.id] = new Date(anio, mes - 1, dia, actual?.getHours() ?? 0, actual?.getMinutes() ?? 0)
      })
      return nuevos
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const cambios = editables
      .filter((p) => !mismoInstante(horarios[p.id], aDate(p.fecha)))
      .map((p) => ({ partidoId: p.id, fecha: horarios[p.id] }))
    if (cambios.length === 0) {
      setError('No cambiaste ningún horario.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await programarHorariosDeFecha(torneoId, categoria, fechaNumero, cambios, correrSiguientes && hayFechaPrevia && hayFechasSiguientes)
      onGuardado()
    } catch (err) {
      console.error('[ModalReprogramarFecha]', err)
      setError(err.message || 'No se pudieron guardar los horarios.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-paper shadow-xl sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-5 py-4">
          <h1 className="text-lg font-semibold text-ink">Programar Fecha {fechaNumero}</h1>
          <button onClick={onCerrar} className="px-1 text-2xl leading-none text-ink-soft">×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
            {editables.length > 1 && (
              <div className="rounded-xl border border-line bg-surface p-3">
                <label className="mb-1 block text-sm font-medium text-ink">Mismo día para todos</label>
                <input
                  type="date"
                  value={diaParaTodos}
                  disabled={enviando}
                  onChange={(e) => aplicarDiaATodos(e.target.value)}
                  className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-brand disabled:opacity-50"
                />
                <p className="mt-1 text-xs text-ink-soft">
                  Pone este día en todos los partidos; después le ponés la hora a cada uno.
                </p>
              </div>
            )}

            <ul className="space-y-3">
              {partidosDeFecha.map((p) => {
                const nombreLocal = nombreEquipo(p.equipoLocalId)
                const nombreVisitante = nombreEquipo(p.equipoVisitanteId)
                return (
                  <li key={p.id} className="rounded-xl border border-line bg-surface p-3">
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                      <EscudoEquipo nombre={nombreLocal} />
                      <span className="min-w-0 truncate">{nombreLocal}</span>
                      <span className="shrink-0 text-xs font-normal text-ink-soft">vs</span>
                      <span className="min-w-0 truncate">{nombreVisitante}</span>
                      <EscudoEquipo nombre={nombreVisitante} />
                    </p>
                    {jugado(p) ? (
                      <p className="text-xs text-ink-soft">
                        Jugado {p.golesLocal} - {p.golesVisitante}
                        {p.fecha ? ` · 🗓 ${formatearFechaProgramada(p.fecha)}` : ''}
                      </p>
                    ) : (
                      <SelectorFechaHora value={horarios[p.id]} onChange={(fecha) => cambiarHorario(p.id, fecha)} disabled={enviando} />
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="shrink-0 border-t border-line bg-surface p-5">
            {hayFechaPrevia && hayFechasSiguientes && (
              <label className="mb-3 flex items-start gap-2 text-xs text-ink-soft">
                <input
                  type="checkbox"
                  checked={correrSiguientes}
                  disabled={enviando}
                  onChange={(e) => setCorrerSiguientes(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Correr también las fechas siguientes lo mismo que se movió esta (para cuando se suspende, por
                  ejemplo por lluvia). Los partidos ya jugados no se tocan.
                </span>
              </label>
            )}

            {error && <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={enviando || editables.length === 0}
              className="w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-60"
            >
              {enviando ? 'Guardando…' : 'Guardar horarios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
