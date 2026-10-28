/**
 * pagosController.js
 * Lógica del módulo de pago de facturas.
 *
 * Cada función recibe:
 *   - req: lo que envía el usuario (parámetros, cuerpo, etc.)
 *   - res: lo que le respondemos al usuario
 *
 * Códigos HTTP que usamos:
 *   200 = todo bien              201 = se creó algo nuevo (el pago)
 *   400 = datos mal enviados     404 = no se encontró lo pedido
 *   409 = conflicto (la factura ya estaba pagada)
 */

'use strict';

const db = require('../db');

// Métodos de pago que acepta la ESPM
const METODOS_DE_PAGO = ['PSE', 'TARJETA', 'EFECTIVO'];

/**
 * Genera la referencia del recibo, por ejemplo: ESPM-20261025-000012
 * @param {number} idPago - Identificador del pago ya guardado
 * @returns {string} Referencia única del pago
 */
function generarReferencia(idPago) {
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `ESPM-${fecha}-${String(idPago).padStart(6, '0')}`;
}

/**
 * Convierte una fila de la base de datos (con guiones bajos)
 * en un objeto con el estilo camelCase que usamos en JavaScript.
 * @param {object} fila - Fila de la tabla facturas
 * @returns {object} Factura lista para enviar al usuario
 */
function formatearFactura(fila) {
  return {
    id: fila.id,
    numeroCuenta: fila.numero_cuenta,
    titular: fila.titular,
    servicio: fila.servicio,
    periodo: fila.periodo,
    valor: fila.valor,
    fechaVencimiento: fila.fecha_vencimiento,
    estado: fila.estado
  };
}

/**
 * Convierte la unión de las tablas pagos + facturas en un recibo.
 * @param {object} fila - Fila resultado del JOIN entre pagos y facturas
 * @returns {object} Recibo de pago
 */
function formatearRecibo(fila) {
  return {
    idPago: fila.id,
    referencia: fila.referencia,
    fechaPago: fila.fecha_pago,
    metodoPago: fila.metodo_pago,
    valorPagado: fila.valor_pagado,
    factura: {
      id: fila.factura_id,
      numeroCuenta: fila.numero_cuenta,
      titular: fila.titular,
      servicio: fila.servicio,
      periodo: fila.periodo
    }
  };
}

/**
 * GET /api/facturas?cuenta=1001[&estado=PENDIENTE|PAGADA]
 * Consulta las facturas de un número de cuenta.
 */
function consultarFacturas(req, res) {
  const numeroCuenta = String(req.query.cuenta || '').trim();
  const estado = String(req.query.estado || '').trim().toUpperCase();

  // Validación: el número de cuenta es obligatorio
  if (numeroCuenta === '') {
    return res.status(400).json({ error: 'Debe enviar el número de cuenta en el parámetro "cuenta".' });
  }

  // Validación: si envían estado, solo puede ser PENDIENTE o PAGADA
  if (estado !== '' && estado !== 'PENDIENTE' && estado !== 'PAGADA') {
    return res.status(400).json({ error: 'El estado debe ser PENDIENTE o PAGADA.' });
  }

  let filas;
  if (estado === '') {
    filas = db
      .prepare('SELECT * FROM facturas WHERE numero_cuenta = ? ORDER BY id')
      .all(numeroCuenta);
  } else {
    filas = db
      .prepare('SELECT * FROM facturas WHERE numero_cuenta = ? AND estado = ? ORDER BY id')
      .all(numeroCuenta, estado);
  }

  if (filas.length === 0) {
    return res.status(404).json({ error: 'No se encontraron facturas para esa cuenta.' });
  }

  const facturas = filas.map(formatearFactura);
  const totalPendiente = facturas
    .filter((factura) => factura.estado === 'PENDIENTE')
    .reduce((suma, factura) => suma + factura.valor, 0);

  return res.json({ numeroCuenta, totalPendiente, facturas });
}

/**
 * POST /api/facturas/:id/pagar
 * Cuerpo (JSON): { "valor": 48500, "metodoPago": "PSE" }
 * Registra el pago de una factura y la marca como PAGADA.
 */
