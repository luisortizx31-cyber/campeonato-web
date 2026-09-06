import { useEffect, useRef, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import {
  listarPartidosPorCategoria,
  generarFixture,
  reiniciarResultadosTodasLasFechas,
  reiniciarTemporadaCompleta,
  registrarResultadoPartido,
  reiniciarPartidoCompleto,
  actualizarFechaProgramada,
  eliminarPartido,
} from '../../../services/torneoPartidosService'
import { reconciliarSuspensionesPorFecha } from '../../../services/torneoTarjetasService'
import { calcularNumeroFechas, calcularLegPartido, formatearFechaProgramada, compararPartidosPorHorario } from '../../../utils/fixtureTorneo'
import { CATEGORIA_TORNEO_LABELS } from '../../../models/torneo'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'
import ModalAgregarPartidoFecha from '../ModalAgregarPartidoFecha'
import ModalReprogramarFecha from '../ModalReprogramarFecha'
import ControlPartido from '../ControlPartido'
import { EscudoEquipo } from '../../shared/EscudoEquipo'
import { SelectorCategoria } from '../../shared/SelectorCategoria'
import { SelectorFechaHora } from '../../shared/SelectorFechaHora'

/**
 * Genera el fixture "todos contra todos" de una categoria (una vez
 * que los equipos ya estan inscritos) y despues permite cargar, fecha
 * por fecha, el resultado de cada partido. La tabla de Posiciones se
 * recalcula sola apenas se guarda un resultado aca (usa los mismos
 * partidos de Firestore).
 *
 * El numero de "Fecha" que asigna el generador es solo una etiqueta
 * interna de organizacion (no hay calendario real en la app) - si el
 * campeonato ya arranco con un sorteo hecho por fuera, no hace falta
 * que coincida: el Maestro busca cada cruce ya jugado (con el
 * buscador) y le carga el resultado ahi, sin importar en que "Fecha"
 * del sistema haya quedado.
 */
// sessionStorage (no localStorage, es solo navegacion efimera dentro
// de la sesion) para que un refresh de pagina mientras se esta
// controlando un partido puntual (ver `partidoControl` mas abajo) no
// tire al Maestro de vuelta a la lista de fechas.
const STORAGE_CATEGORIA = 'campeonato_fechas_categoria'
const STORAGE_PARTIDO_CONTROL_ID = 'campeonato_fechas_partidoControlId'

export default function TabFechas({ torneoId, categoriasActivas, onIrAPosiciones }) {
  const [categoria, setCategoria] = useState(() => {
    try {
      const guardada = sessionStorage.getItem(STORAGE_CATEGORIA)
      return categoriasActivas.includes(guardada) ? guardada : categoriasActivas[0]
    } catch {
      return categoriasActivas[0]
    }
  })
  const [equipos, setEquipos] = useState([])
  const [partidos, setPartidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [idaYVuelta, setIdaYVuelta] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [errorGenerar, setErrorGenerar] = useState(null)

  const [fechaSeleccionada, setFechaSeleccionada] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [formResultados, setFormResultados] = useState({})
  const [guardandoPartido, setGuardandoPartido] = useState(null)
  const [errorGuardar, setErrorGuardar] = useState(null)

  const [reiniciandoResultadosTodas, setReiniciandoResultadosTodas] = useState(false)
  const [errorReiniciarResultadosTodas, setErrorReiniciarResultadosTodas] = useState(null)

  const [reiniciandoTodo, setReiniciandoTodo] = useState(false)
  const [errorReiniciarTodo, setErrorReiniciarTodo] = useState(null)

  const [guardandoTodos, setGuardandoTodos] = useState(false)

  const [modalAgregar, setModalAgregar] = useState(false)
  const [modalReprogramar, setModalReprogramar] = useState(false)

  const [eliminandoPartido, setEliminandoPartido] = useState(null)
  const [reiniciandoPartido, setReiniciandoPartido] = useState(null)

  const [partidoControl, setPartidoControl] = useState(null)
  const restauroPartidoControl = useRef(false)

  const barraFechasRef = useRef(null)
  useEffect(() => {
    if (!barraFechasRef.current || fechaSeleccionada == null) return
    const activo = barraFechasRef.current.querySelector(`[data-fecha="${fechaSeleccionada}"]`)
    activo?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [fechaSeleccionada])

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_CATEGORIA, categoria)
    } catch {
      // Sin sessionStorage (modo privado, etc) simplemente no persiste.
    }
  }, [categoria])

  // OJO: este efecto NO puede escribir en sessionStorage hasta que se
  // haya intentado restaurar (ver mas abajo) - partidoControl arranca
  // en null en el primer render, asi que si escribiera desde el
  // principio borraria el id guardado (con removeItem) ANTES de que
  // el efecto de restauracion llegara a leerlo, porque ese espera a
  // que termine la primera carga (cargando pasa a false mas tarde).
  // Eso era justo lo que rompia el refresh: volvia siempre a la lista
  // de fechas en vez de reabrir el Control de Partido.
  useEffect(() => {
    if (!restauroPartidoControl.current) return
    try {
      if (partidoControl) sessionStorage.setItem(STORAGE_PARTIDO_CONTROL_ID, partidoControl.id)
      else sessionStorage.removeItem(STORAGE_PARTIDO_CONTROL_ID)
    } catch {
      // Sin sessionStorage (modo privado, etc) simplemente no persiste.
    }
  }, [partidoControl])

  // Una sola vez, apenas termina la primera carga: si habia un
  // Control de Partido abierto antes del refresh, lo reabre con el
  // partido ya actualizado (no con una copia vieja del storage).
  useEffect(() => {
    if (restauroPartidoControl.current || cargando) return
    try {
      const idGuardado = sessionStorage.getItem(STORAGE_PARTIDO_CONTROL_ID)
      if (idGuardado) {
        const encontrado = partidos.find((p) => p.id === idGuardado)
        if (encontrado) setPartidoControl(encontrado)
      }
    } catch {
      // Sin sessionStorage (modo privado, etc) simplemente no restaura.
    } finally {
      restauroPartidoControl.current = true
    }
  }, [cargando, partidos])

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [eq, ps] = await Promise.all([
        listarEquiposPorCategoria(torneoId, categoria),
        listarPartidosPorCategoria(torneoId, categoria),
      ])
      setEquipos(eq)
      setPartidos(ps)
      setFormResultados({})

      // Apenas el equipo de un suspendido termina de jugar su partido de
      // la fecha (aunque otro partido de la misma fecha quede pendiente),
      // esto lo levanta solo - no afecta lo que se ve en esta pestaña, es
      // para que Amonestados y la pagina publica salgan al dia sin que el
      // Maestro tenga que acordarse de nada.
      reconciliarSuspensionesPorFecha(torneoId, categoria, ps).catch((err) =>
        console.error('[TabFechas] reconciliarSuspensionesPorFecha', err)
      )

      const fechas = [...new Set(ps.filter((p) => p.fechaNumero != null).map((p) => p.fechaNumero))].sort((a, b) => a - b)
      setFechaSeleccionada((actual) => {
        if (fechas.length === 0) return null
        if (actual && fechas.includes(actual)) return actual
        const pendiente = fechas.find((f) => ps.some((p) => p.fechaNumero === f && p.golesLocal == null))
        return pendiente ?? fechas[0]
      })
    } catch (err) {
      console.error('[TabFechas]', err)
      setError('No se pudieron cargar los datos del fixture.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [torneoId, categoria])

  async function handleGenerar() {
    const numFechas = calcularNumeroFechas(equipos.length, idaYVuelta)
    if (!confirm(`¿Generar el fixture de ${CATEGORIA_TORNEO_LABELS[categoria]}? Se crearán ${numFechas} fechas.`)) return
    setGenerando(true)
    setErrorGenerar(null)
    try {
      await generarFixture({ torneoId, categoria, equipoIds: equipos.map((e) => e.id), idaYVuelta })
      await cargar()
    } catch (err) {
      console.error('[TabFechas]', err)
      setErrorGenerar(err.message || 'No se pudo generar el fixture.')
    } finally {
      setGenerando(false)
    }
  }

  // Igual que el reinicio individual por partido (ver ↺ en cada fila)
  // pero para todas las fechas de la categoria a la vez.
  async function handleReiniciarResultadosTodas() {
    const confirmacion = confirm(
      `¿Reiniciar los resultados de TODAS las fechas de ${CATEGORIA_TORNEO_LABELS[categoria]}?\n\n` +
        'Todos los partidos quedan pendientes de nuevo. El fixture, las tarjetas y las sanciones NO se borran.'
    )
    if (!confirmacion) return
    setReiniciandoResultadosTodas(true)
    setErrorReiniciarResultadosTodas(null)
    try {
      await reiniciarResultadosTodasLasFechas(torneoId, categoria)
      await cargar()
    } catch (err) {
      console.error('[TabFechas]', err)
      setErrorReiniciarResultadosTodas(err.message || 'No se pudieron reiniciar los resultados.')
    } finally {
      setReiniciandoResultadosTodas(false)
    }
  }

  // Borra TODO lo del campeonato de esta categoria - partidos,
  // tarjetas y sanciones - sin bloquearse por nada, para volver al
  // punto de partida cuando el Maestro quiere empezar de cero (incluye
  // rehacer el fixture desde "Generar fechas"). Los equipos y
  // jugadores registrados se mantienen.
  async function handleReiniciarTodo() {
    const confirmacion = confirm(
      `¿Reiniciar TODO el campeonato de ${CATEGORIA_TORNEO_LABELS[categoria]}?\n\n` +
        'Esto borra todos los partidos, resultados, tarjetas y sanciones de esta categoría. ' +
        'Los equipos y jugadores inscritos NO se borran.\n\nEsta acción no se puede deshacer.'
    )
    if (!confirmacion) return
    setReiniciandoTodo(true)
    setErrorReiniciarTodo(null)
    try {
      await reiniciarTemporadaCompleta(torneoId, categoria)
      await cargar()
    } catch (err) {
      console.error('[TabFechas]', err)
      setErrorReiniciarTodo(err.message || 'No se pudo reiniciar el campeonato.')
    } finally {
      setReiniciandoTodo(false)
    }
  }

  function actualizarResultadoForm(partidoId, campo, valor) {
    setFormResultados((f) => ({ ...f, [partidoId]: { ...f[partidoId], [campo]: valor } }))
  }

  async function handleGuardarResultado(partido) {
    const bloqueante = partidoBloqueadoPor(partido)
    if (bloqueante) {
      setErrorGuardar(mensajeBloqueo(bloqueante, partido.fechaNumero))
      return
    }
    const valores = formResultados[partido.id] || {}
    const golesLocal = valores.golesLocal ?? partido.golesLocal
    const golesVisitante = valores.golesVisitante ?? partido.golesVisitante
    if (golesLocal === '' || golesLocal == null || golesVisitante === '' || golesVisitante == null) {
      setErrorGuardar('Completa el marcador de los dos equipos.')
      return
    }
    setGuardandoPartido(partido.id)
    setErrorGuardar(null)
    try {
      await registrarResultadoPartido(partido.id, { golesLocal, golesVisitante })
      await cargar()
    } catch (err) {
      console.error('[TabFechas]', err)
      setErrorGuardar(err.message || 'No se pudo guardar el resultado.')
    } finally {
      setGuardandoPartido(null)
    }
  }

  // Guarda de una sola vez todos los partidos de la fecha actual que
  // el Maestro tocó en este formulario (los que nunca edito no se
  // reescriben). Asi puede llenar todos los marcadores de la fecha y
  // guardar con un solo click, en vez de uno por partido.
  async function handleGuardarTodos() {
    const bloqueante = partidosSinFinalizar.find((p) => p.fechaNumero < fechaSeleccionada)
    if (bloqueante) {
      setErrorGuardar(mensajeBloqueo(bloqueante, fechaSeleccionada))
      return
    }
    const pendientes = partidosDeFecha.filter((p) => {
      const valores = formResultados[p.id]
      return valores && valores.golesLocal !== undefined && valores.golesLocal !== '' &&
        valores.golesVisitante !== undefined && valores.golesVisitante !== ''
    })
    if (pendientes.length === 0) return

    setGuardandoTodos(true)
    setErrorGuardar(null)
    try {
      for (const p of pendientes) {
        const valores = formResultados[p.id]
        await registrarResultadoPartido(p.id, { golesLocal: valores.golesLocal, golesVisitante: valores.golesVisitante })
      }
      await cargar()
    } catch (err) {
      console.error('[TabFechas]', err)
      setErrorGuardar(err.message || 'No se pudieron guardar los resultados.')
    } finally {
      setGuardandoTodos(false)
    }
  }

  async function handleEliminarPartido(partido) {
    if (!confirm('¿Eliminar este partido?')) return
    setEliminandoPartido(partido.id)
    setErrorGuardar(null)
    try {
      await eliminarPartido(partido.id)
      await cargar()
    } catch (err) {
      console.error('[TabFechas]', err)
      setErrorGuardar(err.message || 'No se pudo eliminar el partido.')
    } finally {
      setEliminandoPartido(null)
    }
  }

  // Reinicio de UN solo partido (icono ↺ en la fila) - borra sus
  // goles y tarjetas y vuelve su resultado a Pendiente, sin tocar el
  // resto de la fecha ni la alineación. Misma logica que el boton
  // "↺ Reiniciar goles y tarjetas" de Control de Partido (ver
  // torneoPartidosService.reiniciarPartidoCompleto), para no tener
  // que entrar a Control solo para corregir un partido puntual.
  async function handleReiniciarPartidoIndividual(partido) {
    if (
      !confirm(
        '¿Reiniciar este partido? Se borran los goles y las tarjetas cargados, y el resultado vuelve a Pendiente. La alineación no se toca.\n\nEsta acción no se puede deshacer.'
      )
    )
      return
    setReiniciandoPartido(partido.id)
    setErrorGuardar(null)
    try {
      await reiniciarPartidoCompleto(partido.id)
      await cargar()
    } catch (err) {
      console.error('[TabFechas]', err)
      setErrorGuardar(err.message || 'No se pudo reiniciar el partido.')
    } finally {
      setReiniciandoPartido(null)
    }
  }

  // Dia/hora programado de UN partido (icono 🗓 en la fila) - ver
  // torneoPartidosService.actualizarFechaProgramada. Re-tira el error
  // para que FilaPartido sepa que fallo y se quede en modo edicion en
  // vez de cerrarlo como si hubiera guardado bien.
  async function handleGuardarFechaProgramada(partidoId, fechaHora) {
    setErrorGuardar(null)
    try {
      await actualizarFechaProgramada(partidoId, fechaHora)
      await cargar()
    } catch (err) {
      console.error('[TabFechas]', err)
      setErrorGuardar(err.message || 'No se pudo guardar el horario.')
      throw err
    }
  }

  async function handlePartidoAgregado(fechaNumero) {
    setModalAgregar(false)
    await cargar()
    setFechaSeleccionada(fechaNumero)
  }

  function nombreEquipo(id) {
    return equipos.find((e) => e.id === id)?.nombre || '—'
  }

  // Partido "en vivo" (alineacion ya cargada, ver enVivo en FilaPartido
  // mas abajo) pero sin finalizar todavia. Mientras alguno de una fecha
  // ANTERIOR quede asi, no se deja tocar (ni abrir Control ni cargar
  // resultado) ningun partido de una fecha posterior - para no repetir
  // el caso de tarjetas "en borrador" que se quedan sin aplicar porque
  // el Maestro sigue de largo con la fecha siguiente sin darse cuenta
  // de que dejo uno a medias (ver torneoTarjetasService.
  // finalizarTarjetasPartido). Una fecha que directamente todavia no
  // arranco (ej. reprogramada para mas adelante) NO bloquea nada - solo
  // una que quedo empezada y sin cerrar.
  function partidoEnVivoSinFinalizar(p) {
    return p.golesLocal == null && (p.titularesLocal?.length > 0 || p.titularesVisitante?.length > 0)
  }
  const partidosSinFinalizar = partidos.filter(partidoEnVivoSinFinalizar)

  function partidoBloqueadoPor(partido) {
    return partidosSinFinalizar.find((p) => p.id !== partido.id && p.fechaNumero < partido.fechaNumero)
  }

  function mensajeBloqueo(bloqueante, fechaDestino) {
    return `Primero terminá el partido de ${nombreEquipo(bloqueante.equipoLocalId)} vs ${nombreEquipo(bloqueante.equipoVisitanteId)} (Fecha ${bloqueante.fechaNumero}) antes de seguir con la Fecha ${fechaDestino}.`
  }

  function handleAbrirControl(partido) {
    const bloqueante = partidoBloqueadoPor(partido)
    if (bloqueante) {
      setErrorGuardar(mensajeBloqueo(bloqueante, partido.fechaNumero))
      return
    }
    setPartidoControl(partido)
  }

  const fechasDisponibles = [...new Set(partidos.filter((p) => p.fechaNumero != null).map((p) => p.fechaNumero))].sort((a, b) => a - b)
  const hayFixture = fechasDisponibles.length > 0
  const swipeFecha = useSwipeHorizontal(fechasDisponibles, fechaSeleccionada, setFechaSeleccionada)
  // Pendientes de menor a mayor hora programada primero, los ya
  // jugados al final (ver compararPartidosPorHorario).
  const partidosDeFecha = partidos
    .filter((p) => p.fechaNumero === fechaSeleccionada)
    .sort(compararPartidosPorHorario)
  // Fecha de referencia para prellenar ModalReprogramarFecha - la mas
  // temprana entre los partidos no jugados de la fecha seleccionada
  // (si ninguno tiene horario puesto todavia, queda null y el modal
  // arranca vacio).
  const fechaReferenciaSeleccionada = (() => {
    const conFecha = partidosDeFecha.filter((p) => p.golesLocal == null && p.fecha)
    if (conFecha.length === 0) return null
    return new Date(Math.min(...conFecha.map((p) => p.fecha.toMillis())))
  })()
  const partidosPendientes = partidosDeFecha.filter((p) => {
    const valores = formResultados[p.id]
    return valores && valores.golesLocal !== undefined && valores.golesLocal !== '' &&
      valores.golesVisitante !== undefined && valores.golesVisitante !== ''
  })
  const fechaSeleccionadaBloqueadaPor = partidosSinFinalizar.find((p) => p.fechaNumero < fechaSeleccionada)

  function fechaCompleta(f) {
    return partidos.filter((p) => p.fechaNumero === f).every((p) => p.golesLocal != null)
  }

  function fechaEmpezada(f) {
    return partidos
      .filter((p) => p.fechaNumero === f)
      .some((p) => p.golesLocal != null || p.titularesLocal?.length > 0 || p.titularesVisitante?.length > 0)
  }

  // Si una fecha es toda "vuelta" (revancha de una fecha anterior),
  // toda "ida", o mixta/sin revancha - se deduce de los cruces (ver
  // calcularLegPartido), no de como se genero el fixture.
  function fechaLeg(f) {
    const partidosF = partidos.filter((p) => p.fechaNumero === f)
    if (partidosF.length === 0) return null
    const legs = new Set(partidosF.map((p) => calcularLegPartido(p, partidos)))
    if (legs.size === 1) return [...legs][0] // 'ida' | 'vuelta' | null
    return 'mixta'
  }
  const fechasIda = fechasDisponibles.filter((f) => fechaLeg(f) === 'ida')
  const fechasVuelta = fechasDisponibles.filter((f) => fechaLeg(f) === 'vuelta')

  const busquedaNormalizada = busqueda.trim().toLowerCase()
  const resultadosBusqueda = busquedaNormalizada
    ? partidos
        .filter((p) => p.fechaNumero != null)
        .filter((p) => {
          const local = nombreEquipo(p.equipoLocalId).toLowerCase()
          const visitante = nombreEquipo(p.equipoVisitanteId).toLowerCase()
          return local.includes(busquedaNormalizada) || visitante.includes(busquedaNormalizada)
        })
        .sort((a, b) => a.fechaNumero - b.fechaNumero)
    : []

  if (partidoControl) {
    return (
      <div>
        <ControlPartido
          torneoId={torneoId}
          categoria={categoria}
          partido={partidoControl}
          nombreEquipo={nombreEquipo}
          onVolver={async () => {
            setPartidoControl(null)
            await cargar()
          }}
          onFinalizado={async () => {
            setPartidoControl(null)
            await cargar()
          }}
        />
      </div>
    )
  }

  return (
    <div>
      <SelectorCategoria categorias={categoriasActivas} activa={categoria} onCambiar={setCategoria} />

      {cargando && <p className="text-sm text-ink-soft">Cargando…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!cargando && !error && !hayFixture && (
        <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Generar fechas</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {equipos.length} equipo(s) inscritos en {CATEGORIA_TORNEO_LABELS[categoria]}.
            </p>
          </div>

          {equipos.length < 2 ? (
            <p className="text-sm text-ink-soft">
              Necesitas al menos 2 equipos inscritos en esta categoría para generar el fixture.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Formato</label>
                <select
                  value={idaYVuelta ? 'true' : 'false'}
                  onChange={(e) => setIdaYVuelta(e.target.value === 'true')}
                  className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
                >
                  <option value="false">Solo ida (cada equipo juega una vez contra cada rival)</option>
                  <option value="true">Ida y vuelta (cada equipo juega dos veces contra cada rival)</option>
                </select>
              </div>

              <p className="text-sm text-ink-soft">
                Esto va a generar <strong className="text-ink">{calcularNumeroFechas(equipos.length, idaYVuelta)} fechas</strong>.
              </p>

              {errorGenerar && (
                <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorGenerar}</p>
              )}

              <button
                onClick={handleGenerar}
                disabled={generando}
                className="w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-60"
              >
                {generando ? 'Generando…' : 'Generar fechas'}
              </button>
            </>
          )}

          {equipos.length >= 2 && (
            <div className="border-t border-line pt-4">
              <p className="mb-2 text-xs text-ink-soft">
                ¿El campeonato ya arrancó con un sorteo hecho por fuera? Cargá los cruces a mano, fecha
                por fecha, en vez de generar el fixture automático.
              </p>
              <button
                onClick={() => setModalAgregar(true)}
                className="w-full rounded-lg border border-line py-2.5 text-sm font-medium text-ink"
              >
                + Agregar partido a mano
              </button>
            </div>
          )}
        </div>
      )}

      {!cargando && !error && hayFixture && (
        <>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar un cruce por equipo…"
            className="mb-3 w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 outline-none focus-visible:border-brand"
          />

          {!busquedaNormalizada && (
            <>
              {fechasVuelta.length > 0 && (
                <p className="mb-2 text-xs text-ink-soft">
                  <span className="font-semibold text-brand">Ida:</span> Fecha {Math.min(...fechasIda)}–{Math.max(...fechasIda)}
                  {'  ·  '}
                  <span className="font-semibold text-gold">Vuelta:</span> Fecha {Math.min(...fechasVuelta)}–{Math.max(...fechasVuelta)}
                </p>
              )}
              <div ref={barraFechasRef} className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
                {fechasDisponibles.map((f) => {
                  const completa = fechaCompleta(f)
                  const empezada = !completa && fechaEmpezada(f)
                  const activa = fechaSeleccionada === f
                  const esPrimeraVuelta = fechasVuelta.length > 0 && f === Math.min(...fechasVuelta)
                  return (
                    <div key={f} className="flex shrink-0 items-center gap-1.5">
                      {esPrimeraVuelta && <span className="h-6 w-px shrink-0 bg-line" />}
                      <button
                        data-fecha={f}
                        onClick={() => setFechaSeleccionada(f)}
                        className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all ${
                          activa
                            ? 'border-brand bg-brand text-white shadow-sm'
                            : completa
                              ? 'border-danger/30 bg-danger-soft text-danger'
                              : empezada
                                ? 'border-warning/30 bg-warning-soft text-warning'
                                : 'border-line bg-surface text-ink-soft'
                        }`}
                      >
                        Fecha {f}{completa ? ' ✓' : ''}
                      </button>
                    </div>
                  )
                })}
              </div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                {onIrAPosiciones && (
                  <button
                    onClick={onIrAPosiciones}
                    className="flex animate-pulse items-center gap-1.5 text-sm font-medium text-brand transition-colors hover:text-brand-dark"
                  >
                    📊 Ver tabla de posiciones
                  </button>
                )}
                <div className="ml-auto flex flex-wrap justify-end gap-2">
                  <button
                    onClick={() => setModalAgregar(true)}
                    className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
                  >
                    + Agregar partido
                  </button>
                  <button
                    onClick={() => setModalReprogramar(true)}
                    className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
                  >
                    📅 Programar fecha
                  </button>
                </div>
              </div>
            </>
          )}

          {errorGuardar && (
            <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorGuardar}</p>
          )}

          {busquedaNormalizada ? (
            resultadosBusqueda.length === 0 ? (
              <p className="text-sm text-ink-soft">No hay ningún cruce que coincida con "{busqueda}".</p>
            ) : (
              <ul className="space-y-2.5">
                {resultadosBusqueda.map((p) => (
                  <FilaPartido
                    key={p.id}
                    partido={p}
                    mostrarFecha
                    leg={calcularLegPartido(p, partidos)}
                    form={formResultados[p.id]}
                    onChange={actualizarResultadoForm}
                    onGuardar={handleGuardarResultado}
                    guardando={guardandoPartido === p.id}
                    onEliminar={handleEliminarPartido}
                    eliminando={eliminandoPartido === p.id}
                    onReiniciar={handleReiniciarPartidoIndividual}
                    reiniciando={reiniciandoPartido === p.id}
                    onGuardarHorario={handleGuardarFechaProgramada}
                    nombreEquipo={nombreEquipo}
                    onAbrirControl={handleAbrirControl}
                    bloqueadoPor={partidoBloqueadoPor(p)}
                  />
                ))}
              </ul>
            )
          ) : (
            <div {...swipeFecha}>
              {fechaSeleccionadaBloqueadaPor && (
                <p className="mb-2.5 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
                  ⚠ Tenés un partido sin finalizar en la Fecha {fechaSeleccionadaBloqueadaPor.fechaNumero} (
                  {nombreEquipo(fechaSeleccionadaBloqueadaPor.equipoLocalId)} vs{' '}
                  {nombreEquipo(fechaSeleccionadaBloqueadaPor.equipoVisitanteId)}) - terminalo antes de cargar
                  resultados de esta fecha.
                </p>
              )}
              <ul className="space-y-2.5">
                {partidosDeFecha.map((p) => (
                  <FilaPartido
                    key={p.id}
                    partido={p}
                    ocultarBoton
                    leg={calcularLegPartido(p, partidos)}
                    form={formResultados[p.id]}
                    onChange={actualizarResultadoForm}
                    onEliminar={handleEliminarPartido}
                    eliminando={eliminandoPartido === p.id}
                    onReiniciar={handleReiniciarPartidoIndividual}
                    reiniciando={reiniciandoPartido === p.id}
                    onGuardarHorario={handleGuardarFechaProgramada}
                    nombreEquipo={nombreEquipo}
                    onAbrirControl={handleAbrirControl}
                    bloqueadoPor={partidoBloqueadoPor(p)}
                  />
                ))}
              </ul>

              {partidosDeFecha.length > 0 && (
                <button
                  onClick={handleGuardarTodos}
                  disabled={guardandoTodos || partidosPendientes.length === 0 || Boolean(fechaSeleccionadaBloqueadaPor)}
                  className="mt-3 w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-50"
                >
                  {guardandoTodos
                    ? 'Guardando…'
                    : `Guardar resultados de esta fecha${partidosPendientes.length > 0 ? ` (${partidosPendientes.length})` : ''}`}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {!cargando && !error && hayFixture && (
        <div className="mt-6 border-t border-line pt-4 text-center">
          {errorReiniciarResultadosTodas && (
            <p className="mb-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorReiniciarResultadosTodas}</p>
          )}
          <button
            onClick={handleReiniciarResultadosTodas}
            disabled={reiniciandoResultadosTodas}
            className="text-xs text-warning underline disabled:opacity-50"
          >
            {reiniciandoResultadosTodas
              ? 'Reiniciando…'
              : `Reiniciar resultados de TODAS las fechas de ${CATEGORIA_TORNEO_LABELS[categoria]} (deja el fixture intacto)`}
          </button>
        </div>
      )}

      {!cargando && !error && (
        <div className="mt-3 border-t border-line pt-4 text-center">
          {errorReiniciarTodo && (
            <p className="mb-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorReiniciarTodo}</p>
          )}
          <button
            onClick={handleReiniciarTodo}
            disabled={reiniciandoTodo}
            className="text-xs text-danger underline disabled:opacity-50"
          >
            {reiniciandoTodo
              ? 'Reiniciando…'
              : `Reiniciar TODO el campeonato de ${CATEGORIA_TORNEO_LABELS[categoria]} (partidos, tarjetas y sanciones)`}
          </button>
        </div>
      )}

      {modalAgregar && (
        <ModalAgregarPartidoFecha
          torneoId={torneoId}
          categoria={categoria}
          equipos={equipos}
          partidos={partidos}
          fechaSugerida={fechaSeleccionada || Math.max(0, ...fechasDisponibles) + 1}
          onCerrar={() => setModalAgregar(false)}
          onGuardado={handlePartidoAgregado}
        />
      )}

      {modalReprogramar && (
        <ModalReprogramarFecha
          torneoId={torneoId}
          categoria={categoria}
          fechaNumero={fechaSeleccionada}
          fechaReferencia={fechaReferenciaSeleccionada}
          onCerrar={() => setModalReprogramar(false)}
          onGuardado={async () => {
            setModalReprogramar(false)
            await cargar()
          }}
        />
      )}
    </div>
  )
}

function FilaPartido({ partido, mostrarFecha, ocultarBoton, leg, form, onChange, onGuardar, guardando, onEliminar, eliminando, onReiniciar, reiniciando, onGuardarHorario, nombreEquipo, onAbrirControl, bloqueadoPor }) {
  const [editandoHorario, setEditandoHorario] = useState(false)
  const [horarioDraft, setHorarioDraft] = useState(null) // Date | null
  const [guardandoHorario, setGuardandoHorario] = useState(false)

  function abrirEdicionHorario() {
    setHorarioDraft(partido.fecha ? partido.fecha.toDate() : null)
    setEditandoHorario(true)
  }

  async function guardarHorario() {
    setGuardandoHorario(true)
    try {
      await onGuardarHorario(partido.id, horarioDraft)
      setEditandoHorario(false)
    } catch {
      // el error ya lo muestra el padre (errorGuardar) - se queda en modo edicion
    } finally {
      setGuardandoHorario(false)
    }
  }

  const jugado = partido.golesLocal != null
  // "En vivo": ya se armo la alineacion (se abrio Control de Partido)
  // pero todavia no se finalizo - el marcador que se ve viene de
  // golesLocalEnVivo/golesVisitanteEnVivo, que ControlPartido
  // actualiza solo cada vez que cambia un gol (ver
  // torneoPartidosService.actualizarMarcadorEnVivo). Prefill del
  // input con ese valor para no tener que retipearlo al finalizar.
  const enVivo = !jugado && (partido.titularesLocal?.length > 0 || partido.titularesVisitante?.length > 0)
  const golesLocal = form?.golesLocal ?? partido.golesLocal ?? (enVivo ? partido.golesLocalEnVivo ?? 0 : '')
  const golesVisitante = form?.golesVisitante ?? partido.golesVisitante ?? (enVivo ? partido.golesVisitanteEnVivo ?? 0 : '')
  const ganoLocal = jugado && partido.golesLocal > partido.golesVisitante
  const ganoVisitante = jugado && partido.golesVisitante > partido.golesLocal
  const nombreLocal = nombreEquipo(partido.equipoLocalId)
  const nombreVisitante = nombreEquipo(partido.equipoVisitanteId)

  return (
    <li
      className={`overflow-hidden rounded-2xl border border-l-4 bg-surface shadow-sm transition-colors ${
        jugado ? 'border-line border-l-success' : 'border-dashed border-line border-l-line'
      }`}
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-1">
        {mostrarFecha ? (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
            Fecha {partido.fechaNumero}
          </span>
        ) : jugado ? (
          <span className="flex items-center gap-1 text-[11px] font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Jugado
          </span>
        ) : enVivo ? (
          <span className="flex items-center gap-1 text-[11px] font-medium text-danger">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" /> En vivo
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-medium text-ink-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-line" /> Pendiente
          </span>
        )}
        {leg === 'ida' && (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">Ida</span>
        )}
        {leg === 'vuelta' && (
          <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-semibold text-gold">↩ Vuelta</span>
        )}
        <span className="flex-1" />
        {onAbrirControl && (
          <button
            onClick={() => onAbrirControl(partido)}
            disabled={Boolean(bloqueadoPor)}
            className="shrink-0 rounded-lg border border-line bg-surface px-2 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-soft"
            title={
              bloqueadoPor
                ? `Terminá primero el partido de ${nombreEquipo(bloqueadoPor.equipoLocalId)} vs ${nombreEquipo(bloqueadoPor.equipoVisitanteId)} (Fecha ${bloqueadoPor.fechaNumero})`
                : 'Alineación y eventos del partido'
            }
          >
            📋 Control
          </button>
        )}
        <button
          onClick={() => onReiniciar(partido)}
          disabled={reiniciando}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm text-ink-soft/60 transition-colors hover:bg-warning-soft hover:text-warning disabled:opacity-50"
          title="Reiniciar goles y tarjetas de este partido"
        >
          {reiniciando ? '…' : '↺'}
        </button>
        <button
          onClick={() => onEliminar(partido)}
          disabled={eliminando}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm text-ink-soft/60 transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
          title="Eliminar partido"
        >
          {eliminando ? '…' : '×'}
        </button>
      </div>

      <div className="px-3 pb-1">
        {editandoHorario ? (
          <div className="space-y-1.5">
            <SelectorFechaHora value={horarioDraft} onChange={setHorarioDraft} disabled={guardandoHorario} />
            <div className="flex items-center gap-1.5">
              <button
                onClick={guardarHorario}
                disabled={guardandoHorario}
                className="shrink-0 rounded-lg bg-brand px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50"
              >
                {guardandoHorario ? '…' : 'Guardar'}
              </button>
              <button
                onClick={() => setEditandoHorario(false)}
                disabled={guardandoHorario}
                className="shrink-0 rounded-lg border border-line px-2 py-1 text-[11px] text-ink-soft disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={abrirEdicionHorario}
            className={`text-[11px] font-medium ${partido.fecha ? 'text-ink-soft' : 'text-brand'}`}
          >
            {partido.fecha ? `🗓 ${formatearFechaProgramada(partido.fecha)}` : '+ Programar horario'}
          </button>
        )}
      </div>

      <div className="space-y-1.5 px-3 pb-3 pt-1">
        <div className="flex items-center gap-2">
          <EscudoEquipo nombre={nombreLocal} />
          <span
            className={`min-w-0 flex-1 truncate text-sm ${
              ganoLocal ? 'font-bold text-ink' : ganoVisitante ? 'font-medium text-ink-soft' : 'font-medium text-ink'
            }`}
          >
            {nombreLocal}
          </span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={golesLocal}
            onChange={(e) => onChange(partido.id, 'golesLocal', e.target.value)}
            className={`money w-12 shrink-0 rounded-lg border py-1.5 text-center text-base font-bold text-ink outline-none focus-visible:border-brand ${
              jugado ? 'border-success/30 bg-success-soft' : enVivo ? 'border-danger/30 bg-danger-soft' : 'border-line bg-paper'
            }`}
          />
        </div>
        <div className="flex items-center gap-2">
          <EscudoEquipo nombre={nombreVisitante} />
          <span
            className={`min-w-0 flex-1 truncate text-sm ${
              ganoVisitante ? 'font-bold text-ink' : ganoLocal ? 'font-medium text-ink-soft' : 'font-medium text-ink'
            }`}
          >
            {nombreVisitante}
          </span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={golesVisitante}
            onChange={(e) => onChange(partido.id, 'golesVisitante', e.target.value)}
            className={`money w-12 shrink-0 rounded-lg border py-1.5 text-center text-base font-bold text-ink outline-none focus-visible:border-brand ${
              jugado ? 'border-success/30 bg-success-soft' : enVivo ? 'border-danger/30 bg-danger-soft' : 'border-line bg-paper'
            }`}
          />
        </div>
      </div>

      {!ocultarBoton && (
        <div className="border-t border-line bg-paper px-3 py-2 text-right">
          {bloqueadoPor && (
            <p className="mb-1.5 text-left text-[11px] text-warning">
              ⚠ Terminá antes el partido de Fecha {bloqueadoPor.fechaNumero}
            </p>
          )}
          <button
            onClick={() => onGuardar(partido)}
            disabled={guardando || Boolean(bloqueadoPor)}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : jugado ? 'Corregir' : 'Guardar'}
          </button>
        </div>
      )}
    </li>
  )
}
