/**
 * quejas.js
 * Lógica de la pantalla de quejas: radicar una solicitud y consultar su estado.
 * Usa las funciones compartidas de comun.js.
 */

'use strict';

// Referencias a los elementos de la página
const formQueja = document.getElementById('formQueja');
const mensajeQueja = document.getElementById('mensajeQueja');
const formConsultaQuejas = document.getElementById('formConsultaQuejas');
const cuentaConsulta = document.getElementById('cuentaConsulta');
const mensajeConsulta = document.getElementById('mensajeConsulta');
const listaQuejas = document.getElementById('listaQuejas');

/**
 * Dibuja una tarjeta por cada queja encontrada.
 * @param {Array} quejas - Lista de quejas devuelta por la API
 */
function mostrarQuejas(quejas) {
  listaQuejas.innerHTML = '';

  quejas.forEach((queja) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'queja';

    const titulo = document.createElement('h3');
    titulo.textContent = `${queja.radicado} - ${queja.asunto}`;

    const estado = document.createElement('p');
    estado.textContent = `Estado: ${queja.estado.replace('_', ' ')} | Tipo: ${queja.tipo} | Radicada: ${formatearFecha(queja.fechaRadicacion)}`;
    estado.className = queja.estado === 'RESUELTA' ? 'estado-pagada' : 'estado-pendiente';

    const descripcion = document.createElement('p');
    descripcion.textContent = queja.descripcion;

    tarjeta.appendChild(titulo);
    tarjeta.appendChild(estado);
    tarjeta.appendChild(descripcion);

    // Si el administrador ya respondió, mostramos la respuesta
    if (queja.respuesta) {
      const respuesta = document.createElement('p');
      respuesta.className = 'respuesta';
      respuesta.textContent = `Respuesta (${formatearFecha(queja.fechaRespuesta)}): ${queja.respuesta}`;
      tarjeta.appendChild(respuesta);
    }

    listaQuejas.appendChild(tarjeta);
  });
}

// Cuando el usuario envía el formulario para radicar una queja
formQueja.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const cuerpo = {
    numeroCuenta: document.getElementById('cuentaQueja').value.trim(),
    tipo: document.getElementById('tipoQueja').value,
    asunto: document.getElementById('asuntoQueja').value.trim(),
    descripcion: document.getElementById('descripcionQueja').value.trim()
  };

  const { ok, datos } = await llamarApi('/api/quejas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo)
  });

  if (!ok) {
    mostrarMensaje(mensajeQueja, datos.error, 'error');
    return;
  }

  mostrarMensaje(mensajeQueja, `${datos.mensaje} Su número de radicado es ${datos.queja.radicado}.`, 'exito');
  formQueja.reset();
});

// Cuando el usuario consulta sus quejas
formConsultaQuejas.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const cuenta = cuentaConsulta.value.trim();
  const { ok, datos } = await llamarApi(`/api/quejas?cuenta=${encodeURIComponent(cuenta)}`);

  if (!ok) {
    listaQuejas.innerHTML = '';
    mostrarMensaje(mensajeConsulta, datos.error, 'error');
    return;
  }

  if (datos.quejas.length === 0) {
    listaQuejas.innerHTML = '';
    mostrarMensaje(mensajeConsulta, 'Esta cuenta no tiene solicitudes radicadas.', '');
    return;
  }

  mostrarMensaje(mensajeConsulta, `Solicitudes encontradas: ${datos.quejas.length}`, 'exito');
  mostrarQuejas(datos.quejas);
});
