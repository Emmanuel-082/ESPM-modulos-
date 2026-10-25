/**
 * app.js
 * Lógica de la pantalla web: consulta las facturas, registra el pago
 * y muestra el recibo. Se comunica con la API usando fetch().
 */

'use strict';

// Referencias a los elementos de la página (se buscan una sola vez)
const formConsulta = document.getElementById('formConsulta');
const inputCuenta = document.getElementById('inputCuenta');
const mensaje = document.getElementById('mensaje');
const seccionFacturas = document.getElementById('seccionFacturas');
const tablaFacturas = document.getElementById('tablaFacturas');
const totalPendiente = document.getElementById('totalPendiente');
const seccionRecibo = document.getElementById('seccionRecibo');
const datosRecibo = document.getElementById('datosRecibo');

// Cuenta que se está consultando (para refrescar la lista después de pagar)
let cuentaActual = '';

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
 * Muestra un mensaje debajo del formulario.
 * @param {string} texto - Mensaje a mostrar
 * @param {string} tipo - 'error' o 'exito'
 */
function mostrarMensaje(texto, tipo) {
  mensaje.textContent = texto;
  mensaje.className = `mensaje ${tipo || ''}`;
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
 * Dibuja la tabla de facturas con su botón de pago.
 * @param {object} datos - Respuesta de GET /api/facturas
 */
function mostrarFacturas(datos) {
  tablaFacturas.innerHTML = '';

  datos.facturas.forEach((factura) => {
    const fila = document.createElement('tr');

    fila.appendChild(crearCelda(factura.servicio));
    fila.appendChild(crearCelda(factura.periodo));
    fila.appendChild(crearCelda(factura.fechaVencimiento));
    fila.appendChild(crearCelda(formatearPesos(factura.valor)));

    const celdaEstado = crearCelda(factura.estado);
    celdaEstado.className = factura.estado === 'PAGADA' ? 'estado-pagada' : 'estado-pendiente';
    fila.appendChild(celdaEstado);

    // Solo las facturas pendientes tienen botón "Pagar"
    const celdaAccion = document.createElement('td');
    if (factura.estado === 'PENDIENTE') {
      const select = document.createElement('select');
      ['PSE', 'TARJETA', 'EFECTIVO'].forEach((metodo) => {
        const opcion = document.createElement('option');
        opcion.value = metodo;
        opcion.textContent = metodo;
        select.appendChild(opcion);
      });

      const boton = document.createElement('button');
      boton.textContent = 'Pagar';
      boton.addEventListener('click', () => pagarFactura(factura, select.value, boton));

      celdaAccion.appendChild(select);
      celdaAccion.appendChild(boton);
    } else {
      celdaAccion.textContent = '-';
    }
    fila.appendChild(celdaAccion);

    tablaFacturas.appendChild(fila);
  });

  totalPendiente.textContent = `Total pendiente: ${formatearPesos(datos.totalPendiente)}`;
  seccionFacturas.hidden = false;
}

/**
 * Pide a la API las facturas de una cuenta y las muestra.
 * @param {string} cuenta - Número de cuenta
 */
async function consultarFacturas(cuenta) {
  try {
    const respuesta = await fetch(`/api/facturas?cuenta=${encodeURIComponent(cuenta)}`);
    const datos = await respuesta.json();

    if (!respuesta.ok) {
      seccionFacturas.hidden = true;
      mostrarMensaje(datos.error, 'error');
      return false;
    }

    mostrarFacturas(datos);
    return true;
  } catch (error) {
    mostrarMensaje('No se pudo conectar con el servidor.', 'error');
    return false;
  }
}

/**
 * Envía el pago de una factura a la API y muestra el recibo.
 * @param {object} factura - Factura que se va a pagar
 * @param {string} metodoPago - PSE, TARJETA o EFECTIVO
 * @param {HTMLButtonElement} boton - Botón pulsado (se desactiva mientras se paga)
 */
async function pagarFactura(factura, metodoPago, boton) {
  boton.disabled = true;

  try {
    const respuesta = await fetch(`/api/facturas/${factura.id}/pagar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: factura.valor, metodoPago })
    });
    const datos = await respuesta.json();

    if (!respuesta.ok) {
      mostrarMensaje(datos.error, 'error');
      boton.disabled = false;
      return;
    }

    mostrarMensaje(datos.mensaje, 'exito');
    mostrarRecibo(datos.recibo);
    await consultarFacturas(cuentaActual); // Refresca la tabla
  } catch (error) {
    mostrarMensaje('No se pudo conectar con el servidor.', 'error');
    boton.disabled = false;
  }
}

/**
 * Muestra los datos del recibo de pago.
 * @param {object} recibo - Recibo devuelto por la API
 */
function mostrarRecibo(recibo) {
  const campos = [
    ['Referencia', recibo.referencia],
    ['Fecha de pago', new Date(recibo.fechaPago).toLocaleString('es-CO')],
    ['Titular', recibo.factura.titular],
    ['Cuenta', recibo.factura.numeroCuenta],
    ['Servicio', `${recibo.factura.servicio} (${recibo.factura.periodo})`],
    ['Método de pago', recibo.metodoPago],
    ['Valor pagado', formatearPesos(recibo.valorPagado)]
  ];

  datosRecibo.innerHTML = '';
  campos.forEach(([titulo, valor]) => {
    const dt = document.createElement('dt');
    dt.textContent = titulo;
    const dd = document.createElement('dd');
    dd.textContent = valor;
    datosRecibo.appendChild(dt);
    datosRecibo.appendChild(dd);
  });

  seccionRecibo.hidden = false;
}

// Cuando el usuario envía el formulario de consulta
formConsulta.addEventListener('submit', async (evento) => {
  evento.preventDefault(); // Evita que la página se recargue
  cuentaActual = inputCuenta.value.trim();
  seccionRecibo.hidden = true;
  mostrarMensaje('', '');
  await consultarFacturas(cuentaActual);
});
