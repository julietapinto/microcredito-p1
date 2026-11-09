import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Pool, type PoolClient } from "pg";
import { z } from "zod";

const ClienteEventSchema = z.object({
  seq: z.number().int().positive(), tipo: z.literal("CLIENTE"),
  id_cliente: z.string().min(1), nombre_completo: z.string().min(1),
  dpi: z.string().min(1), telefono: z.string().min(1),
  municipio: z.string().min(1), fecha_alta: z.string().date()
});
const DesembolsoEventSchema = z.object({
  seq: z.number().int().positive(), tipo: z.literal("DESEMBOLSO"),
  id_credito: z.string().min(1), id_cliente: z.string().min(1),
  id_asesor: z.string().min(1), fecha: z.string().date(),
  capital_centavos: z.number().int().positive(),
  plazo_meses: z.number().int().positive(),
  tna_bps: z.number().int().nonnegative(),
  reestructurado: z.boolean()
});
const PagoEventSchema = z.object({
  seq: z.number().int().positive(), tipo: z.literal("PAGO"),
  clave_idempotencia: z.string().min(1), id_credito: z.string().min(1),
  fecha: z.string().date(), monto_centavos: z.number().int().positive(),
  canal: z.string().min(1)
});
export const EventoSchema = z.discriminatedUnion("tipo", [
  ClienteEventSchema, DesembolsoEventSchema, PagoEventSchema
]);
export type Evento = z.infer<typeof EventoSchema>;

export interface ResultadoCarga {
  sha256: string;
  eventosLeidos: number;
  clientesLeidos: number;
  creditosLeidos: number;
  pagosLeidos: number;
  pagosNuevos: number;
  pagosYaExistentes: number;
  pagosDuplicadosEnArchivo: number;
}

export function calcularSha256(contenido: Buffer | string): string {
  return createHash("sha256").update(contenido).digest("hex");
}

export function parsearEventos(contenido: string): Evento[] {
  const eventos = contenido.split(/\r?\n/u).filter((linea) => linea.trim() !== "")
    .map((linea, indice) => {
      let valor: unknown;
      try { valor = JSON.parse(linea) as unknown; }
      catch { throw new Error(`JSON inválido en línea ${indice + 1}`); }
      return EventoSchema.parse(valor);
    });
  const secuencias = new Set(eventos.map((evento) => evento.seq));
  if (secuencias.size !== eventos.length) throw new Error("Hay secuencias de evento repetidas.");
  return eventos.sort((a, b) => a.seq - b.seq);
}

async function verificarPaquete(dataDir: string): Promise<{ contenido: string; sha256: string }> {
  const bytes = await readFile(path.join(dataDir, "eventos.jsonl"));
  const shaFile = await readFile(path.join(dataDir, "eventos.sha256"), "utf8");
  const esperado = shaFile.trim().split(/\s+/u)[0]?.toLowerCase();
  const calculado = calcularSha256(bytes);
  if (!esperado || calculado !== esperado) {
    throw new Error(`SHA-256 no coincide. Esperado=${esperado ?? "vacío"} Calculado=${calculado}. Carga cancelada.`);
  }
  return { contenido: bytes.toString("utf8"), sha256: calculado };
}

function parseCsvBasico(texto: string): string[][] {
  // El CSV canónico utiliza campos simples sin comas embebidas.
  return texto.trim().split(/\r?\n/u).map((linea) => linea.split(",").map((v) => v.trim()));
}

async function cargarAsesores(client: PoolClient, dataDir: string): Promise<void> {
  const filas = parseCsvBasico(await readFile(path.join(dataDir, "asesores.csv"), "utf8"));
  const encabezado = filas.shift();
  if (encabezado?.join(",") !== "id_asesor,nombre_completo") {
    throw new Error("Encabezados inválidos en asesores.csv.");
  }
  for (const fila of filas) {
    if (fila.length !== 2) throw new Error("Fila inválida en asesores.csv.");
    await client.query(
      `INSERT INTO asesores(id_asesor,nombre_completo) VALUES($1,$2)
       ON CONFLICT(id_asesor) DO UPDATE SET nombre_completo=EXCLUDED.nombre_completo`,
      fila
    );
  }
}

async function cargarPoliticas(client: PoolClient, dataDir: string): Promise<void> {
  const archivo = JSON.parse(await readFile(path.join(dataDir, "politicas.json"), "utf8")) as {
    politicas_mora?: Record<string, Record<string, unknown>>;
  };
  for (const [codigo, politica] of Object.entries(archivo.politicas_mora ?? {})) {
    const vigencia = (politica.vigencia_otorgamiento ?? {}) as { desde?: string; hasta?: string };
    await client.query(
      `INSERT INTO politicas(codigo,nombre,tipo,vigencia_desde,vigencia_hasta,parametros)
       VALUES($1,$2,$3,$4,$5,$6::jsonb)
       ON CONFLICT(codigo) DO UPDATE SET nombre=EXCLUDED.nombre,tipo=EXCLUDED.tipo,
       vigencia_desde=EXCLUDED.vigencia_desde,vigencia_hasta=EXCLUDED.vigencia_hasta,
       parametros=EXCLUDED.parametros,actualizado_en=now()`,
      [codigo, String(politica.nombre ?? codigo), String(politica.tipo ?? "sin_tipo"),
       vigencia.desde ?? null, vigencia.hasta ?? null, JSON.stringify(politica)]
    );
  }
}

