/**
 * adminController.js
 * Lógica del módulo de administración de la ESPM.
 * Solo lo puede usar el administrador (ver verificarAdmin.js).
 *
 * El administrador puede:
 *   - Crear facturas nuevas.
 *   - Ver todas las facturas y todas las quejas.
 *   - Responder quejas y cambiar su estado.
 *   - Ver un resumen general (recaudo, facturas y quejas).
 */

'use strict';

const db = require('../db');
const { formatearFactura } = require('./pagosController');
const { formatearQueja } = require('./quejasController');

// Servicios que presta la ESPM
const SERVICIOS = ['Acueducto', 'Alcantarillado', 'Aseo'];

// Estados a los que el administrador puede pasar una queja
const ESTADOS_QUEJA_ADMIN = ['EN_TRAMITE', 'RESUELTA'];

// Largo mínimo de la respuesta a una queja
const LARGO_MINIMO_RESPUESTA = 5;

/**
 * Revisa que un texto tenga formato de fecha AAAA-MM-DD y que la fecha exista.
 * @param {string} texto - Texto a revisar
 * @returns {boolean} true si es una fecha válida
 */
function esFechaValida(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return false;
  }
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

/**
 * POST /api/admin/facturas
 * Cuerpo (JSON): { "numeroCuenta": "1004", "titular": "Ana Torres",
 *   "servicio": "Acueducto", "periodo": "2026-10", "valor": 45000,
 *   "fechaVencimiento": "2026-11-10" }
 * Crea una factura nueva con estado PENDIENTE.
 */
