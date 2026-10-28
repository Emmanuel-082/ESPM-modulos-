/**
 * pagos.test.js
 * Pruebas unitarias del módulo 1: pago de facturas (pagosController.js).
 *
 * Cómo se lee una prueba:
 *   describe(...)  agrupa pruebas de una misma función.
 *   test(...)      es una prueba: dice qué debería pasar.
 *   assert...      compara lo que pasó con lo que se esperaba.
 *
 * Datos de ejemplo que crea db.js: la cuenta 1001 tiene 3 facturas
 * (ids 1, 2 y 3, por $48.500, $21.300 y $17.800), la 1002 tiene 2 y la 1003 tiene 1.
 */

'use strict';

const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { db, limpiarDatos, ejecutar } = require('./helpers');
const {
  consultarFacturas,
  pagarFactura,
  consultarRecibo,
  listarPagos,
  generarReferencia
} = require('../src/controllers/pagosController');

// Antes de cada prueba dejamos la base de datos limpia
beforeEach(limpiarDatos);

describe('generarReferencia', () => {
  test('crea la referencia con el formato ESPM-AAAAMMDD-000012', () => {
    assert.match(generarReferencia(12), /^ESPM-\d{8}-000012$/);
  });

  test('rellena con ceros hasta completar 6 dígitos', () => {
    assert.match(generarReferencia(1), /-000001$/);
    assert.match(generarReferencia(123456), /-123456$/);
  });
});

describe('consultarFacturas', () => {
  test('responde 400 si no se envía el número de cuenta', () => {
    const res = ejecutar(consultarFacturas, { query: {} });
    assert.equal(res.codigo, 400);
  });

  test('responde 400 si el número de cuenta son solo espacios', () => {
    const res = ejecutar(consultarFacturas, { query: { cuenta: '   ' } });
    assert.equal(res.codigo, 400);
  });

  test('responde 400 si el estado no es PENDIENTE ni PAGADA', () => {
    const res = ejecutar(consultarFacturas, { query: { cuenta: '1001', estado: 'ANULADA' } });
    assert.equal(res.codigo, 400);
  });

  test('responde 404 si la cuenta no tiene facturas', () => {
    const res = ejecutar(consultarFacturas, { query: { cuenta: '9999' } });
    assert.equal(res.codigo, 404);
  });

  test('devuelve las 3 facturas de la cuenta 1001 y el total pendiente', () => {
    const res = ejecutar(consultarFacturas, { query: { cuenta: '1001' } });
    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.facturas.length, 3);
    assert.equal(res.cuerpo.totalPendiente, 48500 + 21300 + 17800);
  });

  test('entrega cada factura con los nombres en camelCase', () => {
    const res = ejecutar(consultarFacturas, { query: { cuenta: '1003' } });
    const factura = res.cuerpo.facturas[0];
    assert.equal(factura.numeroCuenta, '1003');
    assert.equal(factura.servicio, 'Acueducto');
    assert.equal(factura.valor, 39900);
    assert.equal(factura.fechaVencimiento, '2026-11-10');
    assert.equal(factura.estado, 'PENDIENTE');
  });

  test('el filtro de estado no distingue mayúsculas de minúsculas', () => {
    const res = ejecutar(consultarFacturas, { query: { cuenta: '1001', estado: 'pendiente' } });
    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.facturas.length, 3);
  });

  test('responde 404 al pedir las facturas PAGADA si todavía no hay ninguna', () => {
    const res = ejecutar(consultarFacturas, { query: { cuenta: '1001', estado: 'PAGADA' } });
    assert.equal(res.codigo, 404);
  });

  test('después de un pago, el total pendiente baja', () => {
    ejecutar(pagarFactura, { params: { id: '1' }, body: { valor: 48500, metodoPago: 'PSE' } });
    const res = ejecutar(consultarFacturas, { query: { cuenta: '1001' } });
    assert.equal(res.cuerpo.totalPendiente, 21300 + 17800);
  });
});

