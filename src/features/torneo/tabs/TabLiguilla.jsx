import { Fragment, useEffect, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { listarPartidosPorCategoria, actualizarFechaProgramada } from '../../../services/torneoPartidosService'
import { listarAjustesPorCategoria } from '../../../services/torneoAjustesService'
import { obtenerConfigCategoria } from '../../../services/torneoConfigService'
import {
  obtenerEstadoLiguilla,
  iniciarLiguilla,
  generarRondaLiguilla,
  iniciarLiguillaGrupo,
  definirGanadorPartidoLiguilla,
  reiniciarLiguilla,
} from '../../../services/torneoLiguillaService'
import { calcularTablaPosiciones } from '../../../utils/tablaPosiciones'
import { armarCrucesRonda1, sortearCruces, reconstruirBracket, nombreRonda } from '../../../utils/liguillaTorneo'
import { formatearFechaProgramada } from '../../../utils/fixtureTorneo'
import { FASE_LIGUILLA, FORMATO_LIGUILLA } from '../../../models/torneo'
import { SelectorCategoria } from '../../shared/SelectorCategoria'
import { SelectorFechaHora } from '../../shared/SelectorFechaHora'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'
import ModalAgregarCruceManual from '../ModalAgregarCruceManual'

// Envuelve un par [idA, idB] (lo que devuelven armarCrucesRonda1 y
// sortearCruces) en el objeto {equipoLocalId, equipoVisitanteId,
// idaYVuelta} que espera EditorCruces/torneoLiguillaService - el ida y
// vuelta se elige cruce por cruce recien en la vista previa, nunca por
// defecto.
function envolverCruces(pares) {
  return pares.map(([equipoLocalId, equipoVisitanteId]) => ({ equipoLocalId, equipoVisitanteId, idaYVuelta: false }))
}

/**
 * Liguilla: toma los clasificados de la Tabla de Posiciones (el corte
 * lo define `equiposEliminados`, configurable en Configuración) y deja
 * elegir el formato:
 *  - Cuadro eliminatorio: cruces sembrados/sorteados ronda por ronda,
 *    cada uno a un partido o ida y vuelta (a elección), con "mejor
 *    perdedor" para completar potencias de 2 (ver liguillaTorneo.js).
 *  - Todos contra todos: los clasificados juegan un grupo (una sola
 *    vuelta, o ida y vuelta para el grupo entero) y arman una tabla de
 *    posiciones propia.
 *
 * En los dos formatos tambien se puede sumar un cruce a mano (sorteo
 * hecho por fuera de la app, o un partido que el asistente no
 * contempla) y programar dia/hora de cada partido sin salir de esta
 * pestaña. Los resultados en si NO se cargan aca - una vez creados son
 * /torneo_partidos normales (con fase:'liguilla') y se juegan/editan
 * desde la pestaña Fechas igual que cualquier otro partido.
 */
export default function TabLiguilla({ torneoId, categoriasActivas }) {
  const [categoria, setCategoria] = useState(() => categoriasActivas[0])
  const swipeCategoria = useSwipeHorizontal(categoriasActivas, categoria, setCategoria)

  const [equipos, setEquipos] = useState([])
  const [partidos, setPartidos] = useState([])
  const [ajustes, setAjustes] = useState([])
  const [config, setConfig] = useState(null)
  const [estadoLiguilla, setEstadoLiguilla] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [generando, setGenerando] = useState(false)
  const [errorAccion, setErrorAccion] = useState(null)
  const [modalManual, setModalManual] = useState(false)

  // Asistente para arrancar la liguilla: null = todavia no se toco
  // "Generar liguilla"; 'clasificados' = eligiendo/reordenando quien
  // clasifica (el orden tambien decide quien tiene el bye en formato
  // ELIMINACION: el primero de la lista); 'cruces' = revisando los
  // cruces del cuadro (con su ida y vuelta cruce por cruce) antes de
  // confirmar; 'grupo' = eligiendo ida y vuelta para el grupo entero
  // antes de confirmar.
  const [formatoElegido, setFormatoElegido] = useState(FORMATO_LIGUILLA.ELIMINACION)
  const [pasoInicio, setPasoInicio] = useState(null)
  const [ordenClasificados, setOrdenClasificados] = useState([])
  const [byeRonda1, setByeRonda1] = useState(null)
  const [paresRonda1, setParesRonda1] = useState([])
  const [idaYVueltaGrupo, setIdaYVueltaGrupo] = useState(false)

  // Asistente para generar la ronda siguiente del CUADRO (liguilla ya
  // en curso, formato ELIMINACION): null = nada pendiente; 'comodines'
  // = eligiendo mejores perdedores (solo si hace falta completar una
  // potencia de 2); 'cruces' = revisando el sorteo antes de confirmar.
  const [pasoSiguiente, setPasoSiguiente] = useState(null)
  const [comodinesEditables, setComodinesEditables] = useState([])
  const [paresSiguiente, setParesSiguiente] = useState([])

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [eq, ps, aj, cfg, estado] = await Promise.all([
        listarEquiposPorCategoria(torneoId, categoria),
        listarPartidosPorCategoria(torneoId, categoria),
        listarAjustesPorCategoria(torneoId, categoria).catch((err) => {
          console.error('[TabLiguilla] listarAjustesPorCategoria', err)
          return []
        }),
        obtenerConfigCategoria(torneoId, categoria),
        obtenerEstadoLiguilla(torneoId, categoria),
      ])
      setEquipos(eq)
      setPartidos(ps)
      setAjustes(aj)
      setConfig(cfg)
      setEstadoLiguilla(estado)
      setPasoInicio(null)
      setPasoSiguiente(null)
    } catch (err) {
      console.error('[TabLiguilla]', err)
      setError('No se pudieron cargar los datos de la liguilla.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torneoId, categoria])

  function nombreEquipo(id) {
    return equipos.find((e) => e.id === id)?.nombre || '—'
  }

  function iniciarPasoClasificados() {
    setOrdenClasificados(tabla.map((f) => f.equipoId))
    setErrorAccion(null)
    setPasoInicio('clasificados')
  }

  function confirmarClasificados() {
    if (formatoElegido === FORMATO_LIGUILLA.GRUPO) {
      setIdaYVueltaGrupo(false)
      setPasoInicio('grupo')
      return
    }
    const qualifierIds = ordenClasificados.slice(0, cantidadClasifican)
    const { bye, cruces } = armarCrucesRonda1(qualifierIds)
    setByeRonda1(bye)
    setParesRonda1(envolverCruces(cruces))
    setPasoInicio('cruces')
  }

  // Cambiar el bye a mano descarta los cruces armados hasta ahora
  // (incluido que cruce era ida y vuelta) y los rearma con el nuevo
  // bye afuera - documentado en la pantalla, para no tener que
  // resolver un recalculo parcial.
  function cambiarByeRonda1(nuevoBye) {
    const qualifierIds = ordenClasificados.slice(0, cantidadClasifican)
    const reordenado = [nuevoBye, ...qualifierIds.filter((id) => id !== nuevoBye)]
    const { bye, cruces } = armarCrucesRonda1(reordenado)
    setByeRonda1(bye)
    setParesRonda1(envolverCruces(cruces))
  }

  async function handleConfirmarRonda1() {
    setGenerando(true)
    setErrorAccion(null)
    try {
      const qualifiers = ordenClasificados
        .slice(0, cantidadClasifican)
        .map((equipoId, posicion) => ({ equipoId, posicion }))
      await iniciarLiguilla({ torneoId, categoria, qualifiers, byeEquipoId: byeRonda1, cruces: paresRonda1 })
      await cargar()
    } catch (err) {
      console.error('[TabLiguilla] iniciarLiguilla', err)
      setErrorAccion(err.message || 'No se pudo generar la Ronda 1.')
    } finally {
      setGenerando(false)
    }
  }

  async function handleConfirmarGrupo() {
    setGenerando(true)
    setErrorAccion(null)
    try {
      const qualifiers = ordenClasificados
        .slice(0, cantidadClasifican)
        .map((equipoId, posicion) => ({ equipoId, posicion }))
      await iniciarLiguillaGrupo({ torneoId, categoria, qualifiers, idaYVuelta: idaYVueltaGrupo })
      await cargar()
    } catch (err) {
      console.error('[TabLiguilla] iniciarLiguillaGrupo', err)
      setErrorAccion(err.message || 'No se pudo generar el grupo.')
    } finally {
      setGenerando(false)
    }
  }

  function iniciarPasoSiguienteRonda() {
    const ultimaRonda = bracket.rondas[bracket.rondas.length - 1]
    setErrorAccion(null)
    if (ultimaRonda.comodines.length > 0) {
      const perdedoresOrdenados = [...ultimaRonda.perdedores].sort(
        (a, b) => (posicionPorEquipo.get(a) ?? Infinity) - (posicionPorEquipo.get(b) ?? Infinity)
      )
      setComodinesEditables(perdedoresOrdenados)
      setPasoSiguiente('comodines')
    } else {
      setParesSiguiente(envolverCruces(sortearCruces(ultimaRonda.avanzan)))
      setPasoSiguiente('cruces')
    }
  }

  function grupoQueAvanzaConComodinesElegidos() {
    const ultimaRonda = bracket.rondas[bracket.rondas.length - 1]
    const cantidadComodines = ultimaRonda.comodines.length
    const base = ultimaRonda.bye ? [...ultimaRonda.ganadores, ultimaRonda.bye] : [...ultimaRonda.ganadores]
    return [...base, ...comodinesEditables.slice(0, cantidadComodines)]
  }

  function confirmarComodines() {
    setParesSiguiente(envolverCruces(sortearCruces(grupoQueAvanzaConComodinesElegidos())))
    setPasoSiguiente('cruces')
  }

  function handleVolverASortear() {
    const ultimaRonda = bracket.rondas[bracket.rondas.length - 1]
    const equiposQueAvanzan = ultimaRonda.comodines.length > 0 ? grupoQueAvanzaConComodinesElegidos() : ultimaRonda.avanzan
    setParesSiguiente(envolverCruces(sortearCruces(equiposQueAvanzan)))
  }

  async function handleConfirmarSiguienteRonda() {
    setGenerando(true)
    setErrorAccion(null)
    try {
      await generarRondaLiguilla({
        torneoId,
        categoria,
        rondaLiguilla: bracket.rondas.length + 1,
        cruces: paresSiguiente,
      })
      await cargar()
    } catch (err) {
      console.error('[TabLiguilla] generarRondaLiguilla', err)
      setErrorAccion(err.message || 'No se pudo generar la siguiente ronda.')
    } finally {
      setGenerando(false)
    }
  }

  async function handleDefinirGanador(partidoId, ganadorId) {
    setGenerando(true)
    setErrorAccion(null)
    try {
      await definirGanadorPartidoLiguilla(partidoId, ganadorId)
      await cargar()
    } catch (err) {
      console.error('[TabLiguilla] definirGanadorPartidoLiguilla', err)
      setErrorAccion(err.message || 'No se pudo guardar quién avanza.')
    } finally {
      setGenerando(false)
    }
  }

  async function handleReiniciarLiguilla() {
    if (
      !confirm(
        '¿Reiniciar la liguilla? Se borran todos sus partidos (goles, tarjetas y suspensiones que hayan generado incluidos) y hay que generarla de nuevo desde cero. La temporada regular no se toca.'
      )
    ) {
      return
    }
    setGenerando(true)
    setErrorAccion(null)
    try {
      await reiniciarLiguilla(torneoId, categoria)
      await cargar()
    } catch (err) {
      console.error('[TabLiguilla] reiniciarLiguilla', err)
      setErrorAccion(err.message || 'No se pudo reiniciar la liguilla.')
    } finally {
      setGenerando(false)
    }
  }

  const partidosRegular = partidos.filter((p) => p.fase !== FASE_LIGUILLA)
  const partidosLiguilla = partidos.filter((p) => p.fase === FASE_LIGUILLA)
  const faseRegularCompleta = partidosRegular.length > 0 && partidosRegular.every((p) => p.golesLocal != null)
  const tabla = calcularTablaPosiciones({ equipos, partidos: partidosRegular, ajustes })
  const cantidadClasifican = Math.max(0, equipos.length - (config?.equiposEliminados ?? 0))

  const posicionPorEquipo = estadoLiguilla
    ? new Map(estadoLiguilla.qualifiers.map((q) => [q.equipoId, q.posicion]))
    : new Map()
  const bracket =
    estadoLiguilla && estadoLiguilla.formato !== FORMATO_LIGUILLA.GRUPO
      ? reconstruirBracket({ qualifiers: estadoLiguilla.qualifiers, byeEquipoId: estadoLiguilla.byeEquipoId, partidosLiguilla })
      : null

  const equiposGrupo =
    estadoLiguilla?.formato === FORMATO_LIGUILLA.GRUPO
      ? equipos.filter((e) => estadoLiguilla.qualifiers.some((q) => q.equipoId === e.id))
      : []
  const tablaGrupo =
    estadoLiguilla?.formato === FORMATO_LIGUILLA.GRUPO
      ? calcularTablaPosiciones({ equipos: equiposGrupo, partidos: partidosLiguilla, ajustes: [] })
      : []

  const opcionesRondaManual = bracket
    ? [
        ...bracket.rondas.map((r) => ({ valor: r.rondaLiguilla, label: r.nombreRonda })),
        { valor: bracket.rondas.length + 1, label: 'Nueva ronda' },
      ]
    : null

  return (
    <div>
      <SelectorCategoria categorias={categoriasActivas} activa={categoria} onCambiar={setCategoria} />

      <div {...swipeCategoria}>
        {cargando && <p className="text-sm text-ink-soft">Cargando…</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        {!cargando && !error && estadoLiguilla == null && (
          <div className="space-y-4">
            {partidosRegular.length === 0 && (
              <p className="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-ink-soft">
                Todavía no hay fixture de temporada regular en esta categoría (pestaña Fechas).
              </p>
            )}
            {partidosRegular.length > 0 && !faseRegularCompleta && (
              <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
                Todavía hay partidos de la fase de grupos sin resultado cargado. Terminá la temporada
                regular antes de armar la liguilla.
              </p>
            )}

            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-sm text-ink-soft">
                Clasifican los mejores <strong className="text-ink">{cantidadClasifican}</strong> equipos de
                la tabla ({config?.equiposEliminados ?? 0} eliminado{(config?.equiposEliminados ?? 0) === 1 ? '' : 's'} -
                configurable en la pestaña Configuración).
              </p>
            </div>

            {pasoInicio == null && (
              <div className="rounded-2xl border border-line bg-surface p-4">
                <p className="mb-2 text-sm font-medium text-ink">Formato</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormatoElegido(FORMATO_LIGUILLA.ELIMINACION)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      formatoElegido === FORMATO_LIGUILLA.ELIMINACION
                        ? 'border-brand bg-brand text-white'
                        : 'border-line bg-paper text-ink-soft'
                    }`}
                  >
                    Cuadro eliminatorio
                  </button>
                  <button
                    onClick={() => setFormatoElegido(FORMATO_LIGUILLA.GRUPO)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      formatoElegido === FORMATO_LIGUILLA.GRUPO
                        ? 'border-brand bg-brand text-white'
                        : 'border-line bg-paper text-ink-soft'
                    }`}
                  >
                    Todos contra todos
                  </button>
                </div>
              </div>
            )}

            {pasoInicio == null && (
              <button
                onClick={iniciarPasoClasificados}
                disabled={!faseRegularCompleta || cantidadClasifican < 2}
                className="w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-50"
              >
                Generar liguilla
              </button>
            )}

            {pasoInicio === 'clasificados' && (
              <div className="space-y-3">
                <p className="text-sm text-ink-soft">
                  Revisá quién clasifica - podés reordenar si un empate en la tabla lo tenés que resolver
                  distinto.
                  {formatoElegido === FORMATO_LIGUILLA.ELIMINACION &&
                    ' El primero de la lista de clasificados es quien pasa directo (si son impares).'}
                </p>
                <ListaOrdenable
                  equipoIds={ordenClasificados}
                  corte={cantidadClasifican}
                  nombreEquipo={nombreEquipo}
                  onCambiar={setOrdenClasificados}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setPasoInicio(null)}
                    className="flex-1 rounded-lg border border-line py-2.5 text-sm font-medium text-ink-soft"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarClasificados}
                    className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-medium text-white"
                  >
                    Confirmar clasificados
                  </button>
                </div>
              </div>
            )}

            {pasoInicio === 'cruces' && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-ink">Ronda 1 · {nombreRonda(cantidadClasifican)}</p>
                {byeRonda1 && (
                  <div className="rounded-lg border border-line bg-surface p-3">
                    <label className="mb-1 block text-xs font-medium text-ink-soft">Pasa directo (bye)</label>
                    <select
                      value={byeRonda1}
                      onChange={(e) => cambiarByeRonda1(e.target.value)}
                      className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-brand"
                    >
                      {ordenClasificados.slice(0, cantidadClasifican).map((id) => (
                        <option key={id} value={id}>
                          {nombreEquipo(id)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <EditorCruces
                  cruces={paresRonda1}
                  poolIds={ordenClasificados.slice(0, cantidadClasifican).filter((id) => id !== byeRonda1)}
                  nombreEquipo={nombreEquipo}
                  onCambiar={setParesRonda1}
                />
                {errorAccion && (
                  <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorAccion}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setPasoInicio('clasificados')}
                    className="flex-1 rounded-lg border border-line py-2.5 text-sm font-medium text-ink-soft"
                  >
                    ← Volver
                  </button>
                  <button
                    onClick={handleConfirmarRonda1}
                    disabled={generando}
                    className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {generando ? 'Generando…' : 'Confirmar y generar Ronda 1'}
                  </button>
                </div>
              </div>
            )}

            {pasoInicio === 'grupo' && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-ink">Grupo · todos contra todos</p>
                <label className="flex items-center gap-2 rounded-lg border border-line bg-surface p-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={idaYVueltaGrupo}
                    onChange={(e) => setIdaYVueltaGrupo(e.target.checked)}
                  />
                  Ida y vuelta (cada equipo enfrenta al resto dos veces, local y visitante)
                </label>
                {errorAccion && (
                  <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorAccion}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setPasoInicio('clasificados')}
                    className="flex-1 rounded-lg border border-line py-2.5 text-sm font-medium text-ink-soft"
                  >
                    ← Volver
                  </button>
                  <button
                    onClick={handleConfirmarGrupo}
                    disabled={generando}
                    className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {generando ? 'Generando…' : 'Confirmar y generar grupo'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!cargando && !error && estadoLiguilla != null && bracket && (
          <div className="space-y-3">
            {bracket.campeonEquipoId && (
              <div className="rounded-2xl border border-gold bg-gold-soft p-4 text-center">
                <p className="text-2xl">🏆</p>
                <p className="mt-1 text-base font-bold text-ink">Campeón: {nombreEquipo(bracket.campeonEquipoId)}</p>
              </div>
            )}

            {bracket.rondas.map((ronda) => (
              <div key={ronda.rondaLiguilla} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <p className="border-b border-line bg-ink-soft/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
                  {ronda.nombreRonda}
                </p>
                <ul className="divide-y divide-line">
                  {ronda.bye && (
                    <li className="px-3 py-2 text-sm text-ink-soft">🎟️ {nombreEquipo(ronda.bye)} pasa directo</li>
                  )}
                  {ronda.cruces.map((cruce) => {
                    const [idA, idB] = cruce.equipoIds
                    const algunGolCargado = cruce.partidos.some((p) => p.golesLocal != null)
                    const esComodinA = ronda.comodines.includes(idA)
                    const esComodinB = ronda.comodines.includes(idB)
                    return (
                      <li key={cruce.partidoIdDecisivo} className="px-3 py-2">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span
                            className={`min-w-0 flex-1 truncate ${
                              cruce.completo && cruce.ganadorId === idA ? 'font-semibold text-ink' : 'text-ink-soft'
                            }`}
                          >
                            {nombreEquipo(idA)}
                          </span>
                          <span className="shrink-0 rounded-lg bg-paper px-2.5 py-1 text-xs font-semibold text-ink">
                            {algunGolCargado ? `${cruce.golesA} — ${cruce.golesB}` : 'Pendiente'}
                          </span>
                          <span
                            className={`min-w-0 flex-1 truncate text-right ${
                              cruce.completo && cruce.ganadorId === idB ? 'font-semibold text-ink' : 'text-ink-soft'
                            }`}
                          >
                            {nombreEquipo(idB)}
                          </span>
                        </div>
                        {cruce.idaYVuelta && (
                          <p className="mt-0.5 text-center text-[11px] text-ink-soft">
                            Ida y vuelta · agregado {cruce.golesA}-{cruce.golesB}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap justify-center gap-x-3 gap-y-1">
                          {cruce.partidos.map((p) => (
                            <ControlFecha key={p.id} partido={p} onGuardado={cargar} />
                          ))}
                        </div>
                        {cruce.empatado && (
                          <div className="mt-2 rounded-lg bg-warning-soft p-2">
                            <p className="mb-1.5 text-xs font-medium text-warning">Empate - ¿quién avanza?</p>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleDefinirGanador(cruce.partidoIdDecisivo, idA)}
                                disabled={generando}
                                className="flex-1 rounded-lg border border-warning/30 bg-paper py-1.5 text-xs font-medium text-ink disabled:opacity-50"
                              >
                                {nombreEquipo(idA)}
                              </button>
                              <button
                                onClick={() => handleDefinirGanador(cruce.partidoIdDecisivo, idB)}
                                disabled={generando}
                                className="flex-1 rounded-lg border border-warning/30 bg-paper py-1.5 text-xs font-medium text-ink disabled:opacity-50"
                              >
                                {nombreEquipo(idB)}
                              </button>
                            </div>
                          </div>
                        )}
                        {(esComodinA || esComodinB) && (
                          <p className="mt-1 text-[11px] font-medium text-brand">
                            🎟️ {nombreEquipo(esComodinA ? idA : idB)} avanzó como mejor perdedor
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}

            {errorAccion && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorAccion}</p>}

            {!bracket.campeonEquipoId && bracket.equiposVivos && bracket.equiposVivos.length >= 2 && pasoSiguiente == null && (
              <button
                onClick={iniciarPasoSiguienteRonda}
                className="w-full rounded-lg bg-brand py-2.5 font-medium text-white"
              >
                Generar {nombreRonda(bracket.equiposVivos.length)}
              </button>
            )}

            {pasoSiguiente === 'comodines' && (
              <div className="space-y-3">
                <p className="text-sm text-ink-soft">
                  Hace falta completar el grupo para la siguiente ronda - elegí quién avanza como mejor
                  perdedor (por defecto, el mejor ubicado en la tabla).
                </p>
                <ListaOrdenable
                  equipoIds={comodinesEditables}
                  corte={bracket.rondas[bracket.rondas.length - 1].comodines.length}
                  nombreEquipo={nombreEquipo}
                  onCambiar={setComodinesEditables}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setPasoSiguiente(null)}
                    className="flex-1 rounded-lg border border-line py-2.5 text-sm font-medium text-ink-soft"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarComodines}
                    className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-medium text-white"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}

            {pasoSiguiente === 'cruces' && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-ink">Sorteo · {nombreRonda(paresSiguiente.length * 2)}</p>
                <EditorCruces
                  cruces={paresSiguiente}
                  poolIds={paresSiguiente.flatMap((c) => [c.equipoLocalId, c.equipoVisitanteId])}
                  nombreEquipo={nombreEquipo}
                  onCambiar={setParesSiguiente}
                />
                <button
                  onClick={handleVolverASortear}
                  className="w-full rounded-lg border border-line py-2 text-sm font-medium text-ink-soft"
                >
                  🔀 Volver a sortear
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPasoSiguiente(null)}
                    className="flex-1 rounded-lg border border-line py-2.5 text-sm font-medium text-ink-soft"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmarSiguienteRonda}
                    disabled={generando}
                    className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {generando ? 'Generando…' : `Confirmar y generar ${nombreRonda(paresSiguiente.length * 2)}`}
                  </button>
                </div>
              </div>
            )}

            {pasoSiguiente == null && (
              <button
                onClick={() => setModalManual(true)}
                className="w-full rounded-lg border border-line py-2.5 text-sm font-medium text-ink-soft"
              >
                + Agregar cruce manual
              </button>
            )}

            <div className="mt-6 border-t border-line pt-4 text-center">
              <button
                onClick={handleReiniciarLiguilla}
                disabled={generando}
                className="text-xs text-danger underline disabled:opacity-50"
              >
                Reiniciar liguilla
              </button>
            </div>
          </div>
        )}

        {!cargando && !error && estadoLiguilla?.formato === FORMATO_LIGUILLA.GRUPO && (
          <div className="space-y-3">
            <TablaGrupo filas={tablaGrupo} />

            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <p className="border-b border-line bg-ink-soft/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
                Partidos del grupo
              </p>
              <ul className="divide-y divide-line">
                {partidosLiguilla.map((p) => (
                  <li key={p.id} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-ink-soft">{nombreEquipo(p.equipoLocalId)}</span>
                      <span className="shrink-0 rounded-lg bg-paper px-2.5 py-1 text-xs font-semibold text-ink">
                        {p.golesLocal != null ? `${p.golesLocal} — ${p.golesVisitante}` : 'Pendiente'}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-right text-ink-soft">
                        {nombreEquipo(p.equipoVisitanteId)}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-center">
                      <ControlFecha partido={p} onGuardado={cargar} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-center text-xs text-ink-soft">Los resultados se cargan desde la pestaña Fechas.</p>

            {errorAccion && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorAccion}</p>}

            <button
              onClick={() => setModalManual(true)}
              className="w-full rounded-lg border border-line py-2.5 text-sm font-medium text-ink-soft"
            >
              + Agregar cruce manual
            </button>

            <div className="mt-6 border-t border-line pt-4 text-center">
              <button
                onClick={handleReiniciarLiguilla}
                disabled={generando}
                className="text-xs text-danger underline disabled:opacity-50"
              >
                Reiniciar liguilla
              </button>
            </div>
          </div>
        )}
      </div>

      {modalManual && (
        <ModalAgregarCruceManual
          torneoId={torneoId}
          categoria={categoria}
          equipos={estadoLiguilla?.formato === FORMATO_LIGUILLA.GRUPO ? equiposGrupo : equipos}
          opcionesRonda={opcionesRondaManual}
          onCerrar={() => setModalManual(false)}
          onGuardado={() => {
            setModalManual(false)
            cargar()
          }}
        />
      )}
    </div>
  )
}

// Tabla de posiciones compacta del grupo "todos contra todos" - mismas
// columnas que TablaPosicionesCategoria pero sin export a Excel/imagen
// ni linea de zona de eliminacion (ese corte ya se aplico ANTES, al
// elegir quien entra al grupo).
function TablaGrupo({ filas }) {
  if (filas.length === 0) return null
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="bg-ink text-left text-xs text-white">
            <th className="px-2 py-2 font-medium">#</th>
            <th className="px-2 py-2 font-medium">Equipo</th>
            <th className="px-2 py-2 text-center font-medium">Pts</th>
            <th className="px-2 py-2 text-center font-medium">PJ</th>
            <th className="px-2 py-2 text-center font-medium">PG</th>
            <th className="px-2 py-2 text-center font-medium">PE</th>
            <th className="px-2 py-2 text-center font-medium">PP</th>
            <th className="px-2 py-2 text-center font-medium">DG</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {filas.map((f, i) => (
            <tr key={f.equipoId}>
              <td className="px-2 py-2 text-ink-soft">{i + 1}</td>
              <td className="px-2 py-2 font-medium text-ink">{f.nombre}</td>
              <td className="px-2 py-2 text-center font-semibold text-ink">{f.pts}</td>
              <td className="px-2 py-2 text-center text-ink-soft">{f.pj}</td>
              <td className="px-2 py-2 text-center text-ink-soft">{f.pg}</td>
              <td className="px-2 py-2 text-center text-ink-soft">{f.pe}</td>
              <td className="px-2 py-2 text-center text-ink-soft">{f.pp}</td>
              <td className="px-2 py-2 text-center text-ink-soft">{f.dg}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Programar dia/hora de UN partido sin salir de Liguilla (mismo campo
// `fecha` que usa Fechas, ver actualizarFechaProgramada) - colapsado
// detras de un boton para no saturar la vista del cuadro/grupo con un
// selector abierto por partido.
function ControlFecha({ partido, onGuardado }) {
  const [abierto, setAbierto] = useState(false)
  const [valor, setValor] = useState(partido.fecha || null)
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    try {
      await actualizarFechaProgramada(partido.id, valor)
      onGuardado()
    } catch (err) {
      console.error('[TabLiguilla] actualizarFechaProgramada', err)
    } finally {
      setGuardando(false)
      setAbierto(false)
    }
  }

  return (
    <div>
      <button
        onClick={() => setAbierto((a) => !a)}
        className="text-[11px] font-medium text-brand underline decoration-dotted"
      >
        {partido.fecha ? `📅 ${formatearFechaProgramada(partido.fecha)}` : '📅 Programar fecha'}
      </button>
      {abierto && (
        <div className="mt-1.5 flex flex-wrap items-end gap-2">
          <SelectorFechaHora value={valor} onChange={setValor} disabled={guardando} />
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-lg bg-brand px-2.5 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {guardando ? '…' : 'Guardar'}
          </button>
        </div>
      )}
    </div>
  )
}

// Lista reordenable con ▲▼ (sin libreria de drag, mismo criterio
// simple que el resto de la app) - la usan tanto la vista previa de
// clasificados (corte = cuantos clasifican) como la de comodines
// (corte = cuantos hacen falta), con una linea divisoria despues de
// esa posicion.
function ListaOrdenable({ equipoIds, corte, nombreEquipo, onCambiar }) {
  function mover(indice, delta) {
    const destino = indice + delta
    if (destino < 0 || destino >= equipoIds.length) return
    const nuevo = [...equipoIds]
    ;[nuevo[indice], nuevo[destino]] = [nuevo[destino], nuevo[indice]]
    onCambiar(nuevo)
  }
  return (
    <ul className="overflow-hidden rounded-xl border border-line bg-surface">
      {equipoIds.map((id, i) => (
        <Fragment key={id}>
          {i === corte && corte > 0 && (
            <li className="border-y border-dashed border-brand bg-brand-soft px-3 py-1 text-center text-[11px] font-semibold text-brand">
              ↑ clasifican ↑
            </li>
          )}
          <li className={`flex items-center gap-2 border-b border-line px-3 py-2 last:border-0 ${i < corte ? 'bg-success-soft/30' : ''}`}>
            <span className="w-5 shrink-0 text-center text-xs text-ink-soft">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{nombreEquipo(id)}</span>
            <div className="flex shrink-0 gap-1">
              <button
                onClick={() => mover(i, -1)}
                disabled={i === 0}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-xs text-ink-soft disabled:opacity-30"
              >
                ▲
              </button>
              <button
                onClick={() => mover(i, 1)}
                disabled={i === equipoIds.length - 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-xs text-ink-soft disabled:opacity-30"
              >
                ▼
              </button>
            </div>
          </li>
        </Fragment>
      ))}
    </ul>
  )
}

// Que ids estan disponibles para un <select> puntual dentro de
// EditorCruces: exluye a los ya elegidos en OTRAS filas, pero deja
// pasar el valor actual de este mismo lado (si no, desaparecería del
// propio <select> al quedar "usado" por si mismo).
function idsDisponibles(cruces, pairIndex, lado, poolIds) {
  const campoEste = lado === 0 ? 'equipoLocalId' : 'equipoVisitanteId'
  const campoOtro = lado === 0 ? 'equipoVisitanteId' : 'equipoLocalId'
  const par = cruces[pairIndex]
  const usados = new Set()
  cruces.forEach((p, i) => {
    if (i === pairIndex) usados.add(p[campoOtro])
    else {
      usados.add(p.equipoLocalId)
      usados.add(p.equipoVisitanteId)
    }
  })
  return poolIds.filter((id) => !usados.has(id) || id === par[campoEste])
}

// Cruces editables (Ronda 1 sembrada, o sorteo de rondas siguientes) -
// dos <select> por fila (cada uno restringido a los equipos que no
// esten ya elegidos en otra fila) mas un checkbox "Ida y vuelta" por
// cruce - se elige cruce por cruce, no para toda la ronda.
function EditorCruces({ cruces, poolIds, nombreEquipo, onCambiar }) {
  function cambiarLado(pairIndex, lado, nuevoId) {
    const nuevo = cruces.map((c) => ({ ...c }))
    nuevo[pairIndex][lado === 0 ? 'equipoLocalId' : 'equipoVisitanteId'] = nuevoId
    onCambiar(nuevo)
  }
  function alternarIdaYVuelta(pairIndex) {
    const nuevo = cruces.map((c) => ({ ...c }))
    nuevo[pairIndex].idaYVuelta = !nuevo[pairIndex].idaYVuelta
    onCambiar(nuevo)
  }
  return (
    <ul className="space-y-2">
      {cruces.map((par, i) => (
        <li key={i} className="space-y-1.5 rounded-xl border border-line bg-surface p-2">
          <div className="flex items-center gap-2">
            <select
              value={par.equipoLocalId}
              onChange={(e) => cambiarLado(i, 0, e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 py-2 text-sm text-ink outline-none focus-visible:border-brand"
            >
              {idsDisponibles(cruces, i, 0, poolIds).map((id) => (
                <option key={id} value={id}>
                  {nombreEquipo(id)}
                </option>
              ))}
            </select>
            <span className="shrink-0 text-xs font-semibold text-ink-soft">vs</span>
            <select
              value={par.equipoVisitanteId}
              onChange={(e) => cambiarLado(i, 1, e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 py-2 text-sm text-ink outline-none focus-visible:border-brand"
            >
              {idsDisponibles(cruces, i, 1, poolIds).map((id) => (
                <option key={id} value={id}>
                  {nombreEquipo(id)}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-1.5 px-0.5 text-xs text-ink-soft">
            <input type="checkbox" checked={par.idaYVuelta} onChange={() => alternarIdaYVuelta(i)} />
            Ida y vuelta
          </label>
        </li>
      ))}
    </ul>
  )
}
