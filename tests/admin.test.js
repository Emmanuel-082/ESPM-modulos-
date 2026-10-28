/**
 * admin.test.js
 * Pruebas unitarias del módulo 3: administración (adminController.js).
 *
 * Aquí se prueban las validaciones de fechas, números y textos al crear
 * facturas, y las reglas para responder quejas.
 */

'use strict';

const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { limpiarDatos, ejecutar } = require('./helpers');
const {
  crearFactura,
  listarFacturas,
  listarQuejas,
  responderQueja,
  obtenerResumen,
  esFechaValida
} = require('../src/controllers/adminController');
const { pagarFactura } = require('../src/controllers/pagosController');
const { radicarQueja } = require('../src/controllers/quejasController');

beforeEach(limpiarDatos);

/**
 * Crea el cuerpo de una factura correcta. Cada prueba cambia solo el campo
 * que quiere probar.
 * @param {object} cambios - Campos que reemplazan a los valores correctos
 * @returns {object} Cuerpo de la petición
 */
function facturaValida(cambios = {}) {
  return {
    numeroCuenta: '1004',
    titular: 'Ana Torres',
    servicio: 'Acueducto',
    periodo: '2026-10',
    valor: 45000,
    fechaVencimiento: '2026-11-10',
    ...cambios
  };
}

/**
 * Radica una queja de la cuenta 1001 y devuelve su id.
 * @returns {number} Id de la queja creada
 */
function radicarQuejaDePrueba() {
  const res = ejecutar(radicarQueja, {
    body: {
      numeroCuenta: '1001',
      tipo: 'QUEJA',
      asunto: 'Cobro incorrecto',
      descripcion: 'Me cobraron el aseo dos veces este mes.'
    }
  });
  return res.cuerpo.queja.id;
}

describe('esFechaValida', () => {
  test('acepta fechas reales con el formato AAAA-MM-DD', () => {
    assert.equal(esFechaValida('2026-10-10'), true);
    assert.equal(esFechaValida('2026-12-31'), true);
  });

  test('acepta el 29 de febrero solo en año bisiesto', () => {
    assert.equal(esFechaValida('2028-02-29'), true);
    assert.equal(esFechaValida('2027-02-29'), false);
  });

  test('rechaza fechas que no existen en el calendario', () => {
    assert.equal(esFechaValida('2026-02-30'), false);
    assert.equal(esFechaValida('2026-13-01'), false);
    assert.equal(esFechaValida('2026-04-31'), false);
    assert.equal(esFechaValida('2026-00-10'), false);
  });

  test('rechaza textos con otro formato', () => {
    assert.equal(esFechaValida('10-10-2026'), false);
    assert.equal(esFechaValida('2026/10/10'), false);
    assert.equal(esFechaValida('2026-1-1'), false);
    assert.equal(esFechaValida('abc'), false);
    assert.equal(esFechaValida(''), false);
  });
});

describe('crearFactura: validaciones', () => {
  test('responde 400 si falta el número de cuenta', () => {
    const res = ejecutar(crearFactura, { body: facturaValida({ numeroCuenta: '' }) });
    assert.equal(res.codigo, 400);
  });

  test('responde 400 si falta el titular', () => {
    const res = ejecutar(crearFactura, { body: facturaValida({ titular: '   ' }) });
    assert.equal(res.codigo, 400);
  });

  test('responde 400 si el servicio no es Acueducto, Alcantarillado o Aseo', () => {
    const res = ejecutar(crearFactura, { body: facturaValida({ servicio: 'Gas' }) });
    assert.equal(res.codigo, 400);
    assert.match(res.cuerpo.error, /Acueducto, Alcantarillado, Aseo/);
  });

  test('responde 400 si el periodo no tiene el formato AAAA-MM', () => {
    const formatos = ['2026-13', '2026-00', '2026-1', '26-10', 'octubre', ''];
    formatos.forEach((periodo) => {
      const res = ejecutar(crearFactura, { body: facturaValida({ periodo }) });
      assert.equal(res.codigo, 400, `El periodo "${periodo}" debía ser rechazado`);
    });
  });

  test('responde 400 si el valor es cero, negativo, decimal o no es un número', () => {
    const valores = [0, -5000, 100.5, 'abc', '', null];
    valores.forEach((valor) => {
      const res = ejecutar(crearFactura, { body: facturaValida({ valor }) });
      assert.equal(res.codigo, 400, `El valor ${JSON.stringify(valor)} debía ser rechazado`);
    });
  });

  test('responde 400 si la fecha de vencimiento no existe o tiene mal el formato', () => {
    const fechas = ['2026-02-30', '2026-13-01', '10/11/2026', 'mañana', ''];
    fechas.forEach((fechaVencimiento) => {
      const res = ejecutar(crearFactura, { body: facturaValida({ fechaVencimiento }) });
      assert.equal(res.codigo, 400, `La fecha "${fechaVencimiento}" debía ser rechazada`);
    });
  });

  test('responde 409 si ya existe una factura del mismo servicio y periodo para la cuenta', () => {
    ejecutar(crearFactura, { body: facturaValida() });
    const repetida = ejecutar(crearFactura, { body: facturaValida({ valor: 50000 }) });
    assert.equal(repetida.codigo, 409);
  });
});

