import { useEffect, useState } from 'react'
import { listarJugadoresPorEquipo, actualizarNumeroCamiseta } from '../../services/torneoJugadoresService'
import {
  actualizarTitular,
  actualizarSuplente,
  actualizarDniConfirmado,
  registrarResultadoPartido,
  reiniciarPartido,
} from '../../services/torneoPartidosService'
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

// Fila del desplegable de ALINEACION (arriba): numerada 1..n dentro de
// cada lista (Jugadores/Titulares/Suplentes/Expulsados) para poder
// referirse a "el 3 de suplentes" de un vistazo. En Titulares/
// Suplentes, tocar el nombre saca a ese jugador de su estado actual
// (decidido por el padre via `onClick` - swap si es titular,
// promocion directa si es suplente). En Jugadores (estado="pool",
// todavia sin decidir si juega hoy) no hay un solo tap posible: dos
// botones aparte para mandarlo a Titular o a Suplente. Un expulsado
// (estado="expulsado") ya no tiene ninguna accion posible - solo
// muestra el motivo, aparte de Titulares/Suplentes para no mezclarlo
// con quienes siguen en juego. El numero de camiseta queda siempre
// visible y editable, sea cual sea el estado.
function FilaAlineacion({ indice, jugador, estado, dniConfirmado, titularesCompletos, motivoExpulsion, onClick, onElegirTitular, onElegirSuplente, onGuardarCamiseta, onCambiarDni }) {
  const [numero, setNumero] = useState(jugador.numeroCamiseta != null ? String(jugador.numeroCamiseta) : '')

  useEffect(() => {
    setNumero(jugador.numeroCamiseta != null ? String(jugador.numeroCamiseta) : '')
  }, [jugador.numeroCamiseta])

  function guardarCamiseta() {
    const actual = jugador.numeroCamiseta != null ? String(jugador.numeroCamiseta) : ''
    if (numero.trim() === actual) return
    onGuardarCamiseta(jugador.id, numero.trim())
  }

  return (
    <li className="px-2.5 py-1">
      <div className="flex items-center gap-1.5">
        {estado === 'pool' ? (
          <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs">
            <span className="w-4 shrink-0 text-right text-ink-soft">{indice}</span>
            <span className="min-w-0 flex-1 truncate text-ink-soft">{jugador.nombre}</span>
          </span>
        ) : estado === 'expulsado' ? (
          <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs">
            <span className="w-4 shrink-0 text-right text-ink-soft">{indice}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-danger">🟥 {jugador.nombre}</span>
            <span className="shrink-0 text-[10px] font-semibold text-danger">{motivoExpulsion}</span>
          </span>
        ) : (
          <button
            onClick={onClick}
            disabled={estado === 'suplente' && titularesCompletos}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs disabled:opacity-50"
          >
            <span className="w-4 shrink-0 text-right text-ink-soft">{indice}</span>
            <span className={`min-w-0 flex-1 truncate ${estado === 'titular' ? 'font-medium text-ink' : 'text-ink-soft'}`}>
              {estado === 'titular' ? '●' : '○'} {jugador.nombre}
            </span>
          </button>
        )}
        <input
          type="number"
          inputMode="numeric"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          onBlur={guardarCamiseta}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur()
          }}
          placeholder="#"
          title="Número de camiseta"
          className="no-spinner w-9 shrink-0 rounded-md border border-line bg-paper px-1 py-0.5 text-center text-xs text-ink outline-none focus-visible:border-brand"
        />
      </div>
      {estado === 'pool' && (
        <>
          <label className="mt-0.5 flex items-center gap-1.5 pl-5 text-[11px] text-ink-soft">
            <input
              type="checkbox"
              checked={dniConfirmado}
              onChange={(e) => onCambiarDni(jugador.id, e.target.checked)}
              className="h-3.5 w-3.5 shrink-0 accent-brand"
            />
            Trajo DNI hoy
          </label>
          <div className="mt-1 flex gap-1.5 pl-5">
            <button
              onClick={onElegirTitular}
              disabled={!dniConfirmado || titularesCompletos}
              className="flex-1 rounded-md border border-success/30 bg-success-soft py-0.5 text-[11px] font-medium text-success disabled:cursor-not-allowed disabled:opacity-40"
            >
              → Titular
            </button>
            <button
              onClick={onElegirSuplente}
              disabled={!dniConfirmado}
              className="flex-1 rounded-md border border-line bg-surface py-0.5 text-[11px] font-medium text-ink-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              → Suplente
            </button>
          </div>
          {!dniConfirmado ? (
            <p className="mt-0.5 pl-5 text-[10px] text-ink-soft">Marcá que trajo el DNI para poder convocarlo.</p>
          ) : titularesCompletos ? (
            <p className="mt-0.5 pl-5 text-[10px] text-ink-soft">Ya se llegó al máximo de titulares - solo puede ir a Suplente.</p>
          ) : null}
        </>
      )}
    </li>
  )
}

