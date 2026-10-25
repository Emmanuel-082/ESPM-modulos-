/**
 * verificarAdmin.js
 * Middleware que protege las rutas del administrador.
 *
 * Un middleware es una función que se ejecuta ANTES del controlador.
 * Si la clave es correcta, llama a next() y la petición continúa.
 * Si no, responde con error 401 y la petición se detiene aquí.
 *
 * El administrador debe enviar su clave en el encabezado "x-clave-admin".
 * La clave se toma de la variable de entorno CLAVE_ADMIN; si no existe,
 * se usa la clave de ejemplo "admin123" (solo para pruebas).
 */

'use strict';

const CLAVE_POR_DEFECTO = 'admin123';

/**
 * Verifica que la petición traiga la clave de administrador correcta.
 * @param {object} req - Petición del usuario
 * @param {object} res - Respuesta
 * @param {function} next - Función que deja continuar la petición
 */
function verificarAdmin(req, res, next) {
  const claveCorrecta = process.env.CLAVE_ADMIN || CLAVE_POR_DEFECTO;
  const claveEnviada = req.get('x-clave-admin');

  if (!claveEnviada || claveEnviada !== claveCorrecta) {
    return res.status(401).json({ error: 'Clave de administrador incorrecta o ausente.' });
  }

  return next();
}

module.exports = verificarAdmin;
