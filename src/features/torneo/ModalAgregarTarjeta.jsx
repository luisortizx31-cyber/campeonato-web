import { useEffect, useState } from 'react'
import { registrarTarjeta } from '../../services/torneoTarjetasService'
import { listarJugadoresPorEquipo } from '../../services/torneoJugadoresService'
import { calcularFechasConPartidoJugado } from '../../utils/fixtureTorneo'
import { parseFechaLocal, formatFechaISO } from '../../utils/fechas'
import { CATEGORIA_TORNEO_LABELS, TIPO_TARJETA } from '../../models/torneo'

/**
 * Tarjeta "suelta": se carga desde la pestaña Amonestados, no al
 * momento de guardar el resultado del partido en Fechas.
 */
export default function ModalAgregarTarjeta({ torneoId, categoria, equipos, tarjetas, partidos, onCerrar, onGuardado }) {
  // Solo se puede elegir entre fechas donde YA SE JUGO AL MENOS UN
  // PARTIDO - no hace falta que la fecha este completa entera, ni
  // cualquier fecha que exista en el fixture (una que todavia no tiene
  // ningun resultado no se puede elegir).
  const fechasDisponibles = [...new Set(partidos.filter((p) => p.fechaNumero != null).map((p) => p.fechaNumero))].sort((a, b) => a - b)
  const fechasJugadas = calcularFechasConPartidoJugado(partidos)
  const fechaJornadaInicial = fechasJugadas[fechasJugadas.length - 1]

  const [form, setForm] = useState({
    equipoId: '',
    jugadorId: '',
    tipo: TIPO_TARJETA.AMARILLA,
    fecha: formatFechaISO(new Date()),
    fechaJornada: fechaJornadaInicial != null ? String(fechaJornadaInicial) : '',
    motivo: '',
    fechasSuspension: '1',
  })
  const [jugadores, setJugadores] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelado = false
    if (!form.equipoId) {
      setJugadores([])
      return
    }
    listarJugadoresPorEquipo(form.equipoId).then((js) => {
      if (!cancelado) setJugadores(js)
    })
    return () => {
      cancelado = true
    }
  }, [form.equipoId])

  function actualizar(campo, valor) {
    if (campo === 'equipoId') {
      setForm((f) => ({ ...f, equipoId: valor, jugadorId: '' }))
    } else {
      setForm((f) => ({ ...f, [campo]: valor }))
    }
  }

  const jugadorSeleccionado = jugadores.find((j) => j.id === form.jugadorId)

  // Un jugador no puede tener dos tarjetas en la misma fecha ni ir
  // para atras: la siguiente tarjeta tiene que caer despues de la
  // ultima que ya tiene. Cada vez que cambia el jugador elegido, si el
  // numero de fecha cargado ya no es valido para el, se corrige solo.
  const tarjetasJugador = tarjetas.filter((t) => t.jugadorId === form.jugadorId)
  const ultimaFechaJugador = tarjetasJugador.reduce((max, t) => Math.max(max, t.fechaNumero || 0), 0)
  const minimaFechaPermitida = ultimaFechaJugador + 1

  const opcionesFecha = fechasJugadas.filter((f) => f >= minimaFechaPermitida)

  useEffect(() => {
    setForm((f) => {
      if (opcionesFecha.includes(Number(f.fechaJornada))) return f
      return { ...f, fechaJornada: opcionesFecha.length > 0 ? String(opcionesFecha[0]) : '' }
    })
  }, [form.jugadorId])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!form.jugadorId) {
      setError('Elige un jugador.')
      return
    }
    if (fechasJugadas.length > 0 && !form.fechaJornada) {
      setError('Elige la fecha del campeonato.')
      return
    }
    setEnviando(true)
    try {
      await registrarTarjeta({
        torneoId,
        jugadorId: form.jugadorId,
        equipoId: form.equipoId,
        categoria,
        tipo: form.tipo,
        partidoId: null,
        fecha: parseFechaLocal(form.fecha),
        fechaNumero: fechasJugadas.length > 0 ? form.fechaJornada : null,
        motivo: form.motivo,
        fechasSuspension: form.tipo === TIPO_TARJETA.ROJA ? form.fechasSuspension : null,
      })
      onGuardado()
    } catch (err) {
      console.error('[ModalAgregarTarjeta]', err)
      setError(err.message || 'No se pudo registrar la tarjeta.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-paper shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <h1 className="text-lg font-semibold text-ink">
            Agregar tarjeta · {CATEGORIA_TORNEO_LABELS[categoria]}
          </h1>
          <button onClick={onCerrar} className="text-2xl leading-none text-ink-soft px-1">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-4">
            <label className="block text-sm font-medium text-ink mb-1">Equipo</label>
            <select
              required
              value={form.equipoId}
              onChange={(e) => actualizar('equipoId', e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            >
              <option value="">Elegir…</option>
              {equipos.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.nombre}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-ink mb-1">Jugador</label>
            <select
              required
              disabled={!form.equipoId}
              value={form.jugadorId}
              onChange={(e) => actualizar('jugadorId', e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand disabled:opacity-50"
            >
              <option value="">
                {form.equipoId ? 'Elegir…' : 'Primero elige un equipo'}
              </option>
              {jugadores.map((j) => (
                <option key={j.id} value={j.id} disabled={j.suspendido}>
                  {j.nombre}{j.eliminado ? ' (eliminado)' : j.suspendido ? ' (suspendido)' : ''}
                </option>
              ))}
            </select>
          </div>

          {jugadorSeleccionado?.rojasAcumuladas > 0 && (
            <p className="mb-4 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
              ⚠️ Este jugador ya fue suspendido por tarjeta roja directa {jugadorSeleccionado.rojasAcumuladas}{' '}
              {jugadorSeleccionado.rojasAcumuladas === 1 ? 'vez' : 'veces'} anteriormente.
            </p>
          )}

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => actualizar('tipo', e.target.value)}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
              >
                <option value={TIPO_TARJETA.AMARILLA}>Amarilla</option>
                <option value={TIPO_TARJETA.ROJA}>Roja</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Fecha</label>
              <input
                type="date"
                required
                value={form.fecha}
                onChange={(e) => actualizar('fecha', e.target.value)}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
              />
            </div>
          </div>

          <div className="mb-1">
            <label className="block text-sm font-medium text-ink mb-1">Fecha del campeonato (jornada)</label>
            {fechasDisponibles.length === 0 ? (
              <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
                Todavía no generaste el fixture de esta categoría (pestaña Fechas), así que esta
                tarjeta va a quedar sin fecha asociada — la suspensión, si corresponde, va a haber
                que levantarla a mano.
              </p>
            ) : fechasJugadas.length === 0 ? (
              <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
                Todavía no se jugó ningún partido (faltan resultados por guardar en la pestaña
                Fechas), así que por ahora no hay ninguna fecha para elegir. Esta tarjeta va a quedar
                sin fecha asociada — la suspensión, si corresponde, va a haber que levantarla a mano.
              </p>
            ) : (
              <>
                <select
                  required
                  value={form.fechaJornada}
                  onChange={(e) => actualizar('fechaJornada', e.target.value)}
                  className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
                >
                  <option value="">Elegir…</option>
                  {fechasJugadas.map((f) => (
                    <option key={f} value={f} disabled={f < minimaFechaPermitida}>
                      Fecha {f}{f < minimaFechaPermitida ? ' (ya tiene tarjeta)' : ''}
                    </option>
                  ))}
                </select>
                {jugadorSeleccionado && ultimaFechaJugador > 0 ? (
                  <p className="mt-1 text-xs text-ink-soft">
                    Este jugador ya tiene una tarjeta en la Fecha {ultimaFechaJugador}, así que solo
                    se pueden elegir fechas posteriores.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-ink-soft">
                    Solo se muestran las fechas donde ya se jugó al menos un partido. Se usa para
                    activar y levantar la suspensión sola en el momento justo.
                  </p>
                )}
              </>
            )}
          </div>

          {form.tipo === TIPO_TARJETA.ROJA && (
            <div className="mb-4 mt-3">
              <label className="block text-sm font-medium text-ink mb-1">Fechas de suspensión</label>
              <input
                type="number"
                min="1"
                required
                inputMode="numeric"
                value={form.fechasSuspension}
                onChange={(e) => actualizar('fechasSuspension', e.target.value)}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
              />
              <p className="mt-1 text-xs text-ink-soft">
                Cuántas fechas queda suspendido. Se levanta sola apenas se completen esa cantidad de
                fechas a partir de la Fecha {Number(form.fechaJornada || 0) + 1}.
              </p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-ink mb-1">Motivo (opcional)</label>
            <input
              type="text"
              value={form.motivo}
              onChange={(e) => actualizar('motivo', e.target.value)}
              placeholder="Ej: falta reiterada"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>

          {error && (
            <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="mt-2 w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-60"
          >
            {enviando ? 'Guardando…' : 'Agregar tarjeta'}
          </button>
        </form>
      </div>
    </div>
  )
}
