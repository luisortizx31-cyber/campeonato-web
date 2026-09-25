import { useEffect, useState } from 'react'
import { listarEquiposPorCategoria } from '../../services/torneoEquiposService'
import { listarPartidosPorCategoria } from '../../services/torneoPartidosService'
import { compararPartidosPorHorario, esFechaLiguilla, formatearFechaProgramada } from '../../utils/fixtureTorneo'
import { CATEGORIA_TORNEO_LABELS } from '../../models/torneo'
import { EscudoEquipo } from '../shared/EscudoEquipo'
import ModalReprogramarFecha from './ModalReprogramarFecha'
import ControlPartido from './ControlPartido'

const PASOS = { CATEGORIA: 'categoria', FECHA: 'fecha', PROGRAMAR: 'programar', LISTO: 'listo', CONTROL: 'control' }

// En que estado esta una Fecha para la pastilla del paso 2: 'jugada' (ya
// se cargaron todos los resultados - no tiene sentido reprogramarla),
// 'programada' (todos los pendientes ya tienen horario), 'parcial'
// (algunos si, otros no) o 'sin-programar' (ninguno).
function estadoFecha(f, partidos) {
  const partidosF = partidos.filter((p) => p.fechaNumero === f)
  if (partidosF.length === 0) return 'sin-programar'
  if (partidosF.every((p) => p.golesLocal != null)) return 'jugada'
  const pendientesF = partidosF.filter((p) => p.golesLocal == null)
  if (pendientesF.every((p) => p.fecha)) return 'programada'
  if (pendientesF.some((p) => p.fecha)) return 'parcial'
  return 'sin-programar'
}

const ESTILO_ESTADO = {
  jugada: { clase: 'border-danger/30 bg-danger-soft text-danger', texto: 'Ya jugada' },
  programada: { clase: 'border-success/30 bg-success-soft text-success', texto: '✓ Programada' },
  parcial: { clase: 'border-warning/30 bg-warning-soft text-warning', texto: 'Falta programar' },
  'sin-programar': { clase: 'border-line bg-surface text-ink-soft', texto: 'Sin programar' },
}

/**
 * Asistente de "Programar fechas" para la pantalla de Inicio: elegir la
 * categoria (si hay mas de una activa), elegir la Fecha, programar sus
 * horarios (reusa ModalReprogramarFecha tal cual) y, ya guardado, entrar
 * directo a Control de un partido puntual (reusa ControlPartido tal
 * cual, mismo criterio de bloqueo por fecha anterior sin finalizar que
 * usa TabFechas) sin tener que ir a buscarlo a la pestaña Fechas.
 *
 * Es una version "de bolsillo" de TabFechas: solo lo necesario para
 * programar y despues entrar a jugar - el resto (generar fixture,
 * buscar un cruce, reiniciar, etc) sigue viviendo en Fechas.
 */
