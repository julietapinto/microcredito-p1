
export default function SolicitudCredito() {
  const campo =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none'

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Solicitud de crédito
        </h2>
        <p className="mt-1 text-slate-600">
          Registro de clientes y originación de créditos.
        </p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">
          Paso 1 — Datos del cliente
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span>Nombre completo *</span>
            <input className={campo} type="text" required />
          </label>

          <label className="space-y-1">
            <span>Identificación / DPI *</span>
            <input className={campo} type="text" required />
          </label>

          <label className="space-y-1">
            <span>Teléfono</span>
            <input className={campo} type="tel" />
          </label>

          <label className="space-y-1">
            <span>Correo electrónico</span>
            <input className={campo} type="email" />
          </label>

          <label className="space-y-1 md:col-span-2">
            <span>Dirección</span>
            <input className={campo} type="text" />
          </label>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">
          Paso 2 — Datos del crédito
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span>Monto solicitado (Q) *</span>
            <input
              className={campo}
              type="number"
              min="0.01"
              step="0.01"
              placeholder="10000.00"
              required
            />
          </label>

          <label className="space-y-1">
            <span>Plazo en meses *</span>
            <select className={campo} defaultValue="12">
              {[3, 6, 9, 12, 18, 24].map((meses) => (
                <option key={meses} value={meses}>
                  {meses} meses
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-900">
          La conexión con la API está pendiente.
          No se guardarán clientes ni solicitudes todavía.
        </p>
      </div>

      <button
        type="button"
        disabled
        className="cursor-not-allowed rounded-lg bg-slate-400 px-6 py-3 font-semibold text-white"
      >
        Registrar y continuar
      </button>
    </section>
  )
}
