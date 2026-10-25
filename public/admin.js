/**
 * admin.js
 * Lógica de la pantalla del administrador: resumen, crear facturas,
 * responder quejas y ver las facturas. Usa las funciones de comun.js.
 *
 * Cada petición lleva la clave del administrador en el encabezado
 * "x-clave-admin"; el servidor la verifica con verificarAdmin.js.
 */

'use strict';

// Referencias a los elementos de la página
const formClave = document.getElementById('formClave');
const inputClave = document.getElementById('inputClave');
const mensajeClave = document.getElementById('mensajeClave');
const panelAdmin = document.getElementById('panelAdmin');
const resumen = document.getElementById('resumen');
const formFactura = document.getElementById('formFactura');
const mensajeFactura = document.getElementById('mensajeFactura');
const filtroQuejas = document.getElementById('filtroQuejas');
const mensajeQuejas = document.getElementById('mensajeQuejas');
const listaQuejasAdmin = document.getElementById('listaQuejasAdmin');
const tablaFacturasAdmin = document.getElementById('tablaFacturasAdmin');

// Clave que escribió el administrador (solo vive mientras la página está abierta)
let claveAdmin = '';

/**
 * Llama a la API del administrador agregando la clave en el encabezado.
 * @param {string} url - Dirección de la API
 * @param {string} metodo - GET, POST o PUT
 * @param {object} [cuerpo] - Datos a enviar (opcional)
 * @returns {Promise<{ok: boolean, datos: object}>} Resultado de la petición
 */
function llamarApiAdmin(url, metodo, cuerpo) {
  const opciones = {
    method: metodo,
    headers: { 'x-clave-admin': claveAdmin }
  };

  if (cuerpo) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }

  return llamarApi(url, opciones);
}

/**
 * Agrega una tarjeta con un título y una cifra al resumen.
 * @param {string} titulo - Nombre de la cifra
 * @param {string} valor - Cifra ya formateada
 */
function agregarCifra(titulo, valor) {
  const caja = document.createElement('div');
  caja.className = 'cifra';

  const numero = document.createElement('strong');
  numero.textContent = valor;
  const etiqueta = document.createElement('span');
  etiqueta.textContent = titulo;

  caja.appendChild(numero);
  caja.appendChild(etiqueta);
  resumen.appendChild(caja);
}

/** Pide el resumen general y lo dibuja. Devuelve true si la clave fue aceptada. */
async function cargarResumen() {
  const { ok, datos } = await llamarApiAdmin('/api/admin/resumen', 'GET');

  if (!ok) {
    mostrarMensaje(mensajeClave, datos.error, 'error');
    return false;
  }

  resumen.innerHTML = '';
  agregarCifra('Recaudado', formatearPesos(datos.recaudo.recaudado));
  agregarCifra('Pendiente de pago', formatearPesos(datos.recaudo.pendiente));
  agregarCifra('Facturas pagadas', String(datos.recaudo.facturasPagadas));
  agregarCifra('Facturas pendientes', String(datos.recaudo.facturasPendientes));
  agregarCifra('Quejas radicadas', String(datos.quejas.radicadas));
  agregarCifra('Quejas en trámite', String(datos.quejas.enTramite));
  agregarCifra('Quejas resueltas', String(datos.quejas.resueltas));
  return true;
}

/** Pide todas las facturas y llena la tabla. */
async function cargarFacturas() {
  const { ok, datos } = await llamarApiAdmin('/api/admin/facturas', 'GET');
  if (!ok) {
    return;
  }

  tablaFacturasAdmin.innerHTML = '';
  datos.facturas.forEach((factura) => {
    const fila = document.createElement('tr');
    fila.appendChild(crearCelda(factura.numeroCuenta));
    fila.appendChild(crearCelda(factura.titular));
    fila.appendChild(crearCelda(factura.servicio));
    fila.appendChild(crearCelda(factura.periodo));
    fila.appendChild(crearCelda(formatearPesos(factura.valor)));

    const celdaEstado = crearCelda(factura.estado);
    celdaEstado.className = factura.estado === 'PAGADA' ? 'estado-pagada' : 'estado-pendiente';
    fila.appendChild(celdaEstado);

    tablaFacturasAdmin.appendChild(fila);
  });
}

/**
 * Crea el formulario para responder una queja que aún no está resuelta.
 * @param {object} queja - Queja que se va a responder
 * @returns {HTMLFormElement} Formulario con estado, respuesta y botón
 */