export default function ModalProgramarFechas({ torneoId, categoriasActivas, onCerrar, onIrATab }) {
  const [paso, setPaso] = useState(categoriasActivas.length === 1 ? PASOS.FECHA : PASOS.CATEGORIA)
  const [categoria, setCategoria] = useState(categoriasActivas.length === 1 ? categoriasActivas[0] : null)
  const [equipos, setEquipos] = useState([])
  const [partidos, setPartidos] = useState([])
  const [cargandoDatos, setCargandoDatos] = useState(false)
  const [errorDatos, setErrorDatos] = useState(null)
  const [fechaNumero, setFechaNumero] = useState(null)
  const [partidoControl, setPartidoControl] = useState(null)

  async function cargarCategoria(cat) {
    setCargandoDatos(true)
    setErrorDatos(null)
    try {
      const [eq, ps] = await Promise.all([
        listarEquiposPorCategoria(torneoId, cat),
        listarPartidosPorCategoria(torneoId, cat),
      ])
      setEquipos(eq)
      setPartidos(ps)
    } catch (err) {
      console.error('[ModalProgramarFechas] cargarCategoria', err)
      setErrorDatos('No se pudieron cargar los datos de esta categoría.')
    } finally {
      setCargandoDatos(false)
    }
  }

  // Si solo hay una categoria activa, se salta el paso de elegirla.
  useEffect(() => {
    if (categoria) cargarCategoria(categoria)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function elegirCategoria(cat) {
    setCategoria(cat)
    setPaso(PASOS.FECHA)
    cargarCategoria(cat)
  }

  function elegirFecha(f) {
    setFechaNumero(f)
    setPaso(PASOS.PROGRAMAR)
  }

  async function handleGuardado() {
    try {
      setPartidos(await listarPartidosPorCategoria(torneoId, categoria))
    } catch (err) {
      console.error('[ModalProgramarFechas] handleGuardado', err)
    }
    setPaso(PASOS.LISTO)
  }

  function nombreEquipo(id) {
    return equipos.find((e) => e.id === id)?.nombre || '—'
  }
  function equipoDe(id) {
    return equipos.find((e) => e.id === id)
  }

  // Mismo criterio que TabFechas: mientras un partido de una fecha
  // ANTERIOR haya arrancado y no se haya finalizado, no se deja abrir
  // Control de una fecha posterior.
  const partidosSinFinalizar = partidos.filter(
    (p) => p.golesLocal == null && (p.titularesLocal?.length > 0 || p.titularesVisitante?.length > 0)
  )
  function bloqueadoPorDe(partido) {
    return partidosSinFinalizar.find((p) => p.id !== partido.id && p.fechaNumero < partido.fechaNumero)
  }

  function abrirControl(partido) {
    setPartidoControl(partido)
    setPaso(PASOS.CONTROL)
  }

  async function volverDeControl() {
    try {
      setPartidos(await listarPartidosPorCategoria(torneoId, categoria))
    } catch (err) {
      console.error('[ModalProgramarFechas] volverDeControl', err)
    }
    setPartidoControl(null)
    setPaso(PASOS.LISTO)
  }

  // Control de partido ocupa toda la pantalla, igual que en Fechas (sin
  // el marco del asistente, se sale con su propio "← Volver") - pero a
  // diferencia de Fechas, este componente vive ANIDADO dentro de
  // TabInicio (no reemplaza toda la pantalla del tab), asi que necesita
  // su propio fixed inset-0 para taparla en vez de quedar apilado debajo.
  if (paso === PASOS.CONTROL && partidoControl) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-paper p-4">
        <ControlPartido
          torneoId={torneoId}
          categoria={categoria}
          partido={partidoControl}
          nombreEquipo={nombreEquipo}
          onVolver={volverDeControl}
        />
      </div>
    )
  }

  // El paso de programar horarios es, tal cual, la misma hoja que usa
  // "📅 Programar fecha" en Fechas - ni la duplica ni la reinventa.
  if (paso === PASOS.PROGRAMAR) {
    const partidosDeFecha = partidos.filter((p) => p.fechaNumero === fechaNumero).sort(compararPartidosPorHorario)
    return (
      <ModalReprogramarFecha
        torneoId={torneoId}
        categoria={categoria}
        fechaNumero={fechaNumero}
        partidosDeFecha={partidosDeFecha}
        partidos={partidos}
        nombreEquipo={nombreEquipo}
        onCerrar={() => setPaso(PASOS.FECHA)}
        onGuardado={handleGuardado}
      />
    )
  }

  const fechasDisponibles = [...new Set(partidos.filter((p) => p.fechaNumero != null).map((p) => p.fechaNumero))].sort(
    (a, b) => a - b
  )
  const partidosDeFechaLista = partidos.filter((p) => p.fechaNumero === fechaNumero).sort(compararPartidosPorHorario)

  const titulos = {
    [PASOS.CATEGORIA]: 'Elegí una categoría',
    [PASOS.FECHA]: `${categoria ? CATEGORIA_TORNEO_LABELS[categoria] : ''} · Elegí una fecha`,
    [PASOS.LISTO]: 'Horarios guardados',
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper">
      <div className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {paso === PASOS.FECHA && categoriasActivas.length > 1 && (
            <button
              onClick={() => setPaso(PASOS.CATEGORIA)}
              className="shrink-0 text-xl leading-none text-ink-soft"
              aria-label="Atrás"
            >
              ←
            </button>
          )}
          <h1 className="truncate text-base font-semibold text-ink">{titulos[paso]}</h1>
        </div>
        <button onClick={onCerrar} className="shrink-0 px-1 text-2xl leading-none text-ink-soft" aria-label="Cerrar">
          ×
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {paso === PASOS.CATEGORIA && (
          <div className="space-y-2">
            {categoriasActivas.length === 0 ? (
              <p className="text-sm text-ink-soft">
                No hay categorías activas configuradas. Andá a Configuración para activarlas.
              </p>
            ) : (
              categoriasActivas.map((c) => (
                <button
                  key={c}
                  onClick={() => elegirCategoria(c)}
                  className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-4 py-3.5 text-left text-sm font-semibold text-ink shadow-sm transition-colors hover:border-brand hover:text-brand"
                >
                  {CATEGORIA_TORNEO_LABELS[c]}
                  <span className="text-ink-soft">›</span>
                </button>
              ))
            )}
          </div>
        )}

        {paso === PASOS.FECHA && (
          <>
            {cargandoDatos && <p className="text-sm text-ink-soft">Cargando…</p>}
            {errorDatos && <p className="text-sm text-danger">{errorDatos}</p>}
            {!cargandoDatos && !errorDatos && fechasDisponibles.length === 0 && (
              <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
                Todavía no generaste el fixture de {CATEGORIA_TORNEO_LABELS[categoria]}.
                <button
                  onClick={() => {
                    onIrATab('fechas')
                    onCerrar()
                  }}
                  className="mt-3 block w-full rounded-lg bg-brand py-2.5 font-medium text-white"
                >
                  Ir a Fechas para generarlo
                </button>
              </div>
            )}
            {!cargandoDatos && !errorDatos && fechasDisponibles.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {fechasDisponibles.map((f) => {
                  const estado = estadoFecha(f, partidos)
                  const estilo = ESTILO_ESTADO[estado]
                  return (
                    <button
                      key={f}
                      onClick={() => elegirFecha(f)}
                      className={`rounded-xl border px-2 py-3 text-center shadow-sm transition-colors ${estilo.clase}`}
                    >
                      <span className="block text-sm font-bold">
                        {esFechaLiguilla(f, partidos) && '🏆 '}Fecha {f}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-medium">{estilo.texto}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {paso === PASOS.LISTO && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-success/30 bg-success-soft p-4 text-center">
              <p className="text-2xl">✅</p>
              <p className="mt-1 text-sm font-semibold text-success">Horarios guardados</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                {CATEGORIA_TORNEO_LABELS[categoria]} · Fecha {fechaNumero}
              </p>
            </div>

            <ul className="space-y-2.5">
              {partidosDeFechaLista.map((p) => {
                const jugado = p.golesLocal != null
                const bloqueadoPor = bloqueadoPorDe(p)
                const local = equipoDe(p.equipoLocalId)
                const visitante = equipoDe(p.equipoVisitanteId)
                return (
                  <li key={p.id} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                    <p className="px-3 pt-2.5 pb-1 text-[11px] text-ink-soft">
                      {p.fecha ? `🗓 ${formatearFechaProgramada(p.fecha)}` : 'Sin horario'}
                    </p>
                    <div className="mx-3 mb-2.5 overflow-hidden rounded-xl border border-line/70 bg-paper">
                      <div className="flex items-center gap-2.5 px-3 py-2">
                        <EscudoEquipo nombre={local?.nombre} fotoUrl={local?.fotoPortadaUrl} />
                        <span className="min-w-0 flex-1 break-words text-sm font-medium leading-tight text-ink">
                          {local?.nombre || '—'}
                        </span>
                        {jugado && <span className="money text-base font-extrabold text-ink">{p.golesLocal}</span>}
                      </div>
                      <div className="border-t border-line/70" />
                      <div className="flex items-center gap-2.5 px-3 py-2">
                        <EscudoEquipo nombre={visitante?.nombre} fotoUrl={visitante?.fotoPortadaUrl} />
                        <span className="min-w-0 flex-1 break-words text-sm font-medium leading-tight text-ink">
                          {visitante?.nombre || '—'}
                        </span>
                        {jugado && <span className="money text-base font-extrabold text-ink">{p.golesVisitante}</span>}
                      </div>
                    </div>
                    {!jugado && (
                      <div className="border-t border-line px-3 py-2 text-right">
                        <button
                          onClick={() => abrirControl(p)}
                          disabled={Boolean(bloqueadoPor)}
                          title={
                            bloqueadoPor
                              ? `Terminá primero el partido de Fecha ${bloqueadoPor.fechaNumero}`
                              : 'Alineación y eventos del partido'
                          }
                          className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand disabled:opacity-40"
                        >
                          📋 Control
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => setPaso(PASOS.FECHA)}
                className="w-full rounded-lg border border-line py-2.5 text-sm font-medium text-ink-soft"
              >
                Programar otra fecha
              </button>
              <button
                onClick={() => {
                  onIrATab('fechas')
                  onCerrar()
                }}
                className="w-full rounded-lg bg-brand py-2.5 text-sm font-medium text-white"
              >
                Ir a Fechas
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
