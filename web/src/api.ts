export const API = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '')
export class ApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status } }
export async function request(path: string, init?: RequestInit): Promise<any> {
  let response: Response
  try { response = await fetch(API + path, init) } catch { throw new Error('No se pudo conectar con la API. Comprueba que el servidor esté disponible.') }
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, `${response.status}: ${data?.detail || data?.title || 'No fue posible completar la solicitud.'}`)
  if (!data || typeof data !== 'object') throw new Error('La API devolvió una respuesta inválida.')
  return data
}
export const json = (data: unknown, headers: Record<string, string> = {}): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) })
export const money = (v: any) => v && typeof v.valor === 'string' && typeof v.moneda === 'string' ? `${v.moneda === 'GTQ' ? 'Q' : v.moneda} ${v.valor}` : 'No disponible'
export const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-emerald-600 focus:outline-none'
export const button = 'rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50'
export const card = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm'