describe('crearFactura: creación correcta', () => {
  test('responde 201 y entrega la factura con estado PENDIENTE', () => {
    const res = ejecutar(crearFactura, { body: facturaValida() });
    assert.equal(res.codigo, 201);

    const factura = res.cuerpo.factura;
    assert.equal(factura.numeroCuenta, '1004');
    assert.equal(factura.titular, 'Ana Torres');
    assert.equal(factura.valor, 45000);
    assert.equal(factura.estado, 'PENDIENTE');
  });

  test('corrige las mayúsculas del servicio ("aseo" pasa a "Aseo")', () => {
    const res = ejecutar(crearFactura, { body: facturaValida({ servicio: 'aseo' }) });
    assert.equal(res.codigo, 201);
    assert.equal(res.cuerpo.factura.servicio, 'Aseo');
  });

  test('acepta el valor escrito como texto, por ejemplo "45000"', () => {
    const res = ejecutar(crearFactura, { body: facturaValida({ valor: '45000' }) });
    assert.equal(res.codigo, 201);
    assert.equal(res.cuerpo.factura.valor, 45000);
  });

  test('permite la misma cuenta y servicio en otro periodo', () => {
    ejecutar(crearFactura, { body: facturaValida() });
    const otroPeriodo = ejecutar(crearFactura, { body: facturaValida({ periodo: '2026-11' }) });
    assert.equal(otroPeriodo.codigo, 201);
  });

  test('acepta tildes en el nombre del titular', () => {
    const res = ejecutar(crearFactura, { body: facturaValida({ titular: 'José Ángel Muñoz' }) });
    assert.equal(res.codigo, 201);
    assert.equal(res.cuerpo.factura.titular, 'José Ángel Muñoz');
  });
});

describe('listarFacturas', () => {
  test('responde 400 si el estado no es PENDIENTE ni PAGADA', () => {
    const res = ejecutar(listarFacturas, { query: { estado: 'VENCIDA' } });
    assert.equal(res.codigo, 400);
  });

  test('lista las 6 facturas de ejemplo cuando no hay filtro', () => {
    const res = ejecutar(listarFacturas, { query: {} });
    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.total, 6);
  });

  test('filtra por estado PAGADA después de un pago', () => {
    ejecutar(pagarFactura, { params: { id: '1' }, body: { valor: 48500, metodoPago: 'PSE' } });

    const pagadas = ejecutar(listarFacturas, { query: { estado: 'PAGADA' } });
    const pendientes = ejecutar(listarFacturas, { query: { estado: 'PENDIENTE' } });
    assert.equal(pagadas.cuerpo.total, 1);
    assert.equal(pendientes.cuerpo.total, 5);
  });
});

describe('listarQuejas', () => {
  test('responde 400 si el estado no es RADICADA, EN_TRAMITE o RESUELTA', () => {
    const res = ejecutar(listarQuejas, { query: { estado: 'CERRADA' } });
    assert.equal(res.codigo, 400);
  });

  test('devuelve total 0 cuando todavía no hay quejas', () => {
    const res = ejecutar(listarQuejas, { query: {} });
    assert.equal(res.cuerpo.total, 0);
  });

  test('filtra las quejas por estado', () => {
    const id = radicarQuejaDePrueba();
    radicarQuejaDePrueba();
    ejecutar(responderQueja, { params: { id: String(id) }, body: { estado: 'EN_TRAMITE' } });

    const enTramite = ejecutar(listarQuejas, { query: { estado: 'EN_TRAMITE' } });
    const radicadas = ejecutar(listarQuejas, { query: { estado: 'RADICADA' } });
    assert.equal(enTramite.cuerpo.total, 1);
    assert.equal(radicadas.cuerpo.total, 1);
  });
});

