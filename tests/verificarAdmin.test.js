/**
 * verificarAdmin.test.js
 * Pruebas unitarias del mecanismo de seguridad: el middleware verificarAdmin.
 *
 * El middleware decide si una petición puede continuar (llama a next)
 * o se detiene con un error 401 por falta de clave de administrador.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { crearReq, crearRes } = require('./helpers');
const verificarAdmin = require('../src/middlewares/verificarAdmin');

// Guardamos el valor original de la variable de entorno para devolverlo al final
const CLAVE_ORIGINAL = process.env.CLAVE_ADMIN;

beforeEach(() => {
  delete process.env.CLAVE_ADMIN;
});

afterEach(() => {
  if (CLAVE_ORIGINAL === undefined) {
    delete process.env.CLAVE_ADMIN;
  } else {
    process.env.CLAVE_ADMIN = CLAVE_ORIGINAL;
  }
});

/**
 * Ejecuta el middleware con los encabezados dados.
 * @param {object} headers - Encabezados de la petición
 * @returns {object} La respuesta falsa y si se llamó a next()
 */
function probar(headers) {
  const res = crearRes();
  let continuo = false;
  verificarAdmin(crearReq({ headers }), res, () => {
    continuo = true;
  });
  return { res, continuo };
}

describe('verificarAdmin', () => {
  test('responde 401 si la petición no trae la clave', () => {
    const { res, continuo } = probar({});
    assert.equal(res.codigo, 401);
    assert.equal(continuo, false);
  });

  test('responde 401 si la clave es incorrecta', () => {
    const { res, continuo } = probar({ 'x-clave-admin': 'clave-equivocada' });
    assert.equal(res.codigo, 401);
    assert.equal(continuo, false);
  });

  test('responde 401 si la clave viene vacía', () => {
    const { res, continuo } = probar({ 'x-clave-admin': '' });
    assert.equal(res.codigo, 401);
    assert.equal(continuo, false);
  });

  test('deja continuar con la clave de ejemplo admin123 cuando no hay CLAVE_ADMIN', () => {
    const { res, continuo } = probar({ 'x-clave-admin': 'admin123' });
    assert.equal(continuo, true);
    assert.equal(res.cuerpo, undefined);
  });

  test('distingue mayúsculas de minúsculas en la clave', () => {
    const { res, continuo } = probar({ 'x-clave-admin': 'ADMIN123' });
    assert.equal(res.codigo, 401);
    assert.equal(continuo, false);
  });

  test('si existe CLAVE_ADMIN, usa esa clave y rechaza la de ejemplo', () => {
    process.env.CLAVE_ADMIN = 'clave-segura-2026';

    const conEjemplo = probar({ 'x-clave-admin': 'admin123' });
    const conNueva = probar({ 'x-clave-admin': 'clave-segura-2026' });

    assert.equal(conEjemplo.res.codigo, 401);
    assert.equal(conEjemplo.continuo, false);
    assert.equal(conNueva.continuo, true);
  });
});
