/**
 * adminRoutes.js
 * Rutas del módulo de administración.
 * Todas pasan primero por verificarAdmin, que exige la clave del administrador.
 */

'use strict';

const express = require('express');
const adminController = require('../controllers/adminController');
const verificarAdmin = require('../middlewares/verificarAdmin');

const router = express.Router();

// Todas las rutas de este archivo exigen la clave de administrador
router.use(verificarAdmin);

router.get('/resumen', adminController.obtenerResumen);
router.get('/facturas', adminController.listarFacturas);
router.post('/facturas', adminController.crearFactura);
router.get('/quejas', adminController.listarQuejas);
router.put('/quejas/:id', adminController.responderQueja);

module.exports = router;
