/**
 * quejasRoutes.js
 * Rutas del módulo de quejas, peticiones y reclamos (PQR).
 */

'use strict';

const express = require('express');
const quejasController = require('../controllers/quejasController');

const router = express.Router();

router.post('/quejas', quejasController.radicarQueja);
router.get('/quejas', quejasController.consultarQuejas);
router.get('/quejas/:radicado', quejasController.consultarQuejaPorRadicado);

module.exports = router;
