/**
 * integracion.test.js
 * Pruebas de integración entre los tres módulos.
 *
 * El enunciado pide desarrollar software a partir de la integración de sus
 * módulos. Estas pruebas comprueban que los módulos trabajan juntos:
 *   - lo que crea el administrador lo ve el usuario,
 *   - lo que hace el usuario lo ve el administrador.
 */

'use strict';

const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { limpiarDatos, ejecutar } = require('./helpers');
const { consultarFacturas, pagarFactura, listarPagos } = require('../src/controllers/pagosController');
const { radicarQueja, consultarQuejaPorRadicado } = require('../src/controllers/quejasController');
const {
  crearFactura,
  listarFacturas,
  listarQuejas,
  responderQueja,
  obtenerResumen
} = require('../src/controllers/adminController');

beforeEach(limpiarDatos);

describe('Integración: administración -> pagos', () => {
  test('una factura creada por el administrador aparece en la consulta del usuario', () => {
    const creada = ejecutar(crearFactura, {
      body: {
        numeroCuenta: '1004',
        titular: 'Ana Torres',
        servicio: 'Acueducto',
        periodo: '2026-10',
        valor: 45000,
        fechaVencimiento: '2026-11-10'
      }
    });
    assert.equal(creada.codigo, 201);

    const consulta = ejecutar(consultarFacturas, { query: { cuenta: '1004' } });
    assert.equal(consulta.codigo, 200);
    assert.equal(consulta.cuerpo.facturas.length, 1);
    assert.equal(consulta.cuerpo.totalPendiente, 45000);
  });

  test('el usuario puede pagar la factura que creó el administrador', () => {
    const creada = ejecutar(crearFactura, {
      body: {
        numeroCuenta: '1004',
        titular: 'Ana Torres',
        servicio: 'Aseo',
        periodo: '2026-10',
        valor: 18000,
        fechaVencimiento: '2026-11-10'
      }
    });
    const idFactura = String(creada.cuerpo.factura.id);

    const pago = ejecutar(pagarFactura, { params: { id: idFactura }, body: { valor: 18000, metodoPago: 'PSE' } });
    assert.equal(pago.codigo, 201);
  });
});

describe('Integración: pagos -> administración', () => {
  test('un pago del usuario aparece como PAGADA en el listado y en el resumen del administrador', () => {
    ejecutar(pagarFactura, { params: { id: '1' }, body: { valor: 48500, metodoPago: 'TARJETA' } });

    const pagadas = ejecutar(listarFacturas, { query: { estado: 'PAGADA' } });
    assert.equal(pagadas.cuerpo.total, 1);
    assert.equal(pagadas.cuerpo.facturas[0].id, 1);

    const resumen = ejecutar(obtenerResumen, {});
    assert.equal(resumen.cuerpo.recaudo.recaudado, 48500);
  });

  test('el historial de pagos del usuario guarda lo que el administrador ve como recaudo', () => {
    ejecutar(pagarFactura, { params: { id: '1' }, body: { valor: 48500, metodoPago: 'PSE' } });
    ejecutar(pagarFactura, { params: { id: '3' }, body: { valor: 17800, metodoPago: 'EFECTIVO' } });

    const historial = ejecutar(listarPagos, { query: { cuenta: '1001' } });
    const sumaHistorial = historial.cuerpo.pagos.reduce((suma, pago) => suma + pago.valorPagado, 0);

    const resumen = ejecutar(obtenerResumen, {});
    assert.equal(sumaHistorial, resumen.cuerpo.recaudo.recaudado);
  });
});

describe('Integración: quejas <-> administración', () => {
  test('una cuenta nueva no puede radicar quejas hasta que el administrador le crea una factura', () => {
    const cuerpoQueja = {
      numeroCuenta: '1004',
      tipo: 'PETICION',
      asunto: 'Solicitud de información',
      descripcion: 'Quisiera conocer los horarios de atención.'
    };

    const antes = ejecutar(radicarQueja, { body: cuerpoQueja });
    assert.equal(antes.codigo, 404);

    ejecutar(crearFactura, {
      body: {
        numeroCuenta: '1004',
        titular: 'Ana Torres',
        servicio: 'Acueducto',
        periodo: '2026-10',
        valor: 45000,
        fechaVencimiento: '2026-11-10'
      }
    });

    const despues = ejecutar(radicarQueja, { body: cuerpoQueja });
    assert.equal(despues.codigo, 201);
  });

  test('flujo completo: el usuario radica, el administrador responde y el usuario lee la respuesta', () => {
    // 1. El usuario radica la queja
    const radicada = ejecutar(radicarQueja, {
      body: {
        numeroCuenta: '1002',
        tipo: 'RECLAMO',
        asunto: 'Cobro de aseo repetido',
        descripcion: 'En la factura de septiembre el aseo aparece dos veces.'
      }
    });
    assert.equal(radicada.codigo, 201);
    const { id, radicado } = radicada.cuerpo.queja;

    // 2. El administrador la encuentra en su lista
    const lista = ejecutar(listarQuejas, { query: { estado: 'RADICADA' } });
    assert.equal(lista.cuerpo.quejas.some((queja) => queja.id === id), true);

    // 3. El administrador la responde
    const respuesta = ejecutar(responderQueja, {
      params: { id: String(id) },
      body: { estado: 'RESUELTA', respuesta: 'Se anuló el cobro repetido.' }
    });
    assert.equal(respuesta.codigo, 200);

    // 4. El usuario consulta por su radicado y ve la respuesta
    const consulta = ejecutar(consultarQuejaPorRadicado, { params: { radicado } });
    assert.equal(consulta.cuerpo.queja.estado, 'RESUELTA');
    assert.equal(consulta.cuerpo.queja.respuesta, 'Se anuló el cobro repetido.');
  });
});
