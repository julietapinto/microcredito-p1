import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'

const source = await readFile(new URL('../src/api.ts', import.meta.url), 'utf8')
const compiled = stripTypeScriptTypes(source.replace('import.meta.env.VITE_API_URL', '"http://example.test/api"'))
const { request, json, money, ApiError } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('envía el cuerpo y la clave de idempotencia sin cambios', async () => {
  const original = globalThis.fetch
  let sent
  globalThis.fetch = async (url, init) => { sent = { url, init }; return new Response(JSON.stringify({ pagoId: 'PG-1' }), { status: 201 }) }
  try {
    const result = await request('/creditos/C-001/pagos', json({ monto: { valor: '12.50', moneda: 'GTQ' } }, { 'Idempotency-Key': 'clave' }))
    assert.equal(result.pagoId, 'PG-1')
    assert.equal(sent.url, 'http://example.test/api/creditos/C-001/pagos')
    assert.equal(sent.init.headers['Idempotency-Key'], 'clave')
    assert.equal(JSON.parse(sent.init.body).monto.valor, '12.50')
  } finally { globalThis.fetch = original }
})

test('conserva el código y el detalle de un rechazo', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: 'Crédito no habilitado' }), { status: 422 })
  try { await assert.rejects(request('/test'), e => e instanceof ApiError && e.status === 422 && e.message.includes('Crédito no habilitado')) }
  finally { globalThis.fetch = original }
})

test('informa problemas de conexión y no inventa importes', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => { throw new TypeError('network') }
  try { await assert.rejects(request('/test'), /conectar con la API/); assert.equal(money(undefined), 'No disponible'); assert.equal(money({ valor: '12.50', moneda: 'GTQ' }), 'Q 12.50') }
  finally { globalThis.fetch = original }
})