function pagarFactura(req, res) {
  const idFactura = Number(req.params.id);
  const { valor, metodoPago } = req.body || {};

  // Validación 1: el id de la factura debe ser un número entero positivo
  if (!Number.isInteger(idFactura) || idFactura <= 0) {
    return res.status(400).json({ error: 'El id de la factura no es válido.' });
  }

  // Validación 2: el método de pago debe ser uno de los permitidos
  const metodo = String(metodoPago || '').trim().toUpperCase();
  if (!METODOS_DE_PAGO.includes(metodo)) {
    return res.status(400).json({
      error: `El método de pago debe ser uno de: ${METODOS_DE_PAGO.join(', ')}.`
    });
  }

  // Validación 3: la factura debe existir
  const factura = db.prepare('SELECT * FROM facturas WHERE id = ?').get(idFactura);
  if (!factura) {
    return res.status(404).json({ error: 'La factura no existe.' });
  }

  // Validación 4: la factura no puede estar pagada de antes
  if (factura.estado === 'PAGADA') {
    return res.status(409).json({ error: 'La factura ya fue pagada.' });
  }

  // Validación 5: el valor enviado debe ser igual al valor de la factura
  if (Number(valor) !== factura.valor) {
    return res.status(400).json({
      error: `El valor a pagar debe ser exactamente $${factura.valor}.`
    });
  }

  // Guardamos el pago y cambiamos el estado en una sola transacción:
  // si algo falla a la mitad, no queda nada a medias.
  const registrarPago = db.transaction(() => {
    const fechaPago = new Date().toISOString();

    // Referencia temporal; se reemplaza cuando conocemos el id del pago
    const resultado = db
      .prepare(`
        INSERT INTO pagos (factura_id, valor_pagado, metodo_pago, referencia, fecha_pago)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(idFactura, factura.valor, metodo, 'PENDIENTE', fechaPago);

    const idPago = Number(resultado.lastInsertRowid);

    db.prepare('UPDATE pagos SET referencia = ? WHERE id = ?')
      .run(generarReferencia(idPago), idPago);

    db.prepare("UPDATE facturas SET estado = 'PAGADA' WHERE id = ?").run(idFactura);

    return idPago;
  });

  const idPago = registrarPago();
  const recibo = obtenerReciboPorId(idPago);

  return res.status(201).json({ mensaje: 'Pago registrado correctamente.', recibo });
}

/**
 * Busca un recibo por el id del pago.
 * @param {number} idPago - Identificador del pago
 * @returns {object|null} Recibo o null si no existe
 */
function obtenerReciboPorId(idPago) {
  const fila = db
    .prepare(`
      SELECT p.*, f.numero_cuenta, f.titular, f.servicio, f.periodo
      FROM pagos p
      INNER JOIN facturas f ON f.id = p.factura_id
      WHERE p.id = ?
    `)
    .get(idPago);

  return fila ? formatearRecibo(fila) : null;
}

/**
 * GET /api/pagos/:id
 * Devuelve el recibo de un pago.
 */
function consultarRecibo(req, res) {
  const idPago = Number(req.params.id);

  if (!Number.isInteger(idPago) || idPago <= 0) {
    return res.status(400).json({ error: 'El id del pago no es válido.' });
  }

  const recibo = obtenerReciboPorId(idPago);
  if (!recibo) {
    return res.status(404).json({ error: 'El pago no existe.' });
  }

  return res.json({ recibo });
}

/**
 * GET /api/pagos?cuenta=1001
 * Lista el historial de pagos de un número de cuenta.
 */
function listarPagos(req, res) {
  const numeroCuenta = String(req.query.cuenta || '').trim();

  if (numeroCuenta === '') {
    return res.status(400).json({ error: 'Debe enviar el número de cuenta en el parámetro "cuenta".' });
  }

  const filas = db
    .prepare(`
      SELECT p.*, f.numero_cuenta, f.titular, f.servicio, f.periodo
      FROM pagos p
      INNER JOIN facturas f ON f.id = p.factura_id
      WHERE f.numero_cuenta = ?
      ORDER BY p.id DESC
    `)
    .all(numeroCuenta);

  return res.json({ numeroCuenta, pagos: filas.map(formatearRecibo) });
}

module.exports = {
  consultarFacturas,
  pagarFactura,
  consultarRecibo,
  listarPagos,
  formatearFactura,
  generarReferencia
};