describe('pagarFactura', () => {
  test('responde 400 si el id de la factura no es un número', () => {
    const res = ejecutar(pagarFactura, { params: { id: 'abc' }, body: { valor: 48500, metodoPago: 'PSE' } });
    assert.equal(res.codigo, 400);
  });

  test('responde 400 si el id de la factura es cero o negativo', () => {
    const conCero = ejecutar(pagarFactura, { params: { id: '0' }, body: { valor: 48500, metodoPago: 'PSE' } });
    const negativo = ejecutar(pagarFactura, { params: { id: '-3' }, body: { valor: 48500, metodoPago: 'PSE' } });
    assert.equal(conCero.codigo, 400);
    assert.equal(negativo.codigo, 400);
  });

  test('responde 400 si el método de pago no está permitido', () => {
    const res = ejecutar(pagarFactura, { params: { id: '1' }, body: { valor: 48500, metodoPago: 'BITCOIN' } });
    assert.equal(res.codigo, 400);
    assert.match(res.cuerpo.error, /PSE, TARJETA, EFECTIVO/);
  });

  test('responde 400 si no se envía el método de pago', () => {
    const res = ejecutar(pagarFactura, { params: { id: '1' }, body: { valor: 48500 } });
    assert.equal(res.codigo, 400);
  });

  test('responde 404 si la factura no existe', () => {
    const res = ejecutar(pagarFactura, { params: { id: '999' }, body: { valor: 48500, metodoPago: 'PSE' } });
    assert.equal(res.codigo, 404);
  });

  test('responde 400 si el valor no es igual al de la factura y no la marca como pagada', () => {
    const res = ejecutar(pagarFactura, { params: { id: '1' }, body: { valor: 1000, metodoPago: 'PSE' } });
    assert.equal(res.codigo, 400);
    assert.match(res.cuerpo.error, /48500/);

    const factura = db.prepare('SELECT estado FROM facturas WHERE id = 1').get();
    assert.equal(factura.estado, 'PENDIENTE');
  });

  test('responde 400 si no se envía el valor', () => {
    const res = ejecutar(pagarFactura, { params: { id: '1' }, body: { metodoPago: 'PSE' } });
    assert.equal(res.codigo, 400);
  });

  test('registra el pago, responde 201 y devuelve el recibo', () => {
    const res = ejecutar(pagarFactura, { params: { id: '1' }, body: { valor: 48500, metodoPago: 'PSE' } });
    assert.equal(res.codigo, 201);

    const recibo = res.cuerpo.recibo;
    assert.equal(recibo.valorPagado, 48500);
    assert.equal(recibo.metodoPago, 'PSE');
    assert.match(recibo.referencia, /^ESPM-\d{8}-\d{6}$/);
    assert.equal(recibo.factura.id, 1);
    assert.equal(recibo.factura.numeroCuenta, '1001');
    assert.equal(recibo.factura.titular, 'María Fernanda Rojas');
  });

  test('cambia el estado de la factura a PAGADA en la base de datos', () => {
    ejecutar(pagarFactura, { params: { id: '2' }, body: { valor: 21300, metodoPago: 'TARJETA' } });
    const factura = db.prepare('SELECT estado FROM facturas WHERE id = 2').get();
    assert.equal(factura.estado, 'PAGADA');
  });

  test('acepta el método de pago en minúsculas y lo guarda en mayúsculas', () => {
    const res = ejecutar(pagarFactura, { params: { id: '3' }, body: { valor: 17800, metodoPago: 'efectivo' } });
    assert.equal(res.codigo, 201);
    assert.equal(res.cuerpo.recibo.metodoPago, 'EFECTIVO');
  });

  test('acepta el valor escrito como texto, por ejemplo "48500"', () => {
    const res = ejecutar(pagarFactura, { params: { id: '1' }, body: { valor: '48500', metodoPago: 'PSE' } });
    assert.equal(res.codigo, 201);
  });

  test('responde 409 si la factura ya estaba pagada y no crea un segundo pago', () => {
    ejecutar(pagarFactura, { params: { id: '1' }, body: { valor: 48500, metodoPago: 'PSE' } });
    const segundo = ejecutar(pagarFactura, { params: { id: '1' }, body: { valor: 48500, metodoPago: 'PSE' } });

    assert.equal(segundo.codigo, 409);
    const { total } = db.prepare('SELECT COUNT(*) AS total FROM pagos WHERE factura_id = 1').get();
    assert.equal(total, 1);
  });
});

describe('consultarRecibo', () => {
  test('responde 400 si el id del pago no es válido', () => {
    const res = ejecutar(consultarRecibo, { params: { id: 'xyz' } });
    assert.equal(res.codigo, 400);
  });

  test('responde 404 si el pago no existe', () => {
    const res = ejecutar(consultarRecibo, { params: { id: '999' } });
    assert.equal(res.codigo, 404);
  });

  test('devuelve el recibo de un pago ya realizado', () => {
    const pago = ejecutar(pagarFactura, { params: { id: '4' }, body: { valor: 62400, metodoPago: 'PSE' } });
    const idPago = pago.cuerpo.recibo.idPago;

    const res = ejecutar(consultarRecibo, { params: { id: String(idPago) } });
    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.recibo.referencia, pago.cuerpo.recibo.referencia);
    assert.equal(res.cuerpo.recibo.factura.numeroCuenta, '1002');
  });
});

describe('listarPagos', () => {
  test('responde 400 si no se envía el número de cuenta', () => {
    const res = ejecutar(listarPagos, { query: {} });
    assert.equal(res.codigo, 400);
  });

  test('devuelve una lista vacía si la cuenta no ha pagado nada', () => {
    const res = ejecutar(listarPagos, { query: { cuenta: '1001' } });
    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo.pagos, []);
  });

  test('muestra primero el pago más reciente', () => {
    ejecutar(pagarFactura, { params: { id: '1' }, body: { valor: 48500, metodoPago: 'PSE' } });
    ejecutar(pagarFactura, { params: { id: '2' }, body: { valor: 21300, metodoPago: 'PSE' } });

    const res = ejecutar(listarPagos, { query: { cuenta: '1001' } });
    assert.equal(res.cuerpo.pagos.length, 2);
    assert.equal(res.cuerpo.pagos[0].valorPagado, 21300);
    assert.equal(res.cuerpo.pagos[1].valorPagado, 48500);
  });

  test('no mezcla los pagos de otras cuentas', () => {
    ejecutar(pagarFactura, { params: { id: '6' }, body: { valor: 39900, metodoPago: 'PSE' } });
    const res = ejecutar(listarPagos, { query: { cuenta: '1001' } });
    assert.equal(res.cuerpo.pagos.length, 0);
  });
});
