
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it
} from "vitest";
import { Pool } from "pg";
import {
  RepositorioFragmentosPostgres,
  type FragmentoDocumento
} from "../src/persistencia/repositorios/repositorio-fragmentos-postgres.js";

describe("RepositorioFragmentosPostgres", () => {
  let pool: Pool;
  let repositorio: RepositorioFragmentosPostgres;

  const documento = "TEST-RAG-POSTGRES";

  function crearEmbedding(): number[] {
    const embedding = new Array<number>(1024).fill(0);
    embedding[0] = 1;
    return embedding;
  }

  function crearFragmento(
    identificador = "FRAGMENTO-001",
    contenido = "Información de prueba para Crédito Vecino."
  ): FragmentoDocumento {
    return {
      documento,
      identificador,
      seccion: "Pruebas de persistencia",
      contenido,
      metadata: {
        origen: "test",
        tipo: "documentacion"
      },
      embedding: crearEmbedding()
    };
  }

  beforeAll(() => {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        "Debes configurar DATABASE_URL antes de ejecutar estas pruebas."
      );
    }

    pool = new Pool({ connectionString });
    repositorio = new RepositorioFragmentosPostgres(pool);
  });

  beforeEach(async () => {
    await pool.query(
      "DELETE FROM fragmentos WHERE documento = $1",
      [documento]
    );
  });

  afterAll(async () => {
    if (pool) {
      try {
        await pool.query(
          "DELETE FROM fragmentos WHERE documento = $1",
          [documento]
        );
      } finally {
        await pool.end();
      }
    }
  });

  it("guarda un fragmento en PostgreSQL", async () => {
    const fragmento = crearFragmento();

    await repositorio.guardar(fragmento);

    const resultado = await pool.query(
      `SELECT documento, identificador, contenido, metadata
       FROM fragmentos
       WHERE documento = $1 AND identificador = $2`,
      [documento, fragmento.identificador]
    );

    expect(resultado.rows).toHaveLength(1);
    expect(resultado.rows[0].documento).toBe(documento);
    expect(resultado.rows[0].contenido).toBe(fragmento.contenido);
    expect(resultado.rows[0].metadata.origen).toBe("test");
  });

  it("actualiza un fragmento sin generar otro registro", async () => {
    await repositorio.guardar(crearFragmento());

    const contenidoActualizado =
      "Contenido actualizado del documento.";

    await repositorio.guardar(
      crearFragmento("FRAGMENTO-001", contenidoActualizado)
    );

    const resultado = await pool.query(
      `SELECT contenido
       FROM fragmentos
       WHERE documento = $1 AND identificador = $2`,
      [documento, "FRAGMENTO-001"]
    );

    expect(resultado.rows).toHaveLength(1);
    expect(resultado.rows[0].contenido).toBe(contenidoActualizado);
  });

  it("guarda varios fragmentos en una sola operación", async () => {
    const fragmentos = [
      crearFragmento(
        "FRAGMENTO-002",
        "Información del primer fragmento."
      ),
      crearFragmento(
        "FRAGMENTO-003",
        "Información del segundo fragmento."
      )
    ];

    await repositorio.guardarMuchos(fragmentos);

    const resultado = await pool.query(
      "SELECT identificador FROM fragmentos WHERE documento = $1",
      [documento]
    );

    expect(resultado.rows).toHaveLength(2);
  });

  it("recupera los fragmentos más similares", async () => {
    await repositorio.guardar(
      crearFragmento(
        "FRAGMENTO-004",
        "Información sobre créditos."
      )
    );

    const resultados = await repositorio.buscarSimilares(
      crearEmbedding(),
      5
    );

    expect(resultados).toHaveLength(1);

    const primerResultado = resultados[0];

    if (!primerResultado) {
      throw new Error("No se encontró el fragmento esperado.");
    }

    expect(primerResultado.documento).toBe(documento);
    expect(primerResultado.identificador).toBe("FRAGMENTO-004");
    expect(primerResultado.contenido).toBe(
      "Información sobre créditos."
    );
    expect(primerResultado.similitud).toBeCloseTo(1);
  });

  it("rechaza embeddings con dimensiones incorrectas", async () => {
    const fragmento: FragmentoDocumento = {
      ...crearFragmento(),
      embedding: [1, 0, 0]
    };

    await expect(
      repositorio.guardar(fragmento)
    ).rejects.toThrow(
      "El embedding debe contener 1024 dimensiones."
    );
  });

  it("rechaza un límite de búsqueda fuera del rango permitido", async () => {
    await expect(
      repositorio.buscarSimilares(crearEmbedding(), 0)
    ).rejects.toThrow(
      "El límite de resultados debe estar entre 1 y 100."
    );
  });

  it("elimina los fragmentos de un documento", async () => {
    await repositorio.guardarMuchos([
      crearFragmento("FRAGMENTO-005"),
      crearFragmento("FRAGMENTO-006")
    ]);

    const eliminados =
      await repositorio.eliminarDocumento(documento);

    expect(eliminados).toBe(2);

    const resultado = await pool.query(
      "SELECT id FROM fragmentos WHERE documento = $1",
      [documento]
    );

    expect(resultado.rows).toHaveLength(0);
  });
});
