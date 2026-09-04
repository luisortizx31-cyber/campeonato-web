import { useEffect, useState } from 'react'
import { listarJugadoresPorEquipo } from '../../services/torneoJugadoresService'
import { actualizarTitular, registrarResultadoPartido, reiniciarPartido } from '../../services/torneoPartidosService'
import { registrarGol, listarGolesPorPartido, eliminarGol } from '../../services/torneoGolesService'
import {
  registrarTarjetaPartido,
  finalizarTarjetasPartido,
  listarTarjetasPorPartido,
  eliminarTarjeta,
} from '../../services/torneoTarjetasService'
import { obtenerConfigCategoria } from '../../services/torneoConfigService'
import { TIPO_TARJETA, JUGADORES_POR_EQUIPO_DEFAULT } from '../../models/torneo'
import { colorEquipo } from '../../utils/colorEquipo'
import { useSwipeHorizontal } from '../../hooks/useSwipeHorizontal'

const VISTAS = ['alineacion', 'cancha']

function porNombre(a, b) {
  return a.nombre.localeCompare(b.nombre)
}

// Fila del desplegable de ALINEACION (arriba): muestra a todo el
// plantel del equipo, titulares primero. Tocar el nombre alterna
// titular/suplente (o abre el selector de reemplazo si ya era
// titular, decidido por el padre via `onClick`).
function FilaAlineacion({ jugador, esTitular, expulsado, onClick }) {
  return (
    <li>
      <button
        onClick={onClick}
        disabled={expulsado}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs disabled:opacity-50"
      >
        <span className={esTitular ? 'font-medium text-ink' : 'text-ink-soft'}>
          {esTitular ? '●' : '○'} {jugador.nombre}
        </span>
        {expulsado && <span className="shrink-0 font-semibold text-danger">🟥 Expulsado</span>}
      </button>
    </li>
  )
}