async function insertarEvento(client: PoolClient, evento: Evento): Promise<void> {
  if (evento.tipo === "CLIENTE") {
    await client.query(
      `INSERT INTO clientes(id_cliente,nombre_completo,dpi,telefono,municipio,fecha_alta)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(id_cliente) DO UPDATE SET nombre_completo=EXCLUDED.nombre_completo,
       dpi=EXCLUDED.dpi,telefono=EXCLUDED.telefono,municipio=EXCLUDED.municipio,
       fecha_alta=EXCLUDED.fecha_alta,actualizado_en=now()`,
      [evento.id_cliente, evento.nombre_completo, evento.dpi, evento.telefono, evento.municipio, evento.fecha_alta]
    );
  } else if (evento.tipo === "DESEMBOLSO") {
    await client.query(
      `INSERT INTO creditos(id_credito,id_cliente,id_asesor,fecha_otorgamiento,capital_centavos,plazo_meses,tna_bps,reestructurado)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id_credito) DO NOTHING`,
      [evento.id_credito, evento.id_cliente, evento.id_asesor, evento.fecha,
       evento.capital_centavos, evento.plazo_meses, evento.tna_bps, evento.reestructurado]
    );
  }
}

export async function cargarCanonico(pool: Pool, dataDir: string): Promise<ResultadoCarga> {
  // La huella se verifica antes de conectar/escribir en la base.
  const paquete = await verificarPaquete(dataDir);
  const eventos = parsearEventos(paquete.contenido);
  const conteo = {
    clientes: eventos.filter((e) => e.tipo === "CLIENTE").length,
    creditos: eventos.filter((e) => e.tipo === "DESEMBOLSO").length,
    pagos: eventos.filter((e) => e.tipo === "PAGO").length
  };
  if (eventos.length !== 363 || conteo.clientes !== 60 || conteo.creditos !== 75 || conteo.pagos !== 228) {
    throw new Error(`Conteos canónicos incorrectos: ${JSON.stringify({ total: eventos.length, ...conteo })}`);
  }

  const client = await pool.connect();
  let pagosNuevos = 0;
  let pagosYaExistentes = 0;
  let pagosDuplicadosEnArchivo = 0;
  const clavesVistas = new Set<string>();
  try {
    await client.query("BEGIN");
    await cargarAsesores(client, dataDir);
    for (const evento of eventos) {
      let aplicado = true;
      let motivo: string | null = null;
      if (evento.tipo === "PAGO") {
        if (clavesVistas.has(evento.clave_idempotencia)) {
          aplicado = false;
          motivo = "CLAVE_REPETIDA_EN_ARCHIVO";
          pagosDuplicadosEnArchivo += 1;
        } else {
          clavesVistas.add(evento.clave_idempotencia);
          const antes = await client.query(
            "SELECT 1 FROM pagos WHERE clave_idempotencia=$1",
            [evento.clave_idempotencia]
          );
          if (antes.rowCount) pagosYaExistentes += 1;
          else pagosNuevos += 1;
        }
      }
      if (evento.tipo !== "PAGO") await insertarEvento(client, evento);
      if (evento.tipo === "PAGO" && aplicado) {
        // La restricción UNIQUE es la defensa final frente a concurrencia/reintentos.
        await client.query(
          `INSERT INTO pagos(clave_idempotencia,id_credito,fecha,monto_centavos,canal)
           VALUES($1,$2,$3,$4,$5) ON CONFLICT(clave_idempotencia) DO NOTHING`,
          [evento.clave_idempotencia, evento.id_credito, evento.fecha, evento.monto_centavos, evento.canal]
        );
      }
      await client.query(
        `INSERT INTO eventos(seq,tipo,payload,clave_idempotencia,aplicado,motivo_omision)
         VALUES($1,$2,$3::jsonb,$4,$5,$6)
         ON CONFLICT(seq) DO UPDATE SET payload=EXCLUDED.payload,tipo=EXCLUDED.tipo,
         clave_idempotencia=EXCLUDED.clave_idempotencia,aplicado=EXCLUDED.aplicado,
         motivo_omision=EXCLUDED.motivo_omision`,
        [evento.seq, evento.tipo, JSON.stringify(evento),
         evento.tipo === "PAGO" ? evento.clave_idempotencia : null, aplicado, motivo]
      );
    }
    await cargarPoliticas(client, dataDir);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return {
    sha256: paquete.sha256, eventosLeidos: eventos.length,
    clientesLeidos: conteo.clientes, creditosLeidos: conteo.creditos,
    pagosLeidos: conteo.pagos, pagosNuevos, pagosYaExistentes,
    pagosDuplicadosEnArchivo
  };
}

async function main(): Promise<void> {
  const dataDir = process.env.CV_DATA_DIR;
  const databaseUrl = process.env.DATABASE_URL;
  if (!dataDir) throw new Error("Defina CV_DATA_DIR.");
  if (!databaseUrl) throw new Error("Defina DATABASE_URL.");
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    console.table(await cargarCanonico(pool, path.resolve(dataDir)));
  } finally {
    await pool.end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error: unknown) => { console.error("Carga cancelada:", error); process.exitCode = 1; });
}

