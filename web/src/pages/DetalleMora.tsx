
import { useState, type FormEvent } from 'react'

type Dinero = {
  valor: string
  moneda: string
}

type Credito = {
  id: string
  clienteId: string
  estado: string
  saldoCapital?: Dinero
  diasAtraso?: number
  tramoMora?: string
}

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const tramos = [
  'SIN_MORA',
  'MORA_1',
  'MORA_2',
  'MORA_3',
  'VENCIDO',
  'INCOBRABLE',
]

function mostrarDinero(dinero?: Dinero) {
  if (!dinero) return 'No disponible'

  return `${dinero.moneda === 'GTQ' ? 'Q' : dinero.moneda} ${dinero.valor}`
}

export default function DetalleMora() {
  const [creditoId, setCreditoId] = useState('')
  const [credito, setCredito] = useState<Credito | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function consultar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const id = creditoId.trim()

    if (!id) return

    setCargando(true)
    setError('')
    setCredito(null)

    try {
      const respuesta = await fetch(
        `${API_URL}/creditos/${encodeURIComponent(id)}`
      )

      if (!respuesta.ok) {
        if (respuesta.status === 404) {
          throw new Error('El crédito no fue encontrado.')
        }

        throw new Error(
          `No fue posible consultar el crédito. HTTP ${respuesta.status}`
        )
      }

      const datos: Credito = await respuesta.json()

      if (
        !datos ||
        typeof datos.id !== 'string' ||
        typeof datos.estado !== 'string'
      ) {
        throw new Error('La API devolvió datos inválidos.')
      }

      setCredito(datos)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error desconocido al consultar.'
      )
    } finally {
      setCargando(false)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-emerald-700">
          Cartera / Control de mora
        </p>

        <h2 className="text-2xl font-bold text-slate-900">
          Detalle de mora
        </h2>

        <p className="mt-1 text-slate-600">
          Consulta atrasos, clasificación y situación del crédito.
        </p>
      </div>

      {/* BUSCADOR */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">
          Consultar crédito
        </h3>

        <form
          onSubmit={consultar}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="text"
            value={creditoId}
            onChange={(e) => setCreditoId(e.target.value)}
            placeholder="Identificador del crédito"
            aria-label="Identificador del crédito"
            required
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-600"
          />

          <button
            type="submit"
            disabled={cargando}
            className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {cargando ? 'Consultando...' : 'Consultar'}
          </button>
        </form>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          <p className="font-semibold">Error de consulta</p>
          <p className="mt-1 text-sm">{error}</p>
          <p className="mt-2 text-xs">
            Comprueba el identificador y que el backend esté funcionando.
          </p>
        </div>
      )}

      {cargando && (
        <div role="status" className="rounded-xl bg-white p-6 text-center">
          Consultando información del crédito...
        </div>
      )}

      {!credito && !error && !cargando && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="text-4xl">🔎</div>

          <h3 className="mt-4 text-lg font-semibold text-slate-900">
            Ningún crédito seleccionado
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Ingresa un identificador para consultar su situación de mora.
          </p>
        </div>
      )}

      {credito && (
        <>
          {/* RESUMEN */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { titulo: 'Crédito', valor: credito.id },
              { titulo: 'Estado', valor: credito.estado },
              {
                titulo: 'Días de atraso',
                valor:
                  credito.diasAtraso === undefined
                    ? 'No disponible'
                    : `${credito.diasAtraso} días`,
              },
              {
                titulo: 'Saldo de capital',
                valor: mostrarDinero(credito.saldoCapital),
              },
            ].map((dato) => (
              <div
                key={dato.titulo}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm text-slate-500">
                  {dato.titulo}
                </p>

                <p className="mt-2 break-words text-xl font-bold text-slate-900">
                  {dato.valor}
                </p>
              </div>
            ))}
          </div>

          {/* CLASIFICACIÓN */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              Clasificación de mora
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Tramo informado por el sistema financiero.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tramos.map((tramo) => {
                const activo = credito.tramoMora === tramo

                return (
                  <div
                    key={tramo}
                    className={`rounded-lg border p-4 ${
                      activo
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <p
                      className={`font-semibold ${
                        activo
                          ? 'text-emerald-800'
                          : 'text-slate-600'
                      }`}
                    >
                      {tramo.replaceAll('_', ' ')}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {activo ? 'Tramo actual' : 'No corresponde'}
                    </p>
                  </div>
                )
              })}
            </div>

            {!credito.tramoMora && (
              <p className="mt-4 text-sm text-amber-700">
                La API no proporcionó la clasificación de mora.
              </p>
            )}
          </div>

          {/* DESGLOSE */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              Desglose de mora por tramos
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              Pendiente de integrar el detalle de intereses moratorios,
              gastos y períodos desde el núcleo financiero.
            </p>

            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
              El endpoint de consulta de crédito todavía no proporciona
              este desglose. No se mostrarán importes estimados.
            </div>
          </div>
        </>
      )}
    </section>
  )
}
