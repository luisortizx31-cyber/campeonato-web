import { useEffect, useMemo, useRef, useState } from 'react'
import { suscribirPartidosDelTorneo } from '../../../services/torneoPartidosService'
import { listarEquiposDelTorneo } from '../../../services/torneoEquiposService'
import { CATEGORIA_TORNEO_LABELS } from '../../../models/torneo'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'
import { formatearHoraCorta } from '../../../utils/fixtureTorneo'
import { claveDia, diasConPartidos, diaInicial, etiquetaDia, estadoPartido } from '../../../utils/partidosPorDia'
import { textoMinutoEnCurso } from '../../../utils/golesPorTiempo'
import { EscudoEquipo } from '../../shared/EscudoEquipo'
import CanchaPublica from '../CanchaPublica'

const SELECCION_VIVO = 'vivo'

function millisFecha(partido) {
  return partido.fecha?.toMillis?.() ?? 0
}

function FilaPartido({ partido, estado, equipoLocal, equipoVisitante, ahora, onAbrir }) {
  const nombreLocal = equipoLocal?.nombre || '—'
  const nombreVisitante = equipoVisitante?.nombre || '—'
  const ganoLocal = estado === 'fin' && partido.golesLocal > partido.golesVisitante
  const ganoVisitante = estado === 'fin' && partido.golesVisitante > partido.golesLocal
  const marcadorLocal = estado === 'fin' ? partido.golesLocal : partido.golesLocalEnVivo ?? 0
  const marcadorVisitante = estado === 'fin' ? partido.golesVisitante : partido.golesVisitanteEnVivo ?? 0
  const jornada = partido.jornada || (partido.fechaNumero != null ? `Fecha ${partido.fechaNumero}` : null)

  return (
    <li onClick={onAbrir} className="cursor-pointer border-t border-line px-2.5 py-3 first:border-t-0 active:bg-ink-soft/5">
      {jornada && <p className="mb-1.5 px-1 text-[11px] text-ink-soft">{jornada}</p>}
      <div className="grid grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] items-center gap-1.5">
        <div className="flex min-w-0 items-center justify-end gap-1.5">
          <span className={`min-w-0 break-words text-right text-[13px] leading-tight text-ink ${ganoLocal ? 'font-bold' : ''}`}>
            {nombreLocal}
          </span>
          <EscudoEquipo nombre={nombreLocal} fotoUrl={equipoLocal?.fotoPortadaUrl} tamanoClase="h-11 w-11" textoClase="text-base" />
        </div>

        <div className="text-center">
          {estado === 'pendiente' ? (
            <p className="text-base font-semibold text-ink">{partido.fecha ? formatearHoraCorta(partido.fecha) : '–'}</p>
          ) : (
            <>
              <p className={`text-2xl font-semibold leading-none tabular-nums ${estado === 'vivo' ? 'text-danger' : 'text-ink'}`}>
                {marcadorLocal} - {marcadorVisitante}
              </p>
              {estado === 'fin' ? (
                <p className="mt-1 text-[11px] font-medium tracking-wide text-ink-soft">FIN</p>
              ) : (
                <p className="mt-1 flex items-center justify-center gap-1 text-[11px] font-bold tracking-wide text-danger">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
                  {textoMinutoEnCurso(partido, ahora) || 'EN VIVO'}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <EscudoEquipo nombre={nombreVisitante} fotoUrl={equipoVisitante?.fotoPortadaUrl} tamanoClase="h-11 w-11" textoClase="text-base" />
          <span className={`min-w-0 break-words text-left text-[13px] leading-tight text-ink ${ganoVisitante ? 'font-bold' : ''}`}>
            {nombreVisitante}
          </span>
        </div>
      </div>
    </li>
  )
}

// Listado de partidos por dia, en el estilo de las apps de resultados
// (Besoccer): una barra de dias arriba (AYER / HOY / MAÑANA / otros dias
// con partidos, mas "EN VIVO" cuando hay alguno jugandose) y, del dia
// elegido, todos los partidos juntos agrupados por categoria y ordenados
// por hora. Es controlado (seleccion/onSeleccion) para que quien lo use
// conserve el dia elegido al entrar al detalle de un partido y volver.
export function VistaPartidosPorDia({ partidos, equipos, categoriasActivas, ahora, seleccion, onSeleccion, onAbrirPartido }) {
  const hoyClave = claveDia(new Date(ahora))
  const visibles = partidos.filter((p) => categoriasActivas.includes(p.categoria))
  const equipoPorId = useMemo(() => new Map(equipos.map((e) => [e.id, e])), [equipos])

  const dias = diasConPartidos(visibles)
  const diasBarra = [...new Set([...dias, hoyClave])].sort()
  const enVivo = visibles.filter((p) => estadoPartido(p, ahora) === 'vivo')
  // "EN VIVO" va justo despues de HOY, como el "DIRECTO" de Besoccer.
  const opciones = enVivo.length > 0 ? diasBarra.flatMap((d) => (d === hoyClave ? [d, SELECCION_VIVO] : [d])) : diasBarra
  // Sin ningun dia programado pero con un partido en juego (arrancado sin
  // haberle puesto dia/hora), abre directo en EN VIVO: es lo unico que hay.
  const porDefecto = dias.length === 0 && enVivo.length > 0 ? SELECCION_VIVO : diaInicial(dias, hoyClave)
  const efectiva = seleccion && opciones.includes(seleccion) ? seleccion : porDefecto

  const delDia =
    efectiva === SELECCION_VIVO
      ? enVivo
      : visibles.filter((p) => p.fecha?.toDate && claveDia(p.fecha.toDate()) === efectiva)
  const grupos = categoriasActivas
    .map((categoria) => ({
      categoria,
      lista: delDia
        .filter((p) => p.categoria === categoria)
        .sort((a, b) => millisFecha(a) - millisFecha(b) || (a.fechaNumero || 0) - (b.fechaNumero || 0)),
    }))
    .filter((g) => g.lista.length > 0)

  const swipe = useSwipeHorizontal(opciones, efectiva, onSeleccion)

  const barraRef = useRef(null)
  useEffect(() => {
    const activo = barraRef.current?.querySelector(`[data-opcion="${efectiva}"]`)
    activo?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [efectiva])

  const sinNadaProgramado = dias.length === 0 && enVivo.length === 0

  return (
    <div>
      <div ref={barraRef} className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1">
        {opciones.map((opcion) => {
          const esVivo = opcion === SELECCION_VIVO
          const activa = efectiva === opcion
          return (
            <button
              key={opcion}
              data-opcion={opcion}
              onClick={() => onSeleccion(opcion)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold tracking-wide transition-colors ${
                activa
                  ? esVivo
                    ? 'border-danger bg-danger text-white'
                    : 'border-brand bg-brand text-white'
                  : esVivo
                    ? 'border-danger/30 bg-danger-soft text-danger'
                    : 'border-line bg-surface text-ink-soft'
              }`}
            >
              {esVivo && <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${activa ? 'bg-white' : 'bg-danger'}`} />}
              {esVivo ? `EN VIVO (${enVivo.length})` : etiquetaDia(opcion, hoyClave)}
            </button>
          )
        })}
      </div>

      <div {...swipe} className="min-h-40 space-y-3">
        {sinNadaProgramado ? (
          <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
            Todavía no hay partidos programados con día y hora. Apenas se programen aparecerán acá; mientras tanto podés ver el
            fixture completo en la pestaña Fechas.
          </div>
        ) : grupos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
            No hay partidos programados para {efectiva === hoyClave ? 'hoy' : 'este día'}.
          </div>
        ) : (
          grupos.map(({ categoria, lista }) => (
            <section key={categoria} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
              <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-ink">
                <span aria-hidden="true">⚽</span>
                {CATEGORIA_TORNEO_LABELS[categoria] || categoria}
              </h2>
              <ul>
                {lista.map((p) => (
                  <FilaPartido
                    key={p.id}
                    partido={p}
                    estado={estadoPartido(p, ahora)}
                    equipoLocal={equipoPorId.get(p.equipoLocalId)}
                    equipoVisitante={equipoPorId.get(p.equipoVisitanteId)}
                    ahora={ahora}
                    onAbrir={() => onAbrirPartido(p.id)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  )
}

// Solo lectura: todos los partidos del torneo (todas las categorias
// activas) con dia programado, del dia elegido. A diferencia de
// TabFechasPublica (que va por categoria y por numero de Fecha del
// fixture), aca lo que manda es el dia: si un dia se juegan Master y
// Libre, aparecen juntos en ese dia. Tocar un partido abre el mismo
// detalle en vivo que en Fechas (CanchaPublica).
export default function TabPartidosPublica({ torneoId, categoriasActivas }) {
  const [partidos, setPartidos] = useState([])
  const [equipos, setEquipos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [seleccion, setSeleccion] = useState(null)
  // Solo el id (mismo criterio que TabFechasPublica): el detalle recibe
  // siempre la version mas reciente del partido ya suscripto en vivo.
  const [partidoAbiertoId, setPartidoAbiertoId] = useState(null)
  // Se actualiza cada minuto para que "HOY" cambie solo pasada la
  // medianoche y un partido deje de ser "en vivo" sin recargar.
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelado = false
    let equiposListos = false
    let partidosListos = false

    function intentarTerminarCarga() {
      if (equiposListos && partidosListos && !cancelado) setCargando(false)
    }

    listarEquiposDelTorneo(torneoId)
      .then((eq) => {
        if (!cancelado) setEquipos(eq)
      })
      .catch((err) => console.error('[TabPartidosPublica]', err))
      .finally(() => {
        equiposListos = true
        intentarTerminarCarga()
      })

    const desuscribir = suscribirPartidosDelTorneo(torneoId, (ps) => {
      if (cancelado) return
      setPartidos(ps)
      partidosListos = true
      intentarTerminarCarga()
    })

    return () => {
      cancelado = true
      desuscribir()
    }
  }, [torneoId])

  // Si el partido abierto deja de existir (ej. el Maestro lo borro
  // mientras alguien lo miraba), simplemente no se encuentra y se vuelve
  // al listado.
  const partidoAbierto = partidoAbiertoId ? partidos.find((p) => p.id === partidoAbiertoId) : null

  if (partidoAbierto) {
    const nombreEquipo = (id) => equipos.find((e) => e.id === id)?.nombre || '—'
    return (
      <CanchaPublica
        torneoId={torneoId}
        categoria={partidoAbierto.categoria}
        partido={partidoAbierto}
        nombreEquipo={nombreEquipo}
        onVolver={() => setPartidoAbiertoId(null)}
      />
    )
  }

  if (cargando) return <p className="text-sm text-ink-soft">Cargando…</p>

  return (
    <VistaPartidosPorDia
      partidos={partidos}
      equipos={equipos}
      categoriasActivas={categoriasActivas}
      ahora={ahora}
      seleccion={seleccion}
      onSeleccion={setSeleccion}
      onAbrirPartido={setPartidoAbiertoId}
    />
  )
}
