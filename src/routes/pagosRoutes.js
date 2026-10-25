/**
 * pagosRoutes.js
 * Define las direcciones (rutas) del módulo y a qué función del
 * controlador llama cada una.
 */

'use strict';

const express = require('express');
const pagosController = require('../controllers/pagosController');

const router = express.Router();

// Facturas
router.get('/facturas', pagosController.consultarFacturas);
router.post('/facturas/:id/pagar', pagosController.pagarFactura);

// Pagos y recibos
router.get('/pagos', pagosController.listarPagos);
router.get('/pagos/:id', pagosController.consultarRecibo);

module.exports = router;