// Dos listas separadas (no una sola mezclada): Titulares arriba,
// Suplentes abajo. Cualquiera que no este en `titulares` cae
// automaticamente en Suplentes, sin necesidad de marcarlo aparte -
// asi que al llegar al maximo del formato (futbol 6/7/11) el resto
// del plantel queda visible ahi.
function SelectorAlineacion({ titulo, jugadores, titulares, jugadoresPorEquipo, color, abierto, onToggle, onTocarJugador, estaExpulsado }) {
  const listaTitulares = jugadores.filter((j) => titulares.includes(j.id)).sort(porNombre)
  const listaSuplentes = jugadores.filter((j) => !titulares.includes(j.id)).sort(porNombre)
  const completo = titulares.length >= jugadoresPorEquipo
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <button onClick={onToggle} className={`flex w-full items-center justify-between gap-2 px-3 py-3 text-left ${color.bg}`}>
        <span className={`truncate text-sm font-extrabold ${color.text}`}>{titulo}</span>
        <span className="flex shrink-0 items-center gap-2 text-[11px]">
          <span className={completo ? 'font-bold text-success' : `font-semibold ${color.text}`}>
            {titulares.length}/{jugadoresPorEquipo} titulares
          </span>
          <span className={`${color.text} transition-transform ${abierto ? 'rotate-180' : ''}`}>⌄</span>
        </span>
      </button>
      {abierto && (
        <div className="border-t border-line">
          <p className="border-b border-line bg-ink-soft/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink">
            ● Titulares ({listaTitulares.length}/{jugadoresPorEquipo})
          </p>
          <ul className="divide-y divide-line">
            {listaTitulares.map((j) => (
              <FilaAlineacion
                key={j.id}
                jugador={j}
                esTitular
                expulsado={estaExpulsado(j.id)}
                onClick={() => onTocarJugador(j, true)}
              />
            ))}
            {listaTitulares.length === 0 && (
              <li className="px-3 py-2 text-center text-[11px] text-ink-soft">Sin titulares todavía</li>
            )}
          </ul>

          <p className="border-y border-line bg-ink-soft/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink">
            ○ Suplentes ({listaSuplentes.length})
          </p>
          <ul className="divide-y divide-line">
            {listaSuplentes.map((j) => (
              <FilaAlineacion
                key={j.id}
                jugador={j}
                esTitular={false}
                expulsado={estaExpulsado(j.id)}
                onClick={() => onTocarJugador(j, false)}
              />
            ))}
            {listaSuplentes.length === 0 && (
              <li className="px-3 py-2 text-center text-[11px] text-ink-soft">Sin suplentes</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// Fila de la CANCHA (abajo): solo jugadores en cancha ahora mismo
// (titulares, no expulsados) - aca se cargan los eventos del partido.
// Tocar el nombre abre el selector de cambio (decidido por el padre).
function FilaAccion({ jugador, nGoles, amarillasPartido, procesando, onTocar, onGol, onAmarilla, onRoja }) {
  return (
    <li className="px-2.5 py-2">
      <button
        onClick={onTocar}
        className="flex w-full items-center justify-between gap-1.5 text-left"
        title="Tocar para sacarlo y elegir reemplazo"
      >
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">{jugador.nombre}</span>
        {(nGoles > 0 || amarillasPartido > 0) && (
          <span className="flex shrink-0 items-center gap-1 text-[11px]">
            {nGoles > 0 && <span className="font-semibold text-brand">⚽{nGoles}</span>}
            {Array.from({ length: amarillasPartido }).map((_, i) => (
              <span key={i}>🟨</span>
            ))}
          </span>
        )}
      </button>
      <div className="mt-1.5 flex gap-1">
        <button
          onClick={onGol}
          disabled={procesando}
          className="flex-1 rounded-md border border-line bg-surface py-1 text-[11px] disabled:opacity-50"
        >
          ⚽
        </button>
        <button
          onClick={onAmarilla}
          disabled={procesando}
          className="flex-1 rounded-md border border-warning/30 bg-warning-soft py-1 text-[11px] disabled:opacity-50"
        >
          🟨
        </button>
        <button
          onClick={onRoja}
          disabled={procesando}
          className="flex-1 rounded-md border border-danger/30 bg-danger-soft py-1 text-[11px] disabled:opacity-50"
        >
          🟥
        </button>
      </div>
    </li>
  )
}

/**
 * Pantalla de "control en vivo" de un partido puntual, con dos
 * pestañas: Alineación (desplegable por equipo para armar titulares y
 * suplentes) y Cancha (SOLO los que estan jugando ahora mismo -
 * titulares menos los expulsados - para cargar goles/tarjetas jugador
 * por jugador con un toque). El marcador se arma solo sumando los
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
  const [jugadoresPorEquipo, setJugadoresPorEquipo] = useState(JUGADORES_POR_EQUIPO_DEFAULT)
  const [alineacionAbierta, setAlineacionAbierta] = useState({ local: true, visitante: true })
  // Si el partido ya tenia alineacion cargada (se volvio a abrir un
  // partido en curso), arranca directo en la cancha - si no, en
  // Alineacion, que es el primer paso antes de poder cargar nada.
  const [vista, setVista] = useState(() =>
    (partido.titularesLocal?.length > 0 || partido.titularesVisitante?.length > 0) ? 'cancha' : 'alineacion'
  )
  const swipeVista = useSwipeHorizontal(VISTAS, vista, setVista)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [reiniciando, setReiniciando] = useState(false)
  const [ultimaAccion, setUltimaAccion] = useState(null) // { tipo: 'gol' | 'tarjeta', docId, descripcion }
  const [cambio, setCambio] = useState(null) // { equipo, saliente, suplentes } - ver handleTocarTitular

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [jl, jv, gs, ts, cfg] = await Promise.all([
        listarJugadoresPorEquipo(partido.equipoLocalId),
        listarJugadoresPorEquipo(partido.equipoVisitanteId),
        listarGolesPorPartido(partido.id),
        listarTarjetasPorPartido(partido.id),
        obtenerConfigCategoria(torneoId, categoria),
      ])
      setJugadoresLocal(jl.filter((j) => !j.eliminado))
      setJugadoresVisitante(jv.filter((j) => !j.eliminado))
      setGoles(gs)
      setTarjetas(ts)
      setJugadoresPorEquipo(cfg.jugadoresPorEquipo)
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

  // Expulsado EN ESTE PARTIDO: roja directa, o 2da amarilla (todavia
  // sin procesar - el efecto de temporada recien se aplica al
  // finalizar, ver finalizarTarjetasPartido, pero para la UI en vivo
  // ya cuenta como afuera).
  function estaExpulsadoEnPartido(jugadorId) {
    const cartas = tarjetasDe(jugadorId)
    const amarillas = cartas.filter((t) => t.tipo === TIPO_TARJETA.AMARILLA).length
    const roja = cartas.some((t) => t.tipo === TIPO_TARJETA.ROJA)
    return roja || amarillas >= 2
  }

  const expulsadosLocal = jugadoresLocal.filter((j) => estaExpulsadoEnPartido(j.id))
  const expulsadosVisitante = jugadoresVisitante.filter((j) => estaExpulsadoEnPartido(j.id))

  // Quienes estan jugando AHORA en la cancha: titulares que no fueron
  // expulsados (un expulsado desaparece de la cancha, queda solo en
  // "Expulsados" - ver mas abajo).
  const enCanchaLocal = jugadoresLocal.filter((j) => titularesLocal.includes(j.id) && !estaExpulsadoEnPartido(j.id))
  const enCanchaVisitante = jugadoresVisitante.filter(
    (j) => titularesVisitante.includes(j.id) && !estaExpulsadoEnPartido(j.id)
  )

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
    const suplentes = jugadoresEquipo.filter(
      (j) => j.id !== jugador.id && !titulares.includes(j.id) && !estaExpulsadoEnPartido(j.id)
    )
    if (suplentes.length === 0) {
      handleToggleTitular(equipo, jugador.id, false)
      return
    }
    setCambio({ equipo, saliente: jugador, suplentes })
  }

  // Promover un suplente a titular directo desde el desplegable de
  // arriba (a diferencia de un cambio, esto NO baja a nadie, asi que
  // puede pasarse del formato configurado - se avisa pero no se
  // bloquea, por si hace falta jugar con uno de mas por algun motivo).
  function handleTocarEnAlineacion(equipo, jugador, esTitular) {
    if (esTitular) {
      handleTocarTitular(equipo, jugador)
      return
    }
    const titulares = equipo === 'local' ? titularesLocal : titularesVisitante
    if (titulares.length >= jugadoresPorEquipo) {
      if (
        !confirm(
          `Este equipo ya tiene ${titulares.length} titulares (fútbol ${jugadoresPorEquipo}). ¿Agregar a ${jugador.nombre} igual?`
        )
      ) {
        return
      }
    }
    handleToggleTitular(equipo, jugador.id, true)
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

  // La tarjeta queda "en borrador" (no afecta amarillasAcumuladas ni
  // suspende todavia) hasta que se toca "Finalizar partido" - asi una
  // 2da amarilla del mismo partido se puede reconocer como equivalente
  // a una roja antes de aplicarle ningun efecto real al jugador (ver
  // finalizarTarjetasPartido).
  async function handleTarjeta(jugador, equipoId, tipo) {
    setProcesando(true)
    setError(null)
    try {
      const tarjetaId = await registrarTarjetaPartido({
        torneoId,
        categoria,
        jugadorId: jugador.id,
        equipoId,
        tipo,
        partidoId: partido.id,
        fecha: new Date(),
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
      // Recien aca se aplican de verdad las tarjetas "en borrador" a
      // los contadores de temporada de cada jugador.
      await finalizarTarjetasPartido({ torneoId, categoria, partidoId: partido.id, fechaNumero: partido.fechaNumero })
      await registrarResultadoPartido(partido.id, { golesLocal: golesLocalCount, golesVisitante: golesVisitanteCount })
      onFinalizado()
    } catch (err) {
      console.error('[ControlPartido]', err)
      setError(err.message || 'No se pudo finalizar el partido.')
      setFinalizando(false)
    }
  }

  // Deja el partido como si nunca se hubiera jugado: borra sus goles y
  // tarjetas (revirtiendo el efecto de las que ya estaban procesadas,
  // ver eliminarTarjeta), vacia la alineacion y vuelve el resultado a
  // Pendiente.
  async function handleReiniciarPartido() {
    if (
      !confirm(
        '¿Reiniciar este partido? Se borran los goles, las tarjetas y la alineación cargados, y el resultado vuelve a Pendiente.\n\nEsta acción no se puede deshacer.'
      )
    )
      return
    setReiniciando(true)
    setError(null)
    try {
      for (const g of goles) {
        await eliminarGol(g.id)
      }
      for (const t of tarjetas) {
        await eliminarTarjeta(t.id)
      }
      await reiniciarPartido(partido.id)
      setTitularesLocal([])
      setTitularesVisitante([])
      setUltimaAccion(null)
      await cargar()
    } catch (err) {
      console.error('[ControlPartido]', err)
      setError(err.message || 'No se pudo reiniciar el partido.')
    } finally {
      setReiniciando(false)
    }
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

      {!cargando && (
        <div className="mb-3 flex overflow-hidden rounded-xl border border-line">
          <button
            onClick={() => setVista('alineacion')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              vista === 'alineacion' ? 'bg-brand text-white' : 'bg-surface text-ink-soft'
            }`}
          >
            Alineación
          </button>
          <button
            onClick={() => setVista('cancha')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              vista === 'cancha' ? 'bg-brand text-white' : 'bg-surface text-ink-soft'
            }`}
          >
            Cancha
          </button>
        </div>
      )}

      {cargando ? (
        <p className="text-sm text-ink-soft">Cargando…</p>
      ) : (
      <div {...swipeVista}>
      {vista === 'alineacion' ? (
        <div className="space-y-2">
          <SelectorAlineacion
            titulo={`Alineación · ${nombreEquipo(partido.equipoLocalId)}`}
            jugadores={jugadoresLocal}
            titulares={titularesLocal}
            jugadoresPorEquipo={jugadoresPorEquipo}
            color={colorLocal}
            abierto={alineacionAbierta.local}
            onToggle={() => setAlineacionAbierta((a) => ({ ...a, local: !a.local }))}
            onTocarJugador={(j, esTitular) => handleTocarEnAlineacion('local', j, esTitular)}
            estaExpulsado={estaExpulsadoEnPartido}
          />
          <SelectorAlineacion
            titulo={`Alineación · ${nombreEquipo(partido.equipoVisitanteId)}`}
            jugadores={jugadoresVisitante}
            titulares={titularesVisitante}
            jugadoresPorEquipo={jugadoresPorEquipo}
            color={colorVisitante}
            abierto={alineacionAbierta.visitante}
            onToggle={() => setAlineacionAbierta((a) => ({ ...a, visitante: !a.visitante }))}
            onTocarJugador={(j, esTitular) => handleTocarEnAlineacion('visitante', j, esTitular)}
            estaExpulsado={estaExpulsadoEnPartido}
          />
        </div>
      ) : (
        <>
          {/* Fondo verde tipo cancha, con las dos alineaciones separadas
              por una linea central - no es un campo tactico con
              posiciones reales, es un agrupamiento visual simple. Solo
              se muestra a quien esta jugando ahora (titulares menos los
              expulsados) - los suplentes se eligen en la pestaña
              Alineación. */}
          <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl border-2 border-white/10 bg-brand-dark p-2">
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              <div
                className={`truncate px-2 py-1.5 text-center text-[11px] font-bold ${colorLocal.bg} ${colorLocal.text}`}
              >
                {nombreEquipo(partido.equipoLocalId)}
              </div>
              <ul className="divide-y divide-line">
                {enCanchaLocal.map((j) => (
                  <FilaAccion
                    key={j.id}
                    jugador={j}
                    nGoles={golesDe(j.id)}
                    amarillasPartido={tarjetasDe(j.id).filter((t) => t.tipo === TIPO_TARJETA.AMARILLA).length}
                    procesando={procesando}
                    onTocar={() => handleTocarTitular('local', j)}
                    onGol={() => handleGol(j, partido.equipoLocalId)}
                    onAmarilla={() => handleTarjeta(j, partido.equipoLocalId, TIPO_TARJETA.AMARILLA)}
                    onRoja={() => handleTarjeta(j, partido.equipoLocalId, TIPO_TARJETA.ROJA)}
                  />
                ))}
                {enCanchaLocal.length === 0 && (
                  <li className="px-2.5 py-3 text-center text-[11px] text-ink-soft">
                    Elegí titulares en Alineación
                  </li>
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
                {enCanchaVisitante.map((j) => (
                  <FilaAccion
                    key={j.id}
                    jugador={j}
                    nGoles={golesDe(j.id)}
                    amarillasPartido={tarjetasDe(j.id).filter((t) => t.tipo === TIPO_TARJETA.AMARILLA).length}
                    procesando={procesando}
                    onTocar={() => handleTocarTitular('visitante', j)}
                    onGol={() => handleGol(j, partido.equipoVisitanteId)}
                    onAmarilla={() => handleTarjeta(j, partido.equipoVisitanteId, TIPO_TARJETA.AMARILLA)}
                    onRoja={() => handleTarjeta(j, partido.equipoVisitanteId, TIPO_TARJETA.ROJA)}
                  />
                ))}
                {enCanchaVisitante.length === 0 && (
                  <li className="px-2.5 py-3 text-center text-[11px] text-ink-soft">
                    Elegí titulares en Alineación
                  </li>
                )}
              </ul>
            </div>
          </div>

          {(expulsadosLocal.length > 0 || expulsadosVisitante.length > 0) && (
            <div className="mb-3 overflow-hidden rounded-2xl border border-danger/30 bg-danger-soft">
              <p className="border-b border-danger/20 px-3 py-1.5 text-xs font-semibold text-danger">
                🟥 Expulsados
              </p>
              <ul className="divide-y divide-danger/20">
                {[...expulsadosLocal, ...expulsadosVisitante].map((j) => {
                  const roja = tarjetasDe(j.id).some((t) => t.tipo === TIPO_TARJETA.ROJA)
                  return (
                    <li key={j.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                      <span className="min-w-0 truncate text-ink">{j.nombre}</span>
                      <span className="shrink-0 text-danger">{roja ? 'Roja directa' : '2 amarillas'}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

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
            disabled={finalizando || reiniciando}
            className="w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-50"
          >
            {finalizando
              ? 'Finalizando…'
              : partido.golesLocal != null
                ? 'Actualizar resultado final'
                : 'Finalizar partido'}
          </button>

          <button
            onClick={handleReiniciarPartido}
            disabled={reiniciando || finalizando}
            className="mt-2 w-full rounded-lg border border-danger/30 py-2 text-xs font-medium text-danger disabled:opacity-50"
          >
            {reiniciando ? 'Reiniciando…' : '↺ Reiniciar partido (vuelve todo a cero)'}
          </button>
        </>
      )}
      </div>
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
