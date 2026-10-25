/**
 * comun.js
 * Funciones compartidas por las pantallas de quejas y de administración.
 */

'use strict';

/**
 * Da formato de pesos colombianos a un número. Ejemplo: 48500 -> $48.500
 * @param {number} valor - Valor numérico
 * @returns {string} Texto con formato de moneda
 */
function formatearPesos(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(valor);
}

/**
 * Convierte una fecha ISO en texto legible. Si no hay fecha devuelve un guion.
 * @param {string|null} fechaIso - Fecha en formato ISO
 * @returns {string} Fecha y hora local
 */
function formatearFecha(fechaIso) {
  return fechaIso ? new Date(fechaIso).toLocaleString('es-CO') : '-';
}

/**
 * Muestra un mensaje de éxito o de error en un elemento de la página.
 * @param {HTMLElement} elemento - Párrafo donde se escribe el mensaje
 * @param {string} texto - Mensaje a mostrar
 * @param {string} tipo - 'error' o 'exito'
 */
function mostrarMensaje(elemento, texto, tipo) {
  elemento.textContent = texto;
  elemento.className = `mensaje ${tipo || ''}`;
}

/**
 * Crea una celda de tabla con un texto.
 * @param {string} texto - Contenido de la celda
 * @returns {HTMLTableCellElement} Celda creada
 */
function crearCelda(texto) {
  const celda = document.createElement('td');
  celda.textContent = texto;
  return celda;
}

/**
 * Envía una petición a la API y devuelve el resultado ya convertido de JSON.
 * @param {string} url - Dirección de la API
 * @param {object} opciones - Opciones de fetch (método, encabezados, cuerpo)
 * @returns {Promise<{ok: boolean, datos: object}>} Resultado de la petición
 */
async function llamarApi(url, opciones) {
  try {
    const respuesta = await fetch(url, opciones);
    const datos = await respuesta.json();
    return { ok: respuesta.ok, datos };
  } catch (error) {
    return { ok: false, datos: { error: 'No se pudo conectar con el servidor.' } };
  }
}
