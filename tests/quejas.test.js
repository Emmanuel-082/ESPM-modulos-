/**
 * quejas.test.js
 * Pruebas unitarias del módulo 2: quejas, peticiones y reclamos (quejasController.js).
 *
 * Aquí se prueban las validaciones de longitud, de caracteres especiales
 * y de cuenta existente, además de la consulta por cuenta y por radicado.
 */

'use strict';

const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { limpiarDatos, ejecutar } = require('./helpers');
const {
  radicarQueja,
  consultarQuejas,
  consultarQuejaPorRadicado,
  generarRadicado
} = require('../src/controllers/quejasController');

beforeEach(limpiarDatos);

/**
 * Crea el cuerpo de una queja correcta. Cada prueba cambia solo el campo
 * que quiere probar, así se ve claramente qué dato causa el error.
 * @param {object} cambios - Campos que reemplazan a los valores correctos
 * @returns {object} Cuerpo de la petición
 */
function quejaValida(cambios = {}) {
  return {
    numeroCuenta: '1001',
    tipo: 'QUEJA',
    asunto: 'Cobro incorrecto',
    descripcion: 'Me cobraron el aseo dos veces este mes.',
    ...cambios
  };
}

describe('generarRadicado', () => {
  test('crea el radicado con el año actual y 6 dígitos', () => {
    const anio = new Date().getFullYear();
    assert.equal(generarRadicado(7), `PQR-${anio}-000007`);
  });
});

describe('radicarQueja: validaciones', () => {
  test('responde 400 si falta el número de cuenta', () => {
    const res = ejecutar(radicarQueja, { body: quejaValida({ numeroCuenta: '' }) });
    assert.equal(res.codigo, 400);
  });

  test('responde 400 si el tipo no es PETICION, QUEJA o RECLAMO', () => {
    const res = ejecutar(radicarQueja, { body: quejaValida({ tipo: 'SUGERENCIA' }) });
    assert.equal(res.codigo, 400);
    assert.match(res.cuerpo.error, /PETICION, QUEJA, RECLAMO/);
  });

  test('responde 400 si el asunto tiene menos de 5 caracteres', () => {
    const res = ejecutar(radicarQueja, { body: quejaValida({ asunto: 'Hola' }) });
    assert.equal(res.codigo, 400);
  });

  test('responde 400 si el asunto tiene más de 100 caracteres', () => {
    const res = ejecutar(radicarQueja, { body: quejaValida({ asunto: 'a'.repeat(101) }) });
    assert.equal(res.codigo, 400);
  });

  test('responde 400 si el asunto son solo espacios en blanco', () => {
    const res = ejecutar(radicarQueja, { body: quejaValida({ asunto: '          ' }) });
    assert.equal(res.codigo, 400);
  });

  test('responde 400 si la descripción tiene menos de 10 caracteres', () => {
    const res = ejecutar(radicarQueja, { body: quejaValida({ descripcion: 'Muy corta' }) });
    assert.equal(res.codigo, 400);
  });

  test('responde 400 si la descripción tiene más de 1000 caracteres', () => {
    const res = ejecutar(radicarQueja, { body: quejaValida({ descripcion: 'a'.repeat(1001) }) });
    assert.equal(res.codigo, 400);
  });

  test('responde 404 si el número de cuenta no existe', () => {
    const res = ejecutar(radicarQueja, { body: quejaValida({ numeroCuenta: '9999' }) });
    assert.equal(res.codigo, 404);
  });

  test('responde 400 si no se envía ningún cuerpo', () => {
    const res = ejecutar(radicarQueja, { body: undefined });
    assert.equal(res.codigo, 400);
  });
});

describe('radicarQueja: límites de longitud', () => {
  test('acepta un asunto de exactamente 5 y de exactamente 100 caracteres', () => {
    const corto = ejecutar(radicarQueja, { body: quejaValida({ asunto: 'abcde' }) });
    const largo = ejecutar(radicarQueja, { body: quejaValida({ asunto: 'a'.repeat(100) }) });
    assert.equal(corto.codigo, 201);
    assert.equal(largo.codigo, 201);
  });

  test('acepta una descripción de exactamente 10 y de exactamente 1000 caracteres', () => {
    const corta = ejecutar(radicarQueja, { body: quejaValida({ descripcion: 'a'.repeat(10) }) });
    const larga = ejecutar(radicarQueja, { body: quejaValida({ descripcion: 'a'.repeat(1000) }) });
    assert.equal(corta.codigo, 201);
    assert.equal(larga.codigo, 201);
  });
});