describe('responderQueja', () => {
  test('responde 400 si el id de la queja no es válido', () => {
    const res = ejecutar(responderQueja, { params: { id: 'abc' }, body: { estado: 'EN_TRAMITE' } });
    assert.equal(res.codigo, 400);
  });

  test('responde 400 si el estado no es EN_TRAMITE ni RESUELTA', () => {
    const id = radicarQuejaDePrueba();
    const res = ejecutar(responderQueja, { params: { id: String(id) }, body: { estado: 'RADICADA' } });
    assert.equal(res.codigo, 400);
  });

  test('responde 400 si se marca RESUELTA sin escribir una respuesta', () => {
    const id = radicarQuejaDePrueba();
    const res = ejecutar(responderQueja, { params: { id: String(id) }, body: { estado: 'RESUELTA' } });
    assert.equal(res.codigo, 400);
  });

  test('responde 400 si la respuesta tiene menos de 5 caracteres', () => {
    const id = radicarQuejaDePrueba();
    const res = ejecutar(responderQueja, {
      params: { id: String(id) },
      body: { estado: 'RESUELTA', respuesta: 'ok' }
    });
    assert.equal(res.codigo, 400);
  });

  test('responde 404 si la queja no existe', () => {
    const res = ejecutar(responderQueja, { params: { id: '999' }, body: { estado: 'EN_TRAMITE' } });
    assert.equal(res.codigo, 404);
  });

  test('pasa la queja a EN_TRAMITE sin exigir respuesta', () => {
    const id = radicarQuejaDePrueba();
    const res = ejecutar(responderQueja, { params: { id: String(id) }, body: { estado: 'EN_TRAMITE' } });

    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.queja.estado, 'EN_TRAMITE');
    assert.equal(res.cuerpo.queja.fechaRespuesta, null);
  });

  test('resuelve la queja y guarda la respuesta y la fecha', () => {
    const id = radicarQuejaDePrueba();
    const res = ejecutar(responderQueja, {
      params: { id: String(id) },
      body: { estado: 'RESUELTA', respuesta: 'Se corrigió el cobro en su próxima factura.' }
    });

    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.queja.estado, 'RESUELTA');
    assert.equal(res.cuerpo.queja.respuesta, 'Se corrigió el cobro en su próxima factura.');
    assert.notEqual(res.cuerpo.queja.fechaRespuesta, null);
  });

  test('responde 409 si la queja ya estaba resuelta y no cambia la respuesta', () => {
    const id = radicarQuejaDePrueba();
    ejecutar(responderQueja, {
      params: { id: String(id) },
      body: { estado: 'RESUELTA', respuesta: 'Primera respuesta definitiva.' }
    });

    const segundo = ejecutar(responderQueja, {
      params: { id: String(id) },
      body: { estado: 'RESUELTA', respuesta: 'Intento de cambiar la respuesta.' }
    });
    assert.equal(segundo.codigo, 409);

    const lista = ejecutar(listarQuejas, { query: { estado: 'RESUELTA' } });
    assert.equal(lista.cuerpo.quejas[0].respuesta, 'Primera respuesta definitiva.');
  });
});

describe('obtenerResumen', () => {
  test('al empezar, todo está pendiente y no hay recaudo ni quejas', () => {
    const res = ejecutar(obtenerResumen, {});
    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo.recaudo, {
      recaudado: 0,
      pendiente: 207700,
      facturasPagadas: 0,
      facturasPendientes: 6
    });
    assert.deepEqual(res.cuerpo.quejas, { radicadas: 0, enTramite: 0, resueltas: 0 });
  });

  test('suma el recaudo después de pagar una factura', () => {
    ejecutar(pagarFactura, { params: { id: '1' }, body: { valor: 48500, metodoPago: 'PSE' } });

    const res = ejecutar(obtenerResumen, {});
    assert.equal(res.cuerpo.recaudo.recaudado, 48500);
    assert.equal(res.cuerpo.recaudo.pendiente, 207700 - 48500);
    assert.equal(res.cuerpo.recaudo.facturasPagadas, 1);
    assert.equal(res.cuerpo.recaudo.facturasPendientes, 5);
  });

  test('cuenta las quejas según su estado', () => {
    const primera = radicarQuejaDePrueba();
    const segunda = radicarQuejaDePrueba();
    radicarQuejaDePrueba();
    ejecutar(responderQueja, { params: { id: String(primera) }, body: { estado: 'EN_TRAMITE' } });
    ejecutar(responderQueja, {
      params: { id: String(segunda) },
      body: { estado: 'RESUELTA', respuesta: 'Caso resuelto correctamente.' }
    });

    const res = ejecutar(obtenerResumen, {});
    assert.deepEqual(res.cuerpo.quejas, { radicadas: 1, enTramite: 1, resueltas: 1 });
  });
});
