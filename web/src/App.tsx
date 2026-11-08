
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

const pantallas = [
  {
    ruta: '/solicitud',
    nombre: 'Solicitud de crédito',
    descripcion: 'Registro de clientes y originación de créditos.',
  },
  {
    ruta: '/credito',
    nombre: 'Detalle del crédito',
    descripcion: 'Consulta del estado y movimientos de un crédito.',
  },
  {
    ruta: '/pago',
    nombre: 'Registro de pago',
    descripcion: 'Consulta de desglose y confirmación de pagos.',
  },
  {
    ruta: '/amortizacion',
    nombre: 'Plan de amortización',
    descripcion: 'Consulta de cuotas y fechas programadas.',
  },
  {
    ruta: '/mora',
    nombre: 'Detalle de mora',
    descripcion: 'Consulta del atraso y sus tramos.',
  },
  {
    ruta: '/tablero',
    nombre: 'Tablero gerencial',
    descripcion: 'Indicadores de cartera y situación financiera.',
  },
  {
    ruta: '/cierre',
    nombre: 'Cierre diario y mensual',
    descripcion: 'Desembolsos y recuperaciones por concepto.',
  },
]

function Pantalla({
  nombre,
  descripcion,
}: {
  nombre: string
  descripcion: string
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold text-slate-900">
        {nombre}
      </h2>

      <p className="mt-2 text-slate-600">
        {descripcion}
      </p>

      <div className="mt-8 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
        Pantalla preparada para implementar su funcionalidad.
      </div>
    </section>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-100 md:flex">
        <aside className="bg-slate-900 p-5 text-white md:min-h-screen md:w-72 md:shrink-0">
          <h1 className="text-xl font-bold">
            Sistema de Microcréditos
          </h1>

          <p className="mt-1 text-sm text-slate-400">
            Plataforma de gestión
          </p>

          <nav
            aria-label="Navegación principal"
            className="mt-7 flex gap-2 overflow-x-auto md:flex-col"
          >
            {pantallas.map((pantalla) => (
              <NavLink
                key={pantalla.ruta}
                to={pantalla.ruta}
                className={({ isActive }) =>
                  `shrink-0 rounded-lg px-4 py-3 text-sm transition-colors ${
                    isActive
                      ? 'bg-emerald-600 font-semibold text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`
                }
              >
                {pantalla.nombre}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-5 md:p-8">
          <header className="mb-6">
            <p className="text-sm text-slate-500">
              Proyecto final — E1
            </p>
            <h2 className="text-xl font-semibold text-slate-800">
              Gestión de microcréditos
            </h2>
          </header>

          <Routes>
            <Route
              path="/"
              element={<Navigate to="/solicitud" replace />}
            />

            {pantallas.map((pantalla) => (
              <Route
                key={pantalla.ruta}
                path={pantalla.ruta}
                element={
                  <Pantalla
                    nombre={pantalla.nombre}
                    descripcion={pantalla.descripcion}
                  />
                }
              />
            ))}

            <Route
              path="*"
              element={<Navigate to="/solicitud" replace />}
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
