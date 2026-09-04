import { useEffect, useRef, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import {
  listarPartidosPorCategoria,
  generarFixture,
  reiniciarResultadosFecha,
  reiniciarResultadosTodasLasFechas,
  reiniciarTemporadaCompleta,
  registrarResultadoPartido,
  eliminarPartido,
} from '../../../services/torneoPartidosService'
import { reconciliarSuspensionesPorFecha } from '../../../services/torneoTarjetasService'
import { calcularNumeroFechas, calcularLegPartido } from '../../../utils/fixtureTorneo'
import { CATEGORIA_TORNEO, CATEGORIA_TORNEO_LABELS } from '../../../models/torneo'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'
import ModalAgregarPartidoFecha from '../ModalAgregarPartidoFecha'
import ControlPartido from '../ControlPartido'
import { EscudoEquipo } from '../../shared/EscudoEquipo'

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

export default function TabFechas({ torneoId, onIrAPosiciones }) {
  const [categoria, setCategoria] = useState(() => {
    try {
      const guardada = sessionStorage.getItem(STORAGE_CATEGORIA)
      return Object.values(CATEGORIA_TORNEO).includes(guardada) ? guardada : CATEGORIA_TORNEO.MASTER
    } catch {
      return CATEGORIA_TORNEO.MASTER
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

  const [reiniciandoResultadosFecha, setReiniciandoResultadosFecha] = useState(false)
  const [errorReiniciarResultadosFecha, setErrorReiniciarResultadosFecha] = useState(null)

  const [reiniciandoResultadosTodas, setReiniciandoResultadosTodas] = useState(false)
  const [errorReiniciarResultadosTodas, setErrorReiniciarResultadosTodas] = useState(null)

  const [reiniciandoTodo, setReiniciandoTodo] = useState(false)
  const [errorReiniciarTodo, setErrorReiniciarTodo] = useState(null)

  const [guardandoTodos, setGuardandoTodos] = useState(false)

  const [modalAgregar, setModalAgregar] = useState(false)

  const [eliminandoPartido, setEliminandoPartido] = useState(null)

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

  // Vuelve a "Pendiente" los partidos de la fecha que se esta viendo,
  // sin borrar el fixture - sirve para corregir una fecha entera
  // cargada mal.
  async function handleReiniciarResultadosFecha() {
    if (fechaSeleccionada == null) return
    if (!confirm(`¿Reiniciar los resultados de la Fecha ${fechaSeleccionada}? Los partidos quedan pendientes de nuevo (no se borra el fixture ni las tarjetas).`)) return
    setReiniciandoResultadosFecha(true)
    setErrorReiniciarResultadosFecha(null)
    try {
      await reiniciarResultadosFecha(torneoId, categoria, fechaSeleccionada)
      await cargar()
    } catch (err) {
      console.error('[TabFechas]', err)
      setErrorReiniciarResultadosFecha(err.message || 'No se pudieron reiniciar los resultados de la fecha.')
    } finally {
      setReiniciandoResultadosFecha(false)
    }
  }

  // Igual que handleReiniciarResultadosFecha pero para todas las
  // fechas de la categoria a la vez.
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

  async function handlePartidoAgregado(fechaNumero) {
    setModalAgregar(false)
    await cargar()
    setFechaSeleccionada(fechaNumero)
  }

  function nombreEquipo(id) {
    return equipos.find((e) => e.id === id)?.nombre || '—'
  }

  const fechasDisponibles = [...new Set(partidos.filter((p) => p.fechaNumero != null).map((p) => p.fechaNumero))].sort((a, b) => a - b)
  const hayFixture = fechasDisponibles.length > 0
  const swipeFecha = useSwipeHorizontal(fechasDisponibles, fechaSeleccionada, setFechaSeleccionada)
  const partidosDeFecha = partidos.filter((p) => p.fechaNumero === fechaSeleccionada)
  const partidosPendientes = partidosDeFecha.filter((p) => {
    const valores = formResultados[p.id]
    return valores && valores.golesLocal !== undefined && valores.golesLocal !== '' &&
      valores.golesVisitante !== undefined && valores.golesVisitante !== ''
  })

  function fechaCompleta(f) {
    return partidos.filter((p) => p.fechaNumero === f).every((p) => p.golesLocal != null)
  }

  function fechaEmpezada(f) {
    return partidos.filter((p) => p.fechaNumero === f).some((p) => p.golesLocal != null)
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
          onVolver={() => setPartidoControl(null)}
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
      <div className="mb-4 flex overflow-hidden rounded-xl border border-line">
        {Object.values(CATEGORIA_TORNEO).map((c) => (
          <button
            key={c}
            onClick={() => setCategoria(c)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              categoria === c ? 'bg-brand text-white' : 'bg-surface text-ink-soft'
            }`}
          >
            {CATEGORIA_TORNEO_LABELS[c]}
          </button>
        ))}
      </div>

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
                    onClick={handleReiniciarResultadosFecha}
                    disabled={reiniciandoResultadosFecha || !partidosDeFecha.some((p) => p.golesLocal != null)}
                    className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-warning/30 hover:text-warning disabled:opacity-50"
                  >
                    {reiniciandoResultadosFecha ? '…' : `Reiniciar resultados (Fecha ${fechaSeleccionada})`}
                  </button>
                </div>
              </div>
            </>
          )}

          {errorReiniciarResultadosFecha && (
            <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorReiniciarResultadosFecha}</p>
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
                    nombreEquipo={nombreEquipo}
                    onAbrirControl={setPartidoControl}
                  />
                ))}
              </ul>
            )
          ) : (
            <div {...swipeFecha}>
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
                    nombreEquipo={nombreEquipo}
                    onAbrirControl={setPartidoControl}
                  />
                ))}
              </ul>

              {partidosDeFecha.length > 0 && (
                <button
                  onClick={handleGuardarTodos}
                  disabled={guardandoTodos || partidosPendientes.length === 0}
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
    </div>
  )
}

function FilaPartido({ partido, mostrarFecha, ocultarBoton, leg, form, onChange, onGuardar, guardando, onEliminar, eliminando, nombreEquipo, onAbrirControl }) {
  const golesLocal = form?.golesLocal ?? partido.golesLocal ?? ''
  const golesVisitante = form?.golesVisitante ?? partido.golesVisitante ?? ''
  const jugado = partido.golesLocal != null
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
            className="shrink-0 rounded-lg border border-line bg-surface px-2 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
            title="Alineación y eventos del partido"
          >
            📋 Control
          </button>
        )}
        <button
          onClick={() => onEliminar(partido)}
          disabled={eliminando}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm text-ink-soft/60 transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
          title="Eliminar partido"
        >
          {eliminando ? '…' : '×'}
        </button>
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
              jugado ? 'border-success/30 bg-success-soft' : 'border-line bg-paper'
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
              jugado ? 'border-success/30 bg-success-soft' : 'border-line bg-paper'
            }`}
          />
        </div>
      </div>

      {!ocultarBoton && (
        <div className="border-t border-line bg-paper px-3 py-2 text-right">
          <button
            onClick={() => onGuardar(partido)}
            disabled={guardando}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : jugado ? 'Corregir' : 'Guardar'}
          </button>
        </div>
      )}
    </li>
  )
}
