import { useState } from 'react'

export default function DetalleCredito() {
  const [creditoId, setCreditoId] = useState('')

  const campo =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-emerald-700">
          Consulta de cartera
        </p>

        <h2 className="text-2xl font-bold text-slate-900">
          Detalle del crédito
        </h2>

        <p className="mt-1 text-slate-600">
          Consulta el estado y la información asociada a un crédito.
        </p>
      </div>

      {/* BUSCADOR */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">
          Buscar crédito
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Ingresa el identificador del crédito que deseas consultar.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={creditoId}
            onChange={(event) => setCreditoId(event.target.value)}
            className={campo}
            placeholder="Ej. CV-2026-0043"
          />

          <button
            type="button"
            disabled
            className="rounded-lg bg-slate-400 px-6 py-2.5 font-semibold text-white disabled:cursor-not-allowed"
          >
            Consultar
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          La consulta se habilitará al conectar esta pantalla con la API.
        </p>
      </div>

      {/* ESTADO SIN DATOS */}
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
          🔎
        </div>

        <h3 className="mt-4 font-semibold text-slate-900">
          Ningún crédito consultado
        </h3>

        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
          Cuando se conecte la API, aquí se mostrará la información real
          del crédito seleccionado.
        </p>
      </div>

      {/* ESTRUCTURA QUE RECIBIRÁ LOS DATOS */}
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
        <h3 className="font-semibold text-slate-800">
          Información disponible al consultar
        </h3>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            'Estado del crédito',
            'Cliente',
            'Saldo de capital',
            'Capital desembolsado',
            'Plazo',
            'Tasa',
            'Días de atraso',
            'Tramo de mora',
          ].map((dato) => (
            <div
              key={dato}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {dato}
              </p>

              <p className="mt-2 text-sm text-slate-400">
                Pendiente de consulta
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}