/**
 * server.js
 * Punto de entrada del software web de la ESPM.
 * Aquí se crea el servidor con Express y se conectan las rutas de los
 * tres módulos: pago de facturas, quejas (PQR) y administración.
 */

'use strict';

const path = require('path');
const express = require('express');
const pagosRoutes = require('./src/routes/pagosRoutes');
const quejasRoutes = require('./src/routes/quejasRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

const app = express();
const PUERTO = process.env.PORT || 3000;

// Permite leer los datos JSON que llegan en el cuerpo de las peticiones
app.use(express.json());

// Muestra en la consola cada petición que llega (útil para aprender)
app.use((req, res, next) => {
  console.log(`${new Date().toLocaleTimeString()} ${req.method} ${req.url}`);
  next();
});

// La carpeta "public" contiene la pantalla web (HTML, CSS y JavaScript)
app.use(express.static(path.join(__dirname, 'public')));

// Módulo 1: pago de facturas  |  Módulo 2: quejas (PQR)  |  Módulo 3: administración
app.use('/api', pagosRoutes);
app.use('/api', quejasRoutes);
app.use('/api/admin', adminRoutes);

// Si la ruta no existe, respondemos con un error claro
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

// Si el JSON enviado está mal escrito o algo falla, respondemos con error
app.use((error, req, res, next) => {
  console.error(error.message);
  const estado = error.status || 500;
  res.status(estado).json({
    error: estado === 400 ? 'El JSON enviado no es válido.' : 'Error interno del servidor.'
  });
});

// El servidor solo se enciende cuando ejecutamos "npm start".
// Si otro archivo importa este (por ejemplo las pruebas unitarias),
// no se enciende: solo se entrega la aplicación para probarla.
if (require.main === module) {
  app.listen(PUERTO, () => {
    console.log(`Módulo de pagos ESPM en http://localhost:${PUERTO}`);
  });
}

module.exports = app;
