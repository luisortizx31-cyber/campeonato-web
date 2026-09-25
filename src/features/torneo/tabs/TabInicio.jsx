import { useEffect, useState } from 'react'
import { listarEquiposDelTorneo } from '../../../services/torneoEquiposService'
import { suscribirPartidosDelTorneo } from '../../../services/torneoPartidosService'
import { CATEGORIA_TORNEO_LABELS } from '../../../models/torneo'
import { estadoPartido } from '../../../utils/partidosPorDia'
import { formatearFechaProgramada } from '../../../utils/fixtureTorneo'
import { EscudoEquipo } from '../../shared/EscudoEquipo'
import { TarjetaIcono } from '../../shared/TarjetaIcono'
import ModalProgramarFechas from '../ModalProgramarFechas'

// Tarjeta de acceso rapido de la pantalla de Inicio. `destacada` la pinta
// del color de marca y le da doble ancho (grid-cols-2) - se usa para
// "Programar fechas", la accion principal de esta pantalla.
function BotonAccion({ icon, label, sub, destacada, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-1.5 rounded-2xl border p-4 text-left shadow-sm transition-transform active:scale-[0.98] ${
        destacada ? 'col-span-2 border-brand bg-brand' : 'border-line bg-surface'
      }`}
    >
      <span className="flex h-8 items-center text-2xl">{icon}</span>
      <span className={`text-sm font-bold ${destacada ? 'text-white' : 'text-ink'}`}>{label}</span>
      {sub && <span className={`text-xs ${destacada ? 'text-white/80' : 'text-ink-soft'}`}>{sub}</span>}
    </button>
  )
}

/**
 * Primera pantalla que ve el Maestro al entrar al panel (ver
 * PanelTorneo) - una bienvenida con el nombre del torneo, un vistazo al
 * partido en vivo o al proximo por jugarse (si hay alguno programado), y
 * accesos rapidos a lo que se usa mas seguido. "Programar fechas" abre
 * el asistente (ver ModalProgramarFechas) para elegir categoria, fecha y
 * cargar los horarios sin tener que pasar primero por la pestaña Fechas.
 */
export default function TabInicio({ torneoId, categoriasActivas, nombreTorneo, onIrATab }) {
  const [equipos, setEquipos] = useState([])
  const [partidos, setPartidos] = useState([])
  const [mostrarWizard, setMostrarWizard] = useState(false)
  // Se actualiza cada minuto para que el "proximo partido" se vuelva "en
  // vivo" solo apenas se llega a su horario (mismo criterio que
  // TabPartidosPublica).
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelado = false
    listarEquiposDelTorneo(torneoId)
      .then((eq) => {
        if (!cancelado) setEquipos(eq)
      })
      .catch((err) => console.error('[TabInicio] listarEquiposDelTorneo', err))
    return () => {
      cancelado = true
    }
  }, [torneoId])

  useEffect(() => {
    return suscribirPartidosDelTorneo(torneoId, setPartidos)
  }, [torneoId])

  function equipoDe(id) {
    return equipos.find((e) => e.id === id)
  }
  function nombreEquipo(id) {
    return equipoDe(id)?.nombre || '—'
  }

  const partidosActivos = partidos.filter((p) => categoriasActivas.includes(p.categoria))
  const enVivo = partidosActivos.filter((p) => estadoPartido(p, ahora) === 'vivo')
  const proximos = partidosActivos
    .filter((p) => estadoPartido(p, ahora) === 'pendiente' && p.fecha)
    .sort((a, b) => a.fecha.toMillis() - b.fecha.toMillis())
  const destacado = enVivo[0] || proximos[0] || null

  return (
    <div>
      {/* Hero con degrade + circulos decorativos, como la tarjeta del
          goleador (ver TarjetaGoleador) - mismo lenguaje visual que el
          resto de la app, no un estilo nuevo. */}
      <div className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-dark via-brand to-[#0c261d] p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-white/5" />
        <p className="relative text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Panel del Maestro</p>
        <h1 className="relative mt-1 text-2xl font-extrabold leading-tight">{nombreTorneo || 'Tu campeonato'}</h1>
        <p className="relative mt-1 text-sm text-white/80">¿Qué querés hacer hoy?</p>
      </div>

      {/* Tarjeta "flotante": se monta sobre el hero con un margen negativo,
          como en los tableros que muestran un dato destacado justo debajo
          de la cabecera. */}
      {destacado && (
        <div className="relative -mt-14 mb-6 overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-xl">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
            {enVivo[0] ? (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
                <span className="text-danger">En vivo ahora</span>
              </>
            ) : (
              <>📅 Próximo partido</>
            )}
          </p>
          <div className="flex items-center gap-2.5">
            <EscudoEquipo nombre={nombreEquipo(destacado.equipoLocalId)} fotoUrl={equipoDe(destacado.equipoLocalId)?.fotoPortadaUrl} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
              {nombreEquipo(destacado.equipoLocalId)}
            </span>
            {enVivo[0] && <span className="money text-base font-extrabold text-ink">{destacado.golesLocalEnVivo ?? 0}</span>}
          </div>
          <div className="my-1.5 border-t border-line/70" />
          <div className="flex items-center gap-2.5">
            <EscudoEquipo nombre={nombreEquipo(destacado.equipoVisitanteId)} fotoUrl={equipoDe(destacado.equipoVisitanteId)?.fotoPortadaUrl} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
              {nombreEquipo(destacado.equipoVisitanteId)}
            </span>
            {enVivo[0] && <span className="money text-base font-extrabold text-ink">{destacado.golesVisitanteEnVivo ?? 0}</span>}
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-ink-soft">
              {CATEGORIA_TORNEO_LABELS[destacado.categoria]}
              {!enVivo[0] && destacado.fecha && ` · ${formatearFechaProgramada(destacado.fecha)}`}
            </p>
            <button onClick={() => onIrATab('fechas')} className="shrink-0 text-xs font-semibold text-brand">
              Ir a Fechas ›
            </button>
          </div>
        </div>
      )}

      {/* Ya no hay barra de pestañas arriba (ver PanelTorneo): esta grilla
          es el UNICO punto de navegacion a cada seccion, asi que cubre
          las mismas 11 que antes vivian ahi - nada quedo sin acceso. */}
      <div className="grid grid-cols-2 gap-3">
        <BotonAccion
          icon="📅"
          label="Programar fechas"
          sub="Elegí la categoría, la fecha y armá los horarios"
          destacada
          onClick={() => setMostrarWizard(true)}
        />
        <BotonAccion icon="🗓️" label="Fechas" onClick={() => onIrATab('fechas')} />
        <BotonAccion icon="⚽" label="Goleadores" onClick={() => onIrATab('goleadores')} />
        <BotonAccion icon="📊" label="Posiciones" onClick={() => onIrATab('posiciones')} />
        <BotonAccion icon="🏆" label="Liguilla" onClick={() => onIrATab('liguilla')} />
        <BotonAccion
          icon={<TarjetaIcono tipo="amarilla" className="h-7 w-5" />}
          label="Amonestados"
          onClick={() => onIrATab('amonestados')}
        />
        <BotonAccion icon="📢" label="Reclamos" onClick={() => onIrATab('reclamos')} />
        <BotonAccion icon="🛡️" label="Equipos" onClick={() => onIrATab('equipos')} />
        <BotonAccion icon="👥" label="Jugadores" onClick={() => onIrATab('jugadores')} />
        <BotonAccion icon="📄" label="Bases" onClick={() => onIrATab('bases')} />
        <BotonAccion icon="📣" label="Publicidad" onClick={() => onIrATab('publicidad')} />
        <BotonAccion icon="⚙️" label="Configuración" onClick={() => onIrATab('configuracion')} />
      </div>

      {mostrarWizard && (
        <ModalProgramarFechas
          torneoId={torneoId}
          categoriasActivas={categoriasActivas}
          onCerrar={() => setMostrarWizard(false)}
          onIrATab={onIrATab}
        />
      )}
    </div>
  )
}
