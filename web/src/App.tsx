
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import { useState } from 'react'
import { Solicitud, Credito, Pago, Reporte } from './pages/Operaciones'
import PlanAmortizacion from './pages/PlanAmortizacion'
import DetalleMora from './pages/DetalleMora'

const pantallas = [
  { ruta: '/solicitud', nombre: 'Solicitud de crédito' },
  { ruta: '/credito', nombre: 'Detalle del crédito' },
  { ruta: '/pago', nombre: 'Registro de pago' },
  { ruta: '/amortizacion', nombre: 'Plan de amortización' },
  { ruta: '/mora', nombre: 'Detalle de mora' },
  { ruta: '/tablero', nombre: 'Tablero gerencial' },
  { ruta: '/cierre', nombre: 'Cierre diario y mensual' },
]

function Chat() {
  const [abierto, setAbierto] = useState(false)
  return <div className="fixed bottom-4 right-4 z-10">{abierto && <section aria-label="Asistente" className="mb-2 w-80 max-w-[90vw] rounded-xl border border-slate-200 bg-white p-4 shadow-xl"><div className="flex justify-between"><h2 className="font-bold">Asistente Crédito Vecino</h2><button aria-label="Cerrar asistente" onClick={() => setAbierto(false)}>✕</button></div><p className="mt-4 text-sm text-slate-600">El asistente estará disponible cuando se integre el módulo correspondiente.</p><label className="mt-4 block text-sm">Mensaje<textarea disabled className="mt-1 w-full rounded border border-slate-300 p-2" placeholder="Integración pendiente" /></label><button disabled className="rounded bg-slate-300 px-4 py-2">Enviar</button></section>}<button aria-expanded={abierto} onClick={() => setAbierto(!abierto)} className="rounded-full bg-emerald-700 px-5 py-3 font-bold text-white shadow-lg">{abierto ? 'Cerrar chat' : 'Abrir chat'}</button></div>
}
function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-100 md:flex">
        <aside className="bg-slate-900 p-5 text-white md:min-h-screen md:w-72 md:shrink-0">
          <div className="border-b border-slate-700 pb-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Crédito Vecino
            </p>

            <h1 className="mt-1 text-xl font-bold">
              Sistema de Microcréditos
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Plataforma de gestión
            </p>
          </div>

          <nav
            aria-label="Navegación principal"
            className="mt-6 flex gap-2 overflow-x-auto md:flex-col"
          >
            {pantallas.map((pantalla) => (
              <NavLink
                key={pantalla.ruta}
                to={pantalla.ruta}
                className={({ isActive }) =>
                  `shrink-0 rounded-lg px-4 py-3 text-sm transition-colors ${
                    isActive
                      ? 'bg-emerald-600 font-semibold text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                {pantalla.nombre}
              </NavLink>
            ))}
          </nav>

          <div className="mt-8 hidden border-t border-slate-700 pt-5 md:block">
            <p className="text-xs text-slate-500">
              Proyecto Final
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Análisis de Sistemas II
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white px-5 py-4 md:px-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700">
                  Crédito Vecino, S. A.
                </p>

                <h2 className="text-lg font-semibold text-slate-800">
                  Gestión de microcréditos
                </h2>
              </div>

              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-700">
                  E1
                </p>
                <p className="text-xs text-slate-500">
                  Interfaz React
                </p>
              </div>
            </div>
          </header>

          <div className="p-5 md:p-8">
            <Routes>
              <Route
                path="/"
                element={<Navigate to="/solicitud" replace />}
              />

              <Route
                path="/solicitud"
                element={<Solicitud />}
              />

              <Route
                path="/credito"
                element={<Credito />}
              />

              <Route
                path="/pago"
                element={
                  <Pago />
                }
              />

              <Route
                path="/amortizacion"
                element={<PlanAmortizacion />}
              />

              <Route
                path="/mora"
                element={<DetalleMora />}
              />

              <Route
                path="/tablero"
                element={
                  <Reporte tipo="tablero" />
                }
              />

              <Route
                path="/cierre"
                element={
                  <Reporte tipo="cierre" />
                }
              />

              <Route
                path="*"
                element={<Navigate to="/solicitud" replace />}
              />
            </Routes>
          </div>
        </main>
        <Chat />
      </div>
    </BrowserRouter>
  )
}

export default App
