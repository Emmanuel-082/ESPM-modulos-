/**
 * db.js
 * Conexión a la base de datos SQLite y creación de las tablas del módulo.
 *
 * SQLite guarda todo en un solo archivo (data/espm.db), por eso no hace
 * falta instalar ningún servidor de base de datos.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Carpeta y archivo donde se guarda la base de datos
const CARPETA_DATOS = path.join(__dirname, '..', 'data');
const RUTA_BASE_DATOS = path.join(CARPETA_DATOS, 'espm.db');

// Durante las pruebas unitarias (NODE_ENV=test, que Jest activa solo) usamos
// una base de datos temporal en memoria. Así las pruebas no tocan el archivo
// real data/espm.db y cada ejecución empieza con datos limpios.
const ES_PRUEBA = process.env.NODE_ENV === 'test';

// Si la carpeta "data" no existe, la creamos (no hace falta en las pruebas)
if (!ES_PRUEBA && !fs.existsSync(CARPETA_DATOS)) {
  fs.mkdirSync(CARPETA_DATOS, { recursive: true });
}

// Abrimos (o creamos) la base de datos
const db = new Database(ES_PRUEBA ? ':memory:' : RUTA_BASE_DATOS);

// Activamos las llaves foráneas para que SQLite verifique las relaciones
db.pragma('foreign_keys = ON');

/**
 * Crea las tablas si todavía no existen.
 * - facturas: lo que el usuario debe pagar.
 * - pagos: el registro de cada pago realizado (sirve como recibo).
 * - quejas: peticiones, quejas y reclamos (PQR) radicados por los usuarios.
 */
function crearTablas() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS facturas (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_cuenta     TEXT    NOT NULL,
      titular           TEXT    NOT NULL,
      servicio          TEXT    NOT NULL,
      periodo           TEXT    NOT NULL,
      valor             INTEGER NOT NULL,
      fecha_vencimiento TEXT    NOT NULL,
      estado            TEXT    NOT NULL DEFAULT 'PENDIENTE'
    );

    CREATE TABLE IF NOT EXISTS pagos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      factura_id    INTEGER NOT NULL,
      valor_pagado  INTEGER NOT NULL,
      metodo_pago   TEXT    NOT NULL,
      referencia    TEXT    NOT NULL,
      fecha_pago    TEXT    NOT NULL,
      FOREIGN KEY (factura_id) REFERENCES facturas (id)
    );

    CREATE TABLE IF NOT EXISTS quejas (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      radicado          TEXT    NOT NULL,
      numero_cuenta     TEXT    NOT NULL,
      tipo              TEXT    NOT NULL,
      asunto            TEXT    NOT NULL,
      descripcion       TEXT    NOT NULL,
      estado            TEXT    NOT NULL DEFAULT 'RADICADA',
      respuesta         TEXT,
      fecha_radicacion  TEXT    NOT NULL,
      fecha_respuesta   TEXT
    );
  `);
}

/**
 * Inserta facturas de ejemplo solo si la tabla está vacía,
 * para poder probar el módulo desde el primer momento.
 */
function cargarDatosDeEjemplo() {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM facturas').get();

  if (total > 0) {
    return; // Ya hay datos, no hacemos nada
  }

  const insertar = db.prepare(`
    INSERT INTO facturas (numero_cuenta, titular, servicio, periodo, valor, fecha_vencimiento)
    VALUES (@numeroCuenta, @titular, @servicio, @periodo, @valor, @fechaVencimiento)
  `);

  const facturasEjemplo = [
    { numeroCuenta: '1001', titular: 'María Fernanda Rojas', servicio: 'Acueducto',    periodo: '2026-09', valor: 48500, fechaVencimiento: '2026-10-10' },
    { numeroCuenta: '1001', titular: 'María Fernanda Rojas', servicio: 'Alcantarillado', periodo: '2026-09', valor: 21300, fechaVencimiento: '2026-10-10' },
    { numeroCuenta: '1001', titular: 'María Fernanda Rojas', servicio: 'Aseo',          periodo: '2026-09', valor: 17800, fechaVencimiento: '2026-10-10' },
    { numeroCuenta: '1002', titular: 'Carlos Andrés Pardo',  servicio: 'Acueducto',    periodo: '2026-09', valor: 62400, fechaVencimiento: '2026-10-10' },
    { numeroCuenta: '1002', titular: 'Carlos Andrés Pardo',  servicio: 'Aseo',          periodo: '2026-09', valor: 17800, fechaVencimiento: '2026-10-10' },
    { numeroCuenta: '1003', titular: 'Luz Marina Gómez',     servicio: 'Acueducto',    periodo: '2026-10', valor: 39900, fechaVencimiento: '2026-11-10' }
  ];

  // Una transacción guarda todas las filas juntas: o entran todas o ninguna
  const insertarTodas = db.transaction((lista) => {
    lista.forEach((factura) => insertar.run(factura));
  });

  insertarTodas(facturasEjemplo);
}

crearTablas();
cargarDatosDeEjemplo();

module.exports = db;