// Tres listas separadas: Titulares, Suplentes y Jugadores (el resto
// del plantel, todavia sin convocar para ESTE partido). A diferencia
// de antes, nadie cae en Suplentes por defecto - hay que elegirlo a
// proposito desde Jugadores, para que Suplentes refleje solo a quienes
// se convocaron hoy y no a todo el plantel registrado en la temporada.
function SelectorAlineacion({
  titulo,
  jugadores,
  titulares,
  suplentes,
  dniConfirmados,
  jugadoresPorEquipo,
  color,
  abierto,
  onToggle,
  onTocarTitular,
  onTocarSuplente,
  onElegirDesdePool,
  estaExpulsado,
  motivoExpulsion,
  onGuardarCamiseta,
  onCambiarDni,
}) {
  const [seccionAbierta, setSeccionAbierta] = useState({ titulares: true, suplentes: true, pool: true, expulsados: true })
  // Un expulsado (roja o 2da amarilla) sale de Titulares/Suplentes y
  // pasa a su propia seccion aparte - ya no tiene ninguna accion
  // posible, mezclarlo con quienes siguen en juego solo confunde.
  const listaTitulares = jugadores.filter((j) => titulares.includes(j.id) && !estaExpulsado(j.id)).sort(porNombre)
  const listaSuplentes = jugadores.filter((j) => suplentes.includes(j.id) && !estaExpulsado(j.id)).sort(porNombre)
  const listaPool = jugadores.filter((j) => !titulares.includes(j.id) && !suplentes.includes(j.id)).sort(porNombre)
  const listaExpulsados = jugadores
    .filter((j) => (titulares.includes(j.id) || suplentes.includes(j.id)) && estaExpulsado(j.id))
    .sort(porNombre)
  const completo = titulares.length >= jugadoresPorEquipo

  function toggleSeccion(seccion) {
    setSeccionAbierta((s) => ({ ...s, [seccion]: !s[seccion] }))
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <button onClick={onToggle} className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left ${color.bg}`}>
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
          <button
            onClick={() => toggleSeccion('pool')}
            className="flex w-full items-center justify-between gap-2 border-b border-line bg-ink-soft/15 px-2.5 py-1 text-left text-xs font-bold uppercase tracking-wide text-ink"
          >
            <span>◌ Jugadores ({listaPool.length})</span>
            <span className={`normal-case transition-transform ${seccionAbierta.pool ? 'rotate-180' : ''}`}>⌄</span>
          </button>
          {seccionAbierta.pool && (
            <ul className="divide-y divide-line">
              {listaPool.map((j, i) => (
                <FilaAlineacion
                  key={j.id}
                  indice={i + 1}
                  jugador={j}
                  estado="pool"
                  dniConfirmado={dniConfirmados.includes(j.id)}
                  titularesCompletos={completo}
                  onElegirTitular={() => onElegirDesdePool(j, 'titular')}
                  onElegirSuplente={() => onElegirDesdePool(j, 'suplente')}
                  onGuardarCamiseta={onGuardarCamiseta}
                  onCambiarDni={onCambiarDni}
                />
              ))}
              {listaPool.length === 0 && (
                <li className="px-3 py-1.5 text-center text-[11px] text-ink-soft">Ya asignaste a todo el plantel</li>
              )}
            </ul>
          )}

          <button
            onClick={() => toggleSeccion('titulares')}
            className="flex w-full items-center justify-between gap-2 border-y border-line bg-ink-soft/15 px-2.5 py-1 text-left text-xs font-bold uppercase tracking-wide text-ink"
          >
            <span>● Titulares ({listaTitulares.length}/{jugadoresPorEquipo})</span>
            <span className={`normal-case transition-transform ${seccionAbierta.titulares ? 'rotate-180' : ''}`}>⌄</span>
          </button>
          {seccionAbierta.titulares && (
            <ul className="divide-y divide-line">
              {listaTitulares.map((j, i) => (
                <FilaAlineacion
                  key={j.id}
                  indice={i + 1}
                  jugador={j}
                  estado="titular"
                  dniConfirmado={dniConfirmados.includes(j.id)}
                  onClick={() => onTocarTitular(j)}
                  onGuardarCamiseta={onGuardarCamiseta}
                  onCambiarDni={onCambiarDni}
                />
              ))}
              {listaTitulares.length === 0 && (
                <li className="px-3 py-1.5 text-center text-[11px] text-ink-soft">Sin titulares todavía</li>
              )}
            </ul>
          )}

          <button
            onClick={() => toggleSeccion('suplentes')}
            className="flex w-full items-center justify-between gap-2 border-y border-line bg-ink-soft/15 px-2.5 py-1 text-left text-xs font-bold uppercase tracking-wide text-ink"
          >
            <span>○ Suplentes ({listaSuplentes.length})</span>
            <span className={`normal-case transition-transform ${seccionAbierta.suplentes ? 'rotate-180' : ''}`}>⌄</span>
          </button>
          {seccionAbierta.suplentes && (
            <ul className="divide-y divide-line">
              {listaSuplentes.map((j, i) => (
                <FilaAlineacion
                  key={j.id}
                  indice={i + 1}
                  jugador={j}
                  estado="suplente"
                  dniConfirmado={dniConfirmados.includes(j.id)}
                  titularesCompletos={completo}
                  onClick={() => onTocarSuplente(j)}
                  onGuardarCamiseta={onGuardarCamiseta}
                  onCambiarDni={onCambiarDni}
                />
              ))}
              {listaSuplentes.length === 0 && (
                <li className="px-3 py-1.5 text-center text-[11px] text-ink-soft">Sin suplentes todavía</li>
              )}
            </ul>
          )}

          {listaExpulsados.length > 0 && (
            <>
              <button
                onClick={() => toggleSeccion('expulsados')}
                className="flex w-full items-center justify-between gap-2 border-t border-line bg-danger-soft px-2.5 py-1 text-left text-xs font-bold uppercase tracking-wide text-danger"
              >
                <span>🟥 Expulsados ({listaExpulsados.length})</span>
                <span className={`normal-case transition-transform ${seccionAbierta.expulsados ? 'rotate-180' : ''}`}>⌄</span>
              </button>
              {seccionAbierta.expulsados && (
                <ul className="divide-y divide-line">
                  {listaExpulsados.map((j, i) => (
                    <FilaAlineacion
                      key={j.id}
                      indice={i + 1}
                      jugador={j}
                      estado="expulsado"
                      motivoExpulsion={motivoExpulsion(j.id)}
                      onGuardarCamiseta={onGuardarCamiseta}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
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
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">
          {jugador.numeroCamiseta != null && <span className="text-ink-soft">#{jugador.numeroCamiseta} </span>}
          {jugador.nombre}
        </span>
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
  const [suplentesLocal, setSuplentesLocal] = useState(partido.suplentesLocal || [])
  const [suplentesVisitante, setSuplentesVisitante] = useState(partido.suplentesVisitante || [])
  const [dniConfirmadoLocal, setDniConfirmadoLocal] = useState(partido.dniConfirmadoLocal || [])
  const [dniConfirmadoVisitante, setDniConfirmadoVisitante] = useState(partido.dniConfirmadoVisitante || [])
  const [jugadoresPorEquipo, setJugadoresPorEquipo] = useState(JUGADORES_POR_EQUIPO_DEFAULT)
  const [alineacionAbierta, setAlineacionAbierta] = useState({ local: true, visitante: true })
  // Que pestaña (Alineación/Cancha) se ve para ESTE partido puntual -
  // se guarda en sessionStorage para que un refresh de pagina no
  // vuelva siempre a Alineación. Si no hay nada guardado: directo a
  // Cancha si el partido ya tenia alineacion cargada (se volvio a
  // abrir uno en curso), si no a Alineación, que es el primer paso
  // antes de poder cargar nada.
  const vistaStorageKey = `campeonato_partido_${partido.id}_vista`
  const [vista, setVista] = useState(() => {
    try {
      const guardada = sessionStorage.getItem(vistaStorageKey)
      if (VISTAS.includes(guardada)) return guardada
    } catch {
      // Sin sessionStorage (modo privado, etc) simplemente no restaura.
    }
    return (partido.titularesLocal?.length > 0 || partido.titularesVisitante?.length > 0) ? 'cancha' : 'alineacion'
  })
  const swipeVista = useSwipeHorizontal(VISTAS, vista, setVista)

  useEffect(() => {
    try {
      sessionStorage.setItem(vistaStorageKey, vista)
    } catch {
      // Sin sessionStorage (modo privado, etc) simplemente no persiste.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista])
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

  function motivoExpulsionEnPartido(jugadorId) {
    const roja = tarjetasDe(jugadorId).some((t) => t.tipo === TIPO_TARJETA.ROJA)
    return roja ? 'Roja directa' : '2 amarillas'
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

  // El numero de camiseta con el que se registro al jugador se puede
  // corregir directo desde la alineacion (no hace falta ir hasta
  // Jugadores) - actualiza el estado local al toque (optimista) y
  // guarda en Firestore por separado.
  async function handleGuardarCamiseta(jugadorId, valor) {
    const numero = valor === '' ? null : Number(valor)
    setJugadoresLocal((js) => js.map((j) => (j.id === jugadorId ? { ...j, numeroCamiseta: numero } : j)))
    setJugadoresVisitante((js) => js.map((j) => (j.id === jugadorId ? { ...j, numeroCamiseta: numero } : j)))
    try {
      await actualizarNumeroCamiseta(jugadorId, numero)
    } catch (err) {
      console.error('[ControlPartido]', err)
      setError('No se pudo guardar el número de camiseta.')
    }
  }

  // Mueve a un jugador a uno de los tres estados posibles para ESTE
  // partido (titular / suplente / pool-sin decidir) - optimista en el
  // estado local, y guarda ambos arrays en Firestore (el jugador nunca
  // queda en dos listas a la vez: entrar a una implica salir de la
  // otra).
  async function moverJugadorA(equipo, jugadorId, nuevoEstado) {
    const setTitulares = equipo === 'local' ? setTitularesLocal : setTitularesVisitante
    const setSuplentes = equipo === 'local' ? setSuplentesLocal : setSuplentesVisitante
    setTitulares((t) => (nuevoEstado === 'titular' ? [...new Set([...t, jugadorId])] : t.filter((id) => id !== jugadorId)))
    setSuplentes((s) => (nuevoEstado === 'suplente' ? [...new Set([...s, jugadorId])] : s.filter((id) => id !== jugadorId)))
    try {
      await Promise.all([
        actualizarTitular(partido.id, equipo, jugadorId, nuevoEstado === 'titular'),
        actualizarSuplente(partido.id, equipo, jugadorId, nuevoEstado === 'suplente'),
      ])
    } catch (err) {
      console.error('[ControlPartido]', err)
      setError('No se pudo guardar la alineación.')
    }
  }

  // Ya no se puede pasar del maximo del formato configurado (futbol
  // 6/7/11) - antes se avisaba con un confirm() y se dejaba agregar
  // igual, ahora se bloquea directo: hay que sacar a alguien primero.
  function puedeAgregarTitular(equipo, jugador) {
    const titulares = equipo === 'local' ? titularesLocal : titularesVisitante
    if (titulares.length >= jugadoresPorEquipo) {
      setError(
        `Este equipo ya tiene el máximo de ${jugadoresPorEquipo} titulares (fútbol ${jugadoresPorEquipo}). Sacá a alguien antes de agregar a ${jugador.nombre}.`
      )
      return false
    }
    return true
  }

  // Tocar a un titular para sacarlo no lo pasa directo a suplente: abre
  // el selector de "por quien entra" con los suplentes YA CONVOCADOS de
  // su mismo equipo, para que el cambio quede armado en un solo paso
  // (sale uno, entra otro) en vez de dos toques sueltos. Sin suplentes
  // convocados, sale directo al banco (no hay de donde elegir entrante).
  function handleTocarTitular(equipo, jugador) {
    const jugadoresEquipo = equipo === 'local' ? jugadoresLocal : jugadoresVisitante
    const suplentesIds = equipo === 'local' ? suplentesLocal : suplentesVisitante
    const candidatos = jugadoresEquipo.filter(
      (j) => j.id !== jugador.id && suplentesIds.includes(j.id) && !estaExpulsadoEnPartido(j.id)
    )
    if (candidatos.length === 0) {
      moverJugadorA(equipo, jugador.id, 'suplente')
      return
    }
    setCambio({ equipo, saliente: jugador, suplentes: candidatos })
  }

  // Tocar a un suplente lo promueve directo a titular (a diferencia de
  // un cambio, esto NO baja a nadie, asi que no se permite si ya se
  // llego al maximo del formato configurado).
  function handleTocarSuplente(equipo, jugador) {
    if (!puedeAgregarTitular(equipo, jugador)) return
    moverJugadorA(equipo, jugador.id, 'titular')
  }

  // Desde "Jugadores" (todavia sin decidir), elegir Titular o Suplente
  // para ESTE partido - a Suplente no tiene tope (no hay limite de
  // convocados en la banca).
  function handleElegirDesdePool(equipo, jugador, nuevoEstado) {
    if (nuevoEstado === 'titular' && !puedeAgregarTitular(equipo, jugador)) return
    moverJugadorA(equipo, jugador.id, nuevoEstado)
  }

  async function handleConfirmarCambio(entranteId) {
    if (!cambio) return
    const { equipo, saliente, suplentes } = cambio
    const entrante = suplentes.find((s) => s.id === entranteId)
    setCambio(null)
    await moverJugadorA(equipo, saliente.id, 'suplente')
    if (entrante) await moverJugadorA(equipo, entrante.id, 'titular')
  }

  function handleSacarSinReemplazo() {
    if (!cambio) return
    moverJugadorA(cambio.equipo, cambio.saliente.id, 'suplente')
    setCambio(null)
  }

  // Check manual de "trajo el DNI hoy" (aparte del dato que ya se
  // guarda en la ficha del jugador) - ver actualizarDniConfirmado.
  async function handleCambiarDni(equipo, jugadorId, confirmado) {
    const setDni = equipo === 'local' ? setDniConfirmadoLocal : setDniConfirmadoVisitante
    setDni((d) => (confirmado ? [...new Set([...d, jugadorId])] : d.filter((id) => id !== jugadorId)))
    try {
      await actualizarDniConfirmado(partido.id, equipo, jugadorId, confirmado)
    } catch (err) {
      console.error('[ControlPartido]', err)
      setError('No se pudo guardar el check de DNI.')
    }
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

  // Borra los goles y tarjetas del partido (revirtiendo el efecto de
  // las que ya estaban procesadas, ver eliminarTarjeta) y vuelve el
  // resultado a Pendiente - la alineacion (titulares, suplentes, DNI
  // confirmado) queda tal cual, no hace falta rearmarla si lo unico
  // que estaba mal era el marcador.
  async function handleReiniciarPartido() {
    if (
      !confirm(
        '¿Reiniciar este partido? Se borran los goles y las tarjetas cargados, y el resultado vuelve a Pendiente. La alineación no se toca.\n\nEsta acción no se puede deshacer.'
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
            titulo={nombreEquipo(partido.equipoLocalId)}
            jugadores={jugadoresLocal}
            titulares={titularesLocal}
            suplentes={suplentesLocal}
            dniConfirmados={dniConfirmadoLocal}
            jugadoresPorEquipo={jugadoresPorEquipo}
            color={colorLocal}
            abierto={alineacionAbierta.local}
            onToggle={() => setAlineacionAbierta((a) => ({ ...a, local: !a.local }))}
            onTocarTitular={(j) => handleTocarTitular('local', j)}
            onTocarSuplente={(j) => handleTocarSuplente('local', j)}
            onElegirDesdePool={(j, nuevoEstado) => handleElegirDesdePool('local', j, nuevoEstado)}
            estaExpulsado={estaExpulsadoEnPartido}
            motivoExpulsion={motivoExpulsionEnPartido}
            onGuardarCamiseta={handleGuardarCamiseta}
            onCambiarDni={(jugadorId, confirmado) => handleCambiarDni('local', jugadorId, confirmado)}
          />
          <SelectorAlineacion
            titulo={nombreEquipo(partido.equipoVisitanteId)}
            jugadores={jugadoresVisitante}
            titulares={titularesVisitante}
            suplentes={suplentesVisitante}
            dniConfirmados={dniConfirmadoVisitante}
            jugadoresPorEquipo={jugadoresPorEquipo}
            color={colorVisitante}
            abierto={alineacionAbierta.visitante}
            onToggle={() => setAlineacionAbierta((a) => ({ ...a, visitante: !a.visitante }))}
            onTocarTitular={(j) => handleTocarTitular('visitante', j)}
            onTocarSuplente={(j) => handleTocarSuplente('visitante', j)}
            onElegirDesdePool={(j, nuevoEstado) => handleElegirDesdePool('visitante', j, nuevoEstado)}
            estaExpulsado={estaExpulsadoEnPartido}
            motivoExpulsion={motivoExpulsionEnPartido}
            onGuardarCamiseta={handleGuardarCamiseta}
            onCambiarDni={(jugadorId, confirmado) => handleCambiarDni('visitante', jugadorId, confirmado)}
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
            {reiniciando ? 'Reiniciando…' : '↺ Reiniciar goles y tarjetas (no toca la alineación)'}
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
