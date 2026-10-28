/**
 * helpers.js
 * Herramientas compartidas por todas las pruebas unitarias.
 *
 * Las pruebas no encienden el servidor ni usan el navegador: llaman
 * directamente a las funciones de los controladores con una petición y una
 * respuesta "falsas". Así se prueba la lógica de cada módulo por separado.
 */

'use strict';

// IMPORTANTE: esta línea debe ir antes de cargar la base de datos.
// Con NODE_ENV=test, db.js usa una base de datos temporal en memoria
// y no toca el archivo real data/espm.db.
process.env.NODE_ENV = 'test';

const db = require('../src/db');

// Número de facturas de ejemplo que crea db.js al iniciar (ids 1 a 6)
const FACTURAS_DE_EJEMPLO = 6;

/**
 * Crea una respuesta falsa que guarda el código HTTP y el cuerpo enviados.
 * @returns {object} Respuesta con las propiedades codigo y cuerpo
 */
function crearRes() {
  const res = { codigo: 200, cuerpo: undefined };

  res.status = (codigo) => {
    res.codigo = codigo;
    return res;
  };

  res.json = (cuerpo) => {
    res.cuerpo = cuerpo;
    return res;
  };

  return res;
}

/**
 * Crea una petición falsa con los datos que el controlador necesita leer.
 * @param {object} datos - params, query, body y headers (todos opcionales)
 * @returns {object} Petición falsa
 */
function crearReq({ params = {}, query = {}, body = {}, headers = {} } = {}) {
  return {
    params,
    query,
    body,
    get: (nombre) => headers[String(nombre).toLowerCase()]
  };
}

/**
 * Deja la base de datos como al principio: borra pagos, quejas y facturas
 * nuevas, y vuelve a poner PENDIENTE en las facturas de ejemplo.
 * Se llama antes de cada prueba para que no dependan unas de otras.
 */
function limpiarDatos() {
  db.exec(`
    DELETE FROM pagos;
    DELETE FROM quejas;
    DELETE FROM facturas WHERE id > ${FACTURAS_DE_EJEMPLO};
    UPDATE facturas SET estado = 'PENDIENTE';
  `);
}

/**
 * Ejecuta un controlador y devuelve la respuesta que dio.
 * @param {function} controlador - Función del controlador a probar
 * @param {object} datosPeticion - Datos para crearReq
 * @returns {object} Respuesta falsa con codigo y cuerpo
 */
function ejecutar(controlador, datosPeticion) {
  const res = crearRes();
  controlador(crearReq(datosPeticion), res);
  return res;
}

module.exports = { db, crearRes, crearReq, limpiarDatos, ejecutar };
