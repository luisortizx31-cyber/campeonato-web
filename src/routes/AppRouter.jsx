import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'

import LoginPage from '../features/auth/LoginPage'
import PanelTorneo from '../features/torneo/PanelTorneo'
import PaginaPublicaTorneo from '../features/torneo/PaginaPublicaTorneo'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Link publico por torneo (tenant), sin login (ver PanelTorneo ->
            "Copiar link publico"). El :torneoId es el mismo id del
            documento /torneos/{torneoId} y del campo torneoId en cada
            equipo/jugador/partido - asi cada colegio comparte su
            propio link sin ver los datos de los demas. */}
        <Route path="/campeonato/:torneoId" element={<PaginaPublicaTorneo />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <PanelTorneo />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
