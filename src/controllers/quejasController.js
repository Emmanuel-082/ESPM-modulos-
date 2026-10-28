/**
 * quejasController.js
 * Lógica del módulo de quejas, peticiones y reclamos (PQR).
 * El usuario radica una queja y después consulta en qué estado está.
 *
 * Estados de una queja:
 *   RADICADA   = recién enviada por el usuario
 *   EN_TRAMITE = el administrador la está revisando
 *   RESUELTA   = el administrador ya respondió
 */

'use strict';

const db = require('../db');

// Tipos de solicitud que acepta la ESPM
const TIPOS_DE_QUEJA = ['PETICION', 'QUEJA', 'RECLAMO'];

// Límites de longitud para los textos
const LARGO_MINIMO_ASUNTO = 5;
const LARGO_MAXIMO_ASUNTO = 100;
const LARGO_MINIMO_DESCRIPCION = 10;
const LARGO_MAXIMO_DESCRIPCION = 1000;

/**
 * Genera el número de radicado, por ejemplo: PQR-2026-000007
 * @param {number} idQueja - Identificador de la queja ya guardada
 * @returns {string} Número de radicado
 */
function generarRadicado(idQueja) {
  const anio = new Date().getFullYear();
  return `PQR-${anio}-${String(idQueja).padStart(6, '0')}`;
}

/**
 * Convierte una fila de la tabla quejas al estilo camelCase.
 * @param {object} fila - Fila de la tabla quejas
 * @returns {object} Queja lista para enviar al usuario
 */
function formatearQueja(fila) {
  return {
    id: fila.id,
    radicado: fila.radicado,
    numeroCuenta: fila.numero_cuenta,
    tipo: fila.tipo,
    asunto: fila.asunto,
    descripcion: fila.descripcion,
    estado: fila.estado,
    respuesta: fila.respuesta,
    fechaRadicacion: fila.fecha_radicacion,
    fechaRespuesta: fila.fecha_respuesta
  };
}

/**
 * POST /api/quejas
 * Cuerpo (JSON): { "numeroCuenta": "1001", "tipo": "QUEJA",
 *                  "asunto": "...", "descripcion": "..." }
 * Radica una nueva queja y devuelve su número de radicado.
 */
function radicarQueja(req, res) {
  const { numeroCuenta, tipo, asunto, descripcion } = req.body || {};

  const cuenta = String(numeroCuenta || '').trim();
  const tipoQueja = String(tipo || '').trim().toUpperCase();
  const asuntoLimpio = String(asunto || '').trim();
  const descripcionLimpia = String(descripcion || '').trim();

  // Validación 1: el número de cuenta es obligatorio
  if (cuenta === '') {
    return res.status(400).json({ error: 'Debe indicar el número de cuenta.' });
  }

  // Validación 2: el tipo debe ser uno de los permitidos
  if (!TIPOS_DE_QUEJA.includes(tipoQueja)) {
    return res.status(400).json({
      error: `El tipo debe ser uno de: ${TIPOS_DE_QUEJA.join(', ')}.`
    });
  }

  // Validación 3: el asunto debe tener un largo razonable
  if (asuntoLimpio.length < LARGO_MINIMO_ASUNTO || asuntoLimpio.length > LARGO_MAXIMO_ASUNTO) {
    return res.status(400).json({
      error: `El asunto debe tener entre ${LARGO_MINIMO_ASUNTO} y ${LARGO_MAXIMO_ASUNTO} caracteres.`
    });
  }

  // Validación 4: la descripción debe tener un largo razonable
  if (
    descripcionLimpia.length < LARGO_MINIMO_DESCRIPCION ||
    descripcionLimpia.length > LARGO_MAXIMO_DESCRIPCION
  ) {
    return res.status(400).json({
      error: `La descripción debe tener entre ${LARGO_MINIMO_DESCRIPCION} y ${LARGO_MAXIMO_DESCRIPCION} caracteres.`
    });
  }

  // Validación 5: la cuenta debe existir en el sistema
  const cuentaExiste = db
    .prepare('SELECT id FROM facturas WHERE numero_cuenta = ? LIMIT 1')
    .get(cuenta);
  if (!cuentaExiste) {
    return res.status(404).json({ error: 'El número de cuenta no existe.' });
  }

  // Guardamos la queja y le asignamos el radicado en una transacción
  const guardarQueja = db.transaction(() => {
    const resultado = db
      .prepare(`
        INSERT INTO quejas (radicado, numero_cuenta, tipo, asunto, descripcion, fecha_radicacion)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run('PENDIENTE', cuenta, tipoQueja, asuntoLimpio, descripcionLimpia, new Date().toISOString());

    const idQueja = Number(resultado.lastInsertRowid);
    db.prepare('UPDATE quejas SET radicado = ? WHERE id = ?')
      .run(generarRadicado(idQueja), idQueja);

    return idQueja;
  });

  const idQueja = guardarQueja();
  const fila = db.prepare('SELECT * FROM quejas WHERE id = ?').get(idQueja);

  return res.status(201).json({
    mensaje: 'Queja radicada correctamente.',
    queja: formatearQueja(fila)
  });
}

/**
 * GET /api/quejas?cuenta=1001
 * Lista las quejas de un número de cuenta (las más recientes primero).
 */
function consultarQuejas(req, res) {
  const numeroCuenta = String(req.query.cuenta || '').trim();

  if (numeroCuenta === '') {
    return res.status(400).json({ error: 'Debe enviar el número de cuenta en el parámetro "cuenta".' });
  }

  const filas = db
    .prepare('SELECT * FROM quejas WHERE numero_cuenta = ? ORDER BY id DESC')
    .all(numeroCuenta);

  return res.json({ numeroCuenta, quejas: filas.map(formatearQueja) });
}

/**
 * GET /api/quejas/:radicado
 * Consulta una queja por su número de radicado (ejemplo: PQR-2026-000001).
 */
function consultarQuejaPorRadicado(req, res) {
  const radicado = String(req.params.radicado || '').trim().toUpperCase();

  const fila = db.prepare('SELECT * FROM quejas WHERE radicado = ?').get(radicado);
  if (!fila) {
    return res.status(404).json({ error: 'No existe una queja con ese radicado.' });
  }

  return res.json({ queja: formatearQueja(fila) });
}

module.exports = {
  radicarQueja,
  consultarQuejas,
  consultarQuejaPorRadicado,
  formatearQueja,
  generarRadicado
};
