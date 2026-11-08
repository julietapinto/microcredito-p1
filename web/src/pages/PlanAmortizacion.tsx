
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'

type Dinero = {
  valor: string
  moneda: string
}

type Cuota = {
  numero: number
  fechaVencimiento: string
  saldoInicial: Dinero
  monto: Dinero
  interes: Dinero
  amortizacion: Dinero
  saldoFinal: Dinero
}

type Plan = {
  creditoId: string
  capital: Dinero
  tasaNominalAnual: string
  plazoMeses: number
  cuotaMensual: Dinero
  cuotas: Cuota[]
}

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

function mostrarDinero(dinero?: Dinero) {
  if (!dinero) return '—'
  return `${dinero.moneda === 'GTQ' ? 'Q' : dinero.moneda} ${dinero.valor}`
}

export default function PlanAmortizacion() {
  const [params] = useSearchParams()
  const [creditoId, setCreditoId] = useState(params.get('id') || '')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function consultarPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const id = creditoId.trim()

    if (!id) {
      setError('Ingresa el identificador del crédito.')
      return
    }

    setCargando(true)
    setError('')
    setPlan(null)

    try {
      const respuesta = await fetch(
        `${API_URL}/creditos/${encodeURIComponent(id)}/plan-amortizacion`
      )

      if (!respuesta.ok) {
        if (respuesta.status === 404) {
          throw new Error(
            'No se encontró el plan de amortización de este crédito.'
          )
        }

        throw new Error(
          `No se pudo consultar el plan. Código HTTP: ${respuesta.status}`
        )
      }

      const datos: Plan = await respuesta.json()

      if (!datos || !Array.isArray(datos.cuotas)) {
        throw new Error('La API devolvió un plan con formato inválido.')
      }

      setPlan(datos)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al consultar el crédito.'
      )
    } finally {
      setCargando(false)
    }
  }

  const input =
    'w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-emerald-700">
          Cartera / Créditos
        </p>

        <h2 className="text-2xl font-bold text-slate-900">
          Plan de amortización
        </h2>

        <p className="mt-1 text-slate-600">
          Consulta las cuotas, intereses, amortizaciones y saldos
          de un crédito.
        </p>
      </div>

      {/* BUSCADOR */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">
          Consultar plan
        </h3>

        <form
          onSubmit={consultarPlan}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <input
            className={input}
            value={creditoId}
            onChange={(e) => setCreditoId(e.target.value)}
            placeholder="Identificador del crédito"
            aria-label="Identificador del crédito"
            required
          />

          <button
            type="submit"
            disabled={cargando}
            className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
          >
            {cargando ? 'Consultando...' : 'Consultar'}
          </button>
        </form>
      </div>

      {/* ERROR */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          <p className="font-semibold">No se pudo cargar el plan</p>
          <p className="mt-1 text-sm">{error}</p>
          <p className="mt-2 text-xs">
            Verifica el identificador y que la API esté disponible.
          </p>
        </div>
      )}

      {/* ESTADO INICIAL */}
      {!plan && !error && !cargando && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="text-4xl">📋</div>

          <h3 className="mt-4 text-lg font-semibold text-slate-900">
            Consulta un crédito
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Ingresa un identificador para visualizar su plan de
            amortización cuando la API esté disponible.
          </p>
        </div>
      )}

      {/* CARGANDO */}
      {cargando && (
        <div
          role="status"
          className="rounded-xl bg-white p-8 text-center text-slate-600 shadow-sm"
        >
          Consultando el plan de amortización...
        </div>
      )}

      {/* RESULTADOS */}
      {plan && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                titulo: 'Capital',
                valor: mostrarDinero(plan.capital),
              },
              {
                titulo: 'Tasa nominal anual',
                valor: `${plan.tasaNominalAnual}%`,
              },
              {
                titulo: 'Plazo',
                valor: `${plan.plazoMeses} meses`,
              },
              {
                titulo: 'Cuota mensual',
                valor: mostrarDinero(plan.cuotaMensual),
              },
            ].map((indicador) => (
              <div
                key={indicador.titulo}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm text-slate-500">
                  {indicador.titulo}
                </p>

                <p className="mt-2 text-xl font-bold text-slate-900">
                  {indicador.valor}
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <h3 className="text-lg font-semibold text-slate-900">
                Calendario de pagos
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Crédito {plan.creditoId} · {plan.cuotas.length} cuotas
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Cuota</th>
                    <th className="px-4 py-3">Vencimiento</th>
                    <th className="px-4 py-3">Saldo inicial</th>
                    <th className="px-4 py-3">Interés</th>
                    <th className="px-4 py-3">Capital</th>
                    <th className="px-4 py-3">Monto cuota</th>
                    <th className="px-4 py-3">Saldo final</th>
                  </tr>
                </thead>

                <tbody>
                  {plan.cuotas.map((cuota) => (
                    <tr
                      key={cuota.numero}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-semibold">
                        {cuota.numero}
                      </td>
                      <td className="px-4 py-3">
                        {cuota.fechaVencimiento}
                      </td>
                      <td className="px-4 py-3">
                        {mostrarDinero(cuota.saldoInicial)}
                      </td>
                      <td className="px-4 py-3">
                        {mostrarDinero(cuota.interes)}
                      </td>
                      <td className="px-4 py-3">
                        {mostrarDinero(cuota.amortizacion)}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {mostrarDinero(cuota.monto)}
                      </td>
                      <td className="px-4 py-3">
                        {mostrarDinero(cuota.saldoFinal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {plan.cuotas.length === 0 && (
              <p className="p-6 text-center text-slate-500">
                No hay cuotas disponibles.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