function crearFormularioRespuesta(queja) {
  const formulario = document.createElement('form');
  formulario.className = 'formulario';

  const selectEstado = document.createElement('select');
  [['EN_TRAMITE', 'En trámite'], ['RESUELTA', 'Resuelta']].forEach(([valor, texto]) => {
    const opcion = document.createElement('option');
    opcion.value = valor;
    opcion.textContent = texto;
    selectEstado.appendChild(opcion);
  });

  const textoRespuesta = document.createElement('textarea');
  textoRespuesta.rows = 2;
  textoRespuesta.placeholder = 'Escriba la respuesta para el usuario';

  const boton = document.createElement('button');
  boton.type = 'submit';
  boton.textContent = 'Guardar';

  const aviso = document.createElement('p');
  aviso.className = 'mensaje';

  formulario.appendChild(selectEstado);
  formulario.appendChild(textoRespuesta);
  formulario.appendChild(boton);
  formulario.appendChild(aviso);

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const { ok, datos } = await llamarApiAdmin(`/api/admin/quejas/${queja.id}`, 'PUT', {
      estado: selectEstado.value,
      respuesta: textoRespuesta.value
    });

    if (!ok) {
      mostrarMensaje(aviso, datos.error, 'error');
      return;
    }

    await cargarQuejas();
    await cargarResumen();
  });

  return formulario;
}

/** Pide las quejas (según el filtro elegido) y las dibuja. */
async function cargarQuejas() {
  const estado = filtroQuejas.value;
  const url = estado === '' ? '/api/admin/quejas' : `/api/admin/quejas?estado=${estado}`;
  const { ok, datos } = await llamarApiAdmin(url, 'GET');

  if (!ok) {
    mostrarMensaje(mensajeQuejas, datos.error, 'error');
    return;
  }

  mostrarMensaje(mensajeQuejas, `Quejas encontradas: ${datos.total}`, '');
  listaQuejasAdmin.innerHTML = '';

  datos.quejas.forEach((queja) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'queja';

    const titulo = document.createElement('h3');
    titulo.textContent = `${queja.radicado} - ${queja.asunto}`;

    const detalle = document.createElement('p');
    detalle.textContent = `Cuenta ${queja.numeroCuenta} | ${queja.tipo} | Estado: ${queja.estado.replace('_', ' ')}`;

    const descripcion = document.createElement('p');
    descripcion.textContent = queja.descripcion;

    tarjeta.appendChild(titulo);
    tarjeta.appendChild(detalle);
    tarjeta.appendChild(descripcion);

    if (queja.estado === 'RESUELTA') {
      const respuesta = document.createElement('p');
      respuesta.className = 'respuesta';
      respuesta.textContent = `Respuesta: ${queja.respuesta}`;
      tarjeta.appendChild(respuesta);
    } else {
      tarjeta.appendChild(crearFormularioRespuesta(queja));
    }

    listaQuejasAdmin.appendChild(tarjeta);
  });
}

// Cuando el administrador escribe su clave
formClave.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  claveAdmin = inputClave.value;

  const claveAceptada = await cargarResumen();
  if (!claveAceptada) {
    panelAdmin.hidden = true;
    return;
  }

  mostrarMensaje(mensajeClave, 'Ingreso correcto.', 'exito');
  panelAdmin.hidden = false;
  await cargarQuejas();
  await cargarFacturas();
});

// Cuando el administrador crea una factura
formFactura.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const { ok, datos } = await llamarApiAdmin('/api/admin/facturas', 'POST', {
    numeroCuenta: document.getElementById('facCuenta').value.trim(),
    titular: document.getElementById('facTitular').value.trim(),
    servicio: document.getElementById('facServicio').value,
    periodo: document.getElementById('facPeriodo').value.trim(),
    valor: Number(document.getElementById('facValor').value),
    fechaVencimiento: document.getElementById('facVencimiento').value
  });

  if (!ok) {
    mostrarMensaje(mensajeFactura, datos.error, 'error');
    return;
  }

  mostrarMensaje(mensajeFactura, datos.mensaje, 'exito');
  formFactura.reset();
  await cargarFacturas();
  await cargarResumen();
});

// Cuando el administrador cambia el filtro de quejas
filtroQuejas.addEventListener('change', cargarQuejas);
