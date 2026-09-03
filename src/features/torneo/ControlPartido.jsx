import { useEffect, useState } from 'react'
import { listarJugadoresPorEquipo } from '../../services/torneoJugadoresService'
import { actualizarTitular, registrarResultadoPartido } from '../../services/torneoPartidosService'
import { registrarGol, listarGolesPorPartido, eliminarGol } from '../../services/torneoGolesService'
import { registrarTarjeta, listarTarjetasPorPartido, eliminarTarjeta } from '../../services/torneoTarjetasService'
import { TIPO_TARJETA } from '../../models/torneo'
import { colorEquipo } from '../../utils/colorEquipo'

/**
 * Pantalla de "control en vivo" de un partido puntual: elegir titulares
 * de cada equipo y cargar goles/tarjetas jugador por jugador con un
 * toque, mientras se juega. El marcador se arma solo sumando los
 * goles cargados aca - recien queda "Jugado" de verdad (con
 * golesLocal/golesVisitante fijados) cuando se toca "Finalizar
 * partido". Antes de eso el partido sigue viendose "Pendiente" en el
 * resto de la app.
 */
export default function ControlPartido({ torneoId, categoria, partido, nombreEquipo, onVolver, onFinalizado }) {
  const [jugadoresLocal, setJugadoresLocal] = useState([])
  const [jugadoresVisitante, setJugadoresVisitante] = useState([])
  const [goles, setGoles] = useState([])
  const [tarjetas, setTarjetas] = useState([])
  const [titularesLocal, setTitularesLocal] = useState(partido.titularesLocal || [])
  const [titularesVisitante, setTitularesVisitante] = useState(partido.titularesVisitante || [])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [ultimaAccion, setUltimaAccion] = useState(null) // { tipo: 'gol' | 'tarjeta', docId, descripcion }
  const [cambio, setCambio] = useState(null) // { equipo, saliente, suplentes } - ver handleTocarTitular

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [jl, jv, gs, ts] = await Promise.all([
        listarJugadoresPorEquipo(partido.equipoLocalId),
        listarJugadoresPorEquipo(partido.equipoVisitanteId),
        listarGolesPorPartido(partido.id),
        listarTarjetasPorPartido(partido.id),
      ])
      setJugadoresLocal(jl.filter((j) => !j.eliminado))
      setJugadoresVisitante(jv.filter((j) => !j.eliminado))
      setGoles(gs)
      setTarjetas(ts)
    } catch (err) {
      console.error('[ControlPartido]', err)
      setError('No se pudo cargar la información del partido.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partido.id])

  const golesLocalCount = goles
    .filter((g) => g.equipoId === partido.equipoLocalId)
    .reduce((s, g) => s + (g.cantidad || 0), 0)
  const golesVisitanteCount = goles
    .filter((g) => g.equipoId === partido.equipoVisitanteId)
    .reduce((s, g) => s + (g.cantidad || 0), 0)

  function golesDe(jugadorId) {
    return goles.filter((g) => g.jugadorId === jugadorId).reduce((s, g) => s + (g.cantidad || 0), 0)
  }
  function tarjetasDe(jugadorId) {
    return tarjetas.filter((t) => t.jugadorId === jugadorId)
  }

  async function handleToggleTitular(equipo, jugadorId, esTitular) {
    const setTitulares = equipo === 'local' ? setTitularesLocal : setTitularesVisitante
    setTitulares((t) => (esTitular ? [...t, jugadorId] : t.filter((id) => id !== jugadorId)))
    try {
      await actualizarTitular(partido.id, equipo, jugadorId, esTitular)
    } catch (err) {
      console.error('[ControlPartido]', err)
      setError('No se pudo guardar la alineación.')
    }
  }

  // Tocar a un titular para sacarlo no lo pasa directo a suplente: abre
  // el selector de "por quien entra" con los suplentes disponibles de
  // su mismo equipo, para que el cambio quede armado en un solo paso
  // (sale uno, entra otro) en vez de dos toques sueltos.
  function handleTocarTitular(equipo, jugador) {
    const jugadoresEquipo = equipo === 'local' ? jugadoresLocal : jugadoresVisitante
    const titulares = equipo === 'local' ? titularesLocal : titularesVisitante
    const suplentes = jugadoresEquipo.filter((j) => j.id !== jugador.id && !titulares.includes(j.id))
    if (suplentes.length === 0) {
      handleToggleTitular(equipo, jugador.id, false)
      return
    }
    setCambio({ equipo, saliente: jugador, suplentes })
  }

  async function handleConfirmarCambio(entranteId) {
    if (!cambio) return
    const { equipo, saliente, suplentes } = cambio
    const entrante = suplentes.find((s) => s.id === entranteId)
    setCambio(null)
    await handleToggleTitular(equipo, saliente.id, false)
    if (entrante) await handleToggleTitular(equipo, entrante.id, true)
  }

  function handleSacarSinReemplazo() {
    if (!cambio) return
    handleToggleTitular(cambio.equipo, cambio.saliente.id, false)
    setCambio(null)
  }

  async function handleGol(jugador, equipoId) {
    setProcesando(true)
    setError(null)
    try {
      const golId = await registrarGol({
        torneoId,
        categoria,
        jugadorId: jugador.id,
        equipoId,
        fechaNumero: partido.fechaNumero,
        cantidad: 1,
        partidoId: partido.id,
      })
      setUltimaAccion({ tipo: 'gol', docId: golId, descripcion: `Gol de ${jugador.nombre}` })
      await cargar()
    } catch (err) {
      console.error('[ControlPartido]', err)
      setError(err.message || 'No se pudo registrar el gol.')
    } finally {
      setProcesando(false)
    }
  }

  async function handleTarjeta(jugador, equipoId, tipo) {
    setProcesando(true)
    setError(null)
    try {
      const tarjetaId = await registrarTarjeta({
        torneoId,
        categoria,
        jugadorId: jugador.id,
        equipoId,
        tipo,
        partidoId: partido.id,
        fecha: new Date(),
        motivo: '',
        fechasSuspension: tipo === TIPO_TARJETA.ROJA ? 1 : null,
        fechaNumero: partido.fechaNumero,
      })
      setUltimaAccion({
        tipo: 'tarjeta',
        docId: tarjetaId,
        descripcion: `${tipo === TIPO_TARJETA.ROJA ? 'Roja' : 'Amarilla'} a ${jugador.nombre}`,
      })
      await cargar()
    } catch (err) {
      console.error('[ControlPartido]', err)
      setError(err.message || 'No se pudo registrar la tarjeta.')
    } finally {
      setProcesando(false)
    }
  }

  async function handleDeshacer() {
    if (!ultimaAccion) return
    setProcesando(true)
    setError(null)
    try {
      if (ultimaAccion.tipo === 'gol') await eliminarGol(ultimaAccion.docId)
      else await eliminarTarjeta(ultimaAccion.docId)
      setUltimaAccion(null)
      await cargar()
    } catch (err) {
      console.error('[ControlPartido]', err)
      setError(err.message || 'No se pudo deshacer.')
    } finally {
      setProcesando(false)
    }
  }

  async function handleFinalizar() {
    if (!confirm(`¿Finalizar el partido con marcador ${golesLocalCount} - ${golesVisitanteCount}?`)) return
    setFinalizando(true)
    setError(null)
    try {
      await registrarResultadoPartido(partido.id, { golesLocal: golesLocalCount, golesVisitante: golesVisitanteCount })
      onFinalizado()
    } catch (err) {
      console.error('[ControlPartido]', err)
      setError(err.message || 'No se pudo finalizar el partido.')
      setFinalizando(false)
    }
  }

  function Fila({ jugador, equipoId, equipo, titulares }) {
    const esTitular = titulares.includes(jugador.id)
    const nGoles = golesDe(jugador.id)
    const tj = tarjetasDe(jugador.id)
    const tieneAmarilla = tj.some((t) => t.tipo === TIPO_TARJETA.AMARILLA)
    const tieneRoja = tj.some((t) => t.tipo === TIPO_TARJETA.ROJA)
    return (
      <li className="px-2.5 py-2">
        <button
          onClick={() => (esTitular ? handleTocarTitular(equipo, jugador) : handleToggleTitular(equipo, jugador.id, true))}
          className="flex w-full items-center justify-between gap-1.5 text-left"
          title={esTitular ? 'Titular (tocar para sacarlo y elegir reemplazo)' : 'Suplente (tocar para marcar titular)'}
        >
          <span className={`min-w-0 flex-1 truncate text-xs font-medium ${esTitular ? 'text-ink' : 'text-ink-soft'}`}>
            {esTitular ? '●' : '○'} {jugador.nombre}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[11px]">
            {nGoles > 0 && <span className="font-semibold text-brand">⚽{nGoles}</span>}
            {tieneAmarilla && <span>🟨</span>}
            {tieneRoja && <span>🟥</span>}
          </span>
        </button>
        <div className="mt-1.5 flex gap-1">
          <button
            onClick={() => handleGol(jugador, equipoId)}
            disabled={procesando}
            className="flex-1 rounded-md border border-line bg-surface py-1 text-[11px] disabled:opacity-50"
          >
            ⚽
          </button>
          <button
            onClick={() => handleTarjeta(jugador, equipoId, TIPO_TARJETA.AMARILLA)}
            disabled={procesando || jugador.suspendido}
            className="flex-1 rounded-md border border-warning/30 bg-warning-soft py-1 text-[11px] disabled:opacity-50"
          >
            🟨
          </button>
          <button
            onClick={() => handleTarjeta(jugador, equipoId, TIPO_TARJETA.ROJA)}
            disabled={procesando || jugador.suspendido}
            className="flex-1 rounded-md border border-danger/30 bg-danger-soft py-1 text-[11px] disabled:opacity-50"
          >
            🟥
          </button>
        </div>
      </li>
    )
  }

  const colorLocal = colorEquipo(nombreEquipo(partido.equipoLocalId))
  const colorVisitante = colorEquipo(nombreEquipo(partido.equipoVisitanteId))

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={onVolver}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft"
        >
          ← Volver
        </button>
        <p className="text-xs text-ink-soft">Fecha {partido.fechaNumero}</p>
      </div>

      <div className="mb-3 rounded-2xl border border-line bg-brand-dark p-4 text-center text-white">
        <p className="text-[10px] uppercase tracking-widest text-white/70">Marcador en vivo</p>
        <p className="mt-1 text-3xl font-bold">
          {golesLocalCount} — {golesVisitanteCount}
        </p>
        <p className="mt-1 truncate text-xs text-white/70">
          {nombreEquipo(partido.equipoLocalId)} vs {nombreEquipo(partido.equipoVisitanteId)}
        </p>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {cargando ? (
        <p className="text-sm text-ink-soft">Cargando…</p>
      ) : (
        <>
          {/* Fondo verde tipo cancha, con las dos alineaciones separadas
              por una linea central - no es un campo tactico con
              posiciones reales, es un agrupamiento visual simple. */}
          <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl border-2 border-white/10 bg-brand-dark p-2">
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              <div
                className={`truncate px-2 py-1.5 text-center text-[11px] font-bold ${colorLocal.bg} ${colorLocal.text}`}
              >
                {nombreEquipo(partido.equipoLocalId)}
              </div>
              <ul className="divide-y divide-line">
                {jugadoresLocal.map((j) => (
                  <Fila key={j.id} jugador={j} equipoId={partido.equipoLocalId} equipo="local" titulares={titularesLocal} />
                ))}
                {jugadoresLocal.length === 0 && (
                  <li className="px-2.5 py-3 text-center text-[11px] text-ink-soft">Sin jugadores</li>
                )}
              </ul>
            </div>
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              <div
                className={`truncate px-2 py-1.5 text-center text-[11px] font-bold ${colorVisitante.bg} ${colorVisitante.text}`}
              >
                {nombreEquipo(partido.equipoVisitanteId)}
              </div>
              <ul className="divide-y divide-line">
                {jugadoresVisitante.map((j) => (
                  <Fila key={j.id} jugador={j} equipoId={partido.equipoVisitanteId} equipo="visitante" titulares={titularesVisitante} />
                ))}
                {jugadoresVisitante.length === 0 && (
                  <li className="px-2.5 py-3 text-center text-[11px] text-ink-soft">Sin jugadores</li>
                )}
              </ul>
            </div>
          </div>

          {ultimaAccion && (
            <button
              onClick={handleDeshacer}
              disabled={procesando}
              className="mb-3 w-full rounded-lg border border-line bg-surface py-2 text-xs text-ink-soft disabled:opacity-50"
            >
              ↩ Deshacer: {ultimaAccion.descripcion}
            </button>
          )}

          <button
            onClick={handleFinalizar}
            disabled={finalizando}
            className="w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-50"
          >
            {finalizando
              ? 'Finalizando…'
              : partido.golesLocal != null
                ? 'Actualizar resultado final'
                : 'Finalizar partido'}
          </button>
        </>
      )}

      {cambio && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-paper shadow-xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-4">
              <h1 className="text-base font-semibold text-ink">¿Quién entra por {cambio.saliente.nombre}?</h1>
              <button onClick={() => setCambio(null)} className="text-2xl leading-none text-ink-soft px-1">×</button>
            </div>
            <ul className="divide-y divide-line">
              {cambio.suplentes.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => handleConfirmarCambio(s.id)}
                    className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left text-sm text-ink hover:bg-surface"
                  >
                    {s.nombre}
                    <span className="shrink-0 text-xs font-medium text-brand">Entra →</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="p-4">
              <button
                onClick={handleSacarSinReemplazo}
                className="w-full rounded-lg border border-line py-2.5 text-sm font-medium text-ink-soft"
              >
                Sacarlo sin reemplazo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