function crearFactura(req, res) {
  const { numeroCuenta, titular, servicio, periodo, valor, fechaVencimiento } = req.body || {};

  const cuenta = String(numeroCuenta || '').trim();
  const nombre = String(titular || '').trim();
  const periodoLimpio = String(periodo || '').trim();
  const vencimiento = String(fechaVencimiento || '').trim();

  // Buscamos el servicio ignorando mayúsculas/minúsculas ("aseo" -> "Aseo")
  const servicioValido = SERVICIOS.find(
    (nombreServicio) => nombreServicio.toLowerCase() === String(servicio || '').trim().toLowerCase()
  );

  if (cuenta === '' || nombre === '') {
    return res.status(400).json({ error: 'El número de cuenta y el titular son obligatorios.' });
  }

  if (!servicioValido) {
    return res.status(400).json({ error: `El servicio debe ser uno de: ${SERVICIOS.join(', ')}.` });
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodoLimpio)) {
    return res.status(400).json({ error: 'El periodo debe tener el formato AAAA-MM (ejemplo: 2026-10).' });
  }

  if (!Number.isInteger(Number(valor)) || Number(valor) <= 0) {
    return res.status(400).json({ error: 'El valor debe ser un número entero mayor que cero.' });
  }

  if (!esFechaValida(vencimiento)) {
    return res.status(400).json({ error: 'La fecha de vencimiento debe tener el formato AAAA-MM-DD.' });
  }

  // Evitamos duplicar la misma factura (misma cuenta, servicio y periodo)
  const duplicada = db
    .prepare('SELECT id FROM facturas WHERE numero_cuenta = ? AND servicio = ? AND periodo = ?')
    .get(cuenta, servicioValido, periodoLimpio);
  if (duplicada) {
    return res.status(409).json({ error: 'Ya existe una factura de ese servicio y periodo para la cuenta.' });
  }

  const resultado = db
    .prepare(`
      INSERT INTO facturas (numero_cuenta, titular, servicio, periodo, valor, fecha_vencimiento)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(cuenta, nombre, servicioValido, periodoLimpio, Number(valor), vencimiento);

  const fila = db
    .prepare('SELECT * FROM facturas WHERE id = ?')
    .get(Number(resultado.lastInsertRowid));

  return res.status(201).json({
    mensaje: 'Factura creada correctamente.',
    factura: formatearFactura(fila)
  });
}

/**
 * GET /api/admin/facturas[?estado=PENDIENTE|PAGADA]
 * Lista todas las facturas del sistema.
 */
function listarFacturas(req, res) {
  const estado = String(req.query.estado || '').trim().toUpperCase();

  if (estado !== '' && estado !== 'PENDIENTE' && estado !== 'PAGADA') {
    return res.status(400).json({ error: 'El estado debe ser PENDIENTE o PAGADA.' });
  }

  const filas =
    estado === ''
      ? db.prepare('SELECT * FROM facturas ORDER BY id DESC').all()
      : db.prepare('SELECT * FROM facturas WHERE estado = ? ORDER BY id DESC').all(estado);

  return res.json({ total: filas.length, facturas: filas.map(formatearFactura) });
}

/**
 * GET /api/admin/quejas[?estado=RADICADA|EN_TRAMITE|RESUELTA]
 * Lista todas las quejas del sistema.
 */
function listarQuejas(req, res) {
  const estado = String(req.query.estado || '').trim().toUpperCase();
  const estadosPermitidos = ['RADICADA', 'EN_TRAMITE', 'RESUELTA'];

  if (estado !== '' && !estadosPermitidos.includes(estado)) {
    return res.status(400).json({ error: `El estado debe ser uno de: ${estadosPermitidos.join(', ')}.` });
  }

  const filas =
    estado === ''
      ? db.prepare('SELECT * FROM quejas ORDER BY id DESC').all()
      : db.prepare('SELECT * FROM quejas WHERE estado = ? ORDER BY id DESC').all(estado);

  return res.json({ total: filas.length, quejas: filas.map(formatearQueja) });
}

/**
 * PUT /api/admin/quejas/:id
 * Cuerpo (JSON): { "estado": "RESUELTA", "respuesta": "Texto de la respuesta" }
 * Cambia el estado de una queja. Para marcarla RESUELTA se exige una respuesta.
 */
function responderQueja(req, res) {
  const idQueja = Number(req.params.id);
  const { estado, respuesta } = req.body || {};

  const estadoNuevo = String(estado || '').trim().toUpperCase();
  const respuestaLimpia = String(respuesta || '').trim();

  if (!Number.isInteger(idQueja) || idQueja <= 0) {
    return res.status(400).json({ error: 'El id de la queja no es válido.' });
  }

  if (!ESTADOS_QUEJA_ADMIN.includes(estadoNuevo)) {
    return res.status(400).json({ error: `El estado debe ser uno de: ${ESTADOS_QUEJA_ADMIN.join(', ')}.` });
  }

  if (estadoNuevo === 'RESUELTA' && respuestaLimpia.length < LARGO_MINIMO_RESPUESTA) {
    return res.status(400).json({ error: 'Para resolver la queja debe escribir una respuesta.' });
  }

  const queja = db.prepare('SELECT * FROM quejas WHERE id = ?').get(idQueja);
  if (!queja) {
    return res.status(404).json({ error: 'La queja no existe.' });
  }

  // Una queja resuelta ya no se puede modificar
  if (queja.estado === 'RESUELTA') {
    return res.status(409).json({ error: 'La queja ya fue resuelta y no se puede modificar.' });
  }

  const fechaRespuesta = estadoNuevo === 'RESUELTA' ? new Date().toISOString() : null;

  db.prepare('UPDATE quejas SET estado = ?, respuesta = ?, fecha_respuesta = ? WHERE id = ?')
    .run(estadoNuevo, respuestaLimpia === '' ? null : respuestaLimpia, fechaRespuesta, idQueja);

  const actualizada = db.prepare('SELECT * FROM quejas WHERE id = ?').get(idQueja);

  return res.json({ mensaje: 'Queja actualizada correctamente.', queja: formatearQueja(actualizada) });
}

/**
 * GET /api/admin/resumen
 * Devuelve cifras generales: dinero recaudado, dinero pendiente,
 * cantidad de facturas y cantidad de quejas por estado.
 */
function obtenerResumen(req, res) {
  const dinero = db
    .prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN estado = 'PAGADA'    THEN valor END), 0) AS recaudado,
        COALESCE(SUM(CASE WHEN estado = 'PENDIENTE' THEN valor END), 0) AS pendiente,
        COALESCE(SUM(CASE WHEN estado = 'PAGADA'    THEN 1 END), 0)     AS facturasPagadas,
        COALESCE(SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 END), 0)     AS facturasPendientes
      FROM facturas
    `)
    .get();

  const quejas = db
    .prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN estado = 'RADICADA'   THEN 1 END), 0) AS radicadas,
        COALESCE(SUM(CASE WHEN estado = 'EN_TRAMITE' THEN 1 END), 0) AS enTramite,
        COALESCE(SUM(CASE WHEN estado = 'RESUELTA'   THEN 1 END), 0) AS resueltas
      FROM quejas
    `)
    .get();

  return res.json({
    recaudo: {
      recaudado: Number(dinero.recaudado),
      pendiente: Number(dinero.pendiente),
      facturasPagadas: Number(dinero.facturasPagadas),
      facturasPendientes: Number(dinero.facturasPendientes)
    },
    quejas: {
      radicadas: Number(quejas.radicadas),
      enTramite: Number(quejas.enTramite),
      resueltas: Number(quejas.resueltas)
    }
  });
}

module.exports = {
  crearFactura,
  listarFacturas,
  listarQuejas,
  responderQueja,
  obtenerResumen,
  esFechaValida
};