describe('radicarQueja: radicación correcta', () => {
  test('responde 201 y entrega la queja con estado RADICADA y sin respuesta', () => {
    const res = ejecutar(radicarQueja, { body: quejaValida() });
    assert.equal(res.codigo, 201);

    const queja = res.cuerpo.queja;
    assert.equal(queja.estado, 'RADICADA');
    assert.equal(queja.numeroCuenta, '1001');
    assert.equal(queja.tipo, 'QUEJA');
    assert.equal(queja.respuesta, null);
    assert.equal(queja.fechaRespuesta, null);
  });

  test('asigna un radicado con el formato PQR-AAAA-000000', () => {
    const res = ejecutar(radicarQueja, { body: quejaValida() });
    assert.match(res.cuerpo.queja.radicado, /^PQR-\d{4}-\d{6}$/);
  });

  test('cada queja recibe un radicado distinto', () => {
    const primera = ejecutar(radicarQueja, { body: quejaValida() });
    const segunda = ejecutar(radicarQueja, { body: quejaValida() });
    assert.notEqual(primera.cuerpo.queja.radicado, segunda.cuerpo.queja.radicado);
  });

  test('acepta el tipo en minúsculas y lo guarda en mayúsculas', () => {
    const res = ejecutar(radicarQueja, { body: quejaValida({ tipo: 'reclamo' }) });
    assert.equal(res.codigo, 201);
    assert.equal(res.cuerpo.queja.tipo, 'RECLAMO');
  });

  test('quita los espacios sobrantes al inicio y al final de los textos', () => {
    const res = ejecutar(radicarQueja, { body: quejaValida({ asunto: '   Cobro incorrecto   ' }) });
    assert.equal(res.cuerpo.queja.asunto, 'Cobro incorrecto');
  });

  test('acepta tildes, eñes y signos de puntuación en los textos', () => {
    const res = ejecutar(radicarQueja, {
      body: quejaValida({
        asunto: '¿Por qué no hay agua? ¡Urgente!',
        descripcion: 'Desde el lunes no llega el agua al barrio San José (Moniquirá), ñandú.'
      })
    });
    assert.equal(res.codigo, 201);
    assert.equal(res.cuerpo.queja.asunto, '¿Por qué no hay agua? ¡Urgente!');
  });

  test('guarda sin ejecutar un texto con comillas o caracteres de código (inyección SQL)', () => {
    const res = ejecutar(radicarQueja, {
      body: quejaValida({ asunto: "x'); DROP TABLE quejas;--", descripcion: "Texto con 'comillas' y \"dobles\"" })
    });
    assert.equal(res.codigo, 201);

    // Si la tabla se hubiera borrado, esta consulta fallaría
    const lista = ejecutar(consultarQuejas, { query: { cuenta: '1001' } });
    assert.equal(lista.cuerpo.quejas.length, 1);
    assert.equal(lista.cuerpo.quejas[0].asunto, "x'); DROP TABLE quejas;--");
  });
});

describe('consultarQuejas', () => {
  test('responde 400 si no se envía el número de cuenta', () => {
    const res = ejecutar(consultarQuejas, { query: {} });
    assert.equal(res.codigo, 400);
  });

  test('devuelve una lista vacía si la cuenta no tiene quejas', () => {
    const res = ejecutar(consultarQuejas, { query: { cuenta: '1001' } });
    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo.quejas, []);
  });

  test('muestra primero la queja más reciente', () => {
    ejecutar(radicarQueja, { body: quejaValida({ asunto: 'Primera queja' }) });
    ejecutar(radicarQueja, { body: quejaValida({ asunto: 'Segunda queja' }) });

    const res = ejecutar(consultarQuejas, { query: { cuenta: '1001' } });
    assert.equal(res.cuerpo.quejas.length, 2);
    assert.equal(res.cuerpo.quejas[0].asunto, 'Segunda queja');
  });

  test('no muestra las quejas de otras cuentas', () => {
    ejecutar(radicarQueja, { body: quejaValida({ numeroCuenta: '1002' }) });
    const res = ejecutar(consultarQuejas, { query: { cuenta: '1001' } });
    assert.equal(res.cuerpo.quejas.length, 0);
  });
});

describe('consultarQuejaPorRadicado', () => {
  test('responde 404 si el radicado no existe', () => {
    const res = ejecutar(consultarQuejaPorRadicado, { params: { radicado: 'PQR-2026-999999' } });
    assert.equal(res.codigo, 404);
  });

  test('encuentra la queja por su radicado', () => {
    const creada = ejecutar(radicarQueja, { body: quejaValida() });
    const radicado = creada.cuerpo.queja.radicado;

    const res = ejecutar(consultarQuejaPorRadicado, { params: { radicado } });
    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.queja.radicado, radicado);
  });

  test('encuentra la queja aunque el radicado se escriba en minúsculas', () => {
    const creada = ejecutar(radicarQueja, { body: quejaValida() });
    const radicado = creada.cuerpo.queja.radicado.toLowerCase();

    const res = ejecutar(consultarQuejaPorRadicado, { params: { radicado } });
    assert.equal(res.codigo, 200);
  });
});
