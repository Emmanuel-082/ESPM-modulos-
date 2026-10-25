# Software web ESPM Moniquirá - Módulos de pagos, quejas y administración

Evidencia GA7-220501096-AA3-EV01. Codificación de módulos del software web.

## Qué hace el software

Es una parte de la web de la Empresa de Servicios Públicos de Moniquirá. Tiene dos tipos de usuario: el usuario de la empresa, que paga sus facturas y radica quejas, y el administrador, que gestiona las facturas y responde las quejas. El trabajo se dividió en tres módulos.

## Los tres módulos

**Módulo 1. Pago de facturas.** El usuario consulta las facturas de su cuenta, paga una factura pendiente (PSE, tarjeta o efectivo) y recibe un recibo con referencia única. Pantalla: `index.html`.

**Módulo 2. Quejas, peticiones y reclamos (PQR).** El usuario radica una solicitud y recibe un número de radicado. Después puede consultar en qué estado está y leer la respuesta del administrador. Pantalla: `quejas.html`.

**Módulo 3. Administración.** El administrador entra con una clave y puede crear facturas, ver todas las facturas, responder quejas (en trámite o resuelta) y ver un resumen con el dinero recaudado y el estado de las quejas. Pantalla: `admin.html`.

Los módulos se conectan entre sí: una factura creada por el administrador aparece en el módulo de pagos, y la respuesta del administrador a una queja aparece en la consulta del usuario.

## Tecnologías usadas

El framework es Express (Node.js), que se encarga de recibir las peticiones y responderlas. Los datos se guardan en SQLite mediante la librería better-sqlite3. Las pantallas están hechas con HTML, CSS y JavaScript.

## Estructura de carpetas

```
espm-pagos/
  server.js                            Arranca el servidor y conecta los módulos
  package.json                         Lista de librerías del proyecto
  src/db.js                            Base de datos, tablas y datos de ejemplo
  src/middlewares/verificarAdmin.js    Pide la clave del administrador
  src/routes/pagosRoutes.js            Rutas del módulo 1
  src/routes/quejasRoutes.js           Rutas del módulo 2
  src/routes/adminRoutes.js            Rutas del módulo 3
  src/controllers/pagosController.js   Lógica y validaciones del módulo 1
  src/controllers/quejasController.js  Lógica y validaciones del módulo 2
  src/controllers/adminController.js   Lógica y validaciones del módulo 3
  public/index.html, app.js            Pantalla del módulo 1
  public/quejas.html, quejas.js        Pantalla del módulo 2
  public/admin.html, admin.js          Pantalla del módulo 3
  public/comun.js                      Funciones compartidas
  public/estilos.css                   Apariencia
```

## Cómo ejecutarlo paso a paso

Necesita tener instalado Node.js (versión 18 o superior). Para comprobarlo, abra una terminal y escriba `node -v`.

1. Descomprima la carpeta y abra una terminal dentro de ella.
2. Escriba `npm install` y presione Enter. Esto descarga Express y better-sqlite3 (crea la carpeta node_modules).
3. Escriba `npm start` y presione Enter.
4. Cuando la terminal diga "Módulo de pagos ESPM en http://localhost:3000", abra esa dirección en el navegador.

En Windows PowerShell, si aparece el error de que la ejecución de scripts está deshabilitada, use `npm.cmd install` y `npm.cmd start`.

Las cuentas de ejemplo son 1001, 1002 y 1003. La clave de prueba del administrador es `admin123`; se puede cambiar con la variable de entorno `CLAVE_ADMIN`. Para volver a empezar con datos nuevos, detenga el servidor (Ctrl + C), borre la carpeta `data` y ejecute `npm start` otra vez.

## Servicios de la API

**Módulo 1: pagos**

| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | /api/facturas?cuenta=1001 | Lista las facturas de una cuenta |
| POST | /api/facturas/:id/pagar | Paga una factura (cuerpo: valor y metodoPago) |
| GET | /api/pagos?cuenta=1001 | Historial de pagos de una cuenta |
| GET | /api/pagos/:id | Recibo de un pago |

**Módulo 2: quejas**

| Método | Ruta | Qué hace |
|--------|------|----------|
| POST | /api/quejas | Radica una queja (cuerpo: numeroCuenta, tipo, asunto, descripcion) |
| GET | /api/quejas?cuenta=1001 | Lista las quejas de una cuenta |
| GET | /api/quejas/:radicado | Consulta una queja por su radicado |

**Módulo 3: administración** (todas exigen el encabezado `x-clave-admin`)

| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | /api/admin/resumen | Recaudo, facturas y quejas por estado |
| GET | /api/admin/facturas | Lista todas las facturas |
| POST | /api/admin/facturas | Crea una factura nueva |
| GET | /api/admin/quejas | Lista todas las quejas (filtro opcional por estado) |
| PUT | /api/admin/quejas/:id | Cambia el estado de una queja y escribe la respuesta |

Ejemplo de cuerpo para pagar la factura 1:

```json
{ "valor": 48500, "metodoPago": "PSE" }
```

Ejemplo de cuerpo para radicar una queja:

```json
{ "numeroCuenta": "1001", "tipo": "QUEJA", "asunto": "Cobro incorrecto", "descripcion": "Me cobraron el aseo dos veces." }
```

## Validaciones

En el módulo 1 se verifica que el id sea válido, que el método de pago sea permitido, que la factura exista, que no esté pagada y que el valor enviado sea igual al de la factura.

En el módulo 2 se verifica que la cuenta exista, que el tipo sea PETICION, QUEJA o RECLAMO, y que el asunto y la descripción tengan un largo razonable.

En el módulo 3 se verifica la clave del administrador, que el servicio sea Acueducto, Alcantarillado o Aseo, que el periodo tenga formato AAAA-MM, que el valor sea un entero positivo, que la fecha exista y que la factura no esté repetida. Una queja resuelta ya no se puede modificar.

Cada fallo responde con un código HTTP (400, 401, 404 o 409) y un mensaje claro.

## Estándar de codificación

- Nombres de variables y funciones en camelCase (por ejemplo `numeroCuenta`, `pagarFactura`).
- Constantes en MAYÚSCULAS con guiones bajos (por ejemplo `METODOS_DE_PAGO`).
- Sangría de 2 espacios, comillas simples y punto y coma al final de cada instrucción.
- Uso de `const` y `let`, nunca `var`.
- Un comentario de bloque al inicio de cada archivo y de cada función explicando qué hace, qué recibe y qué devuelve.
- Código organizado por capas: rutas, controlador y base de datos, con un archivo por módulo en cada capa.

## Versionamiento con Git

```
git init
git add .
git commit -m "Módulos de pagos, quejas y administración de la ESPM"
git branch -M main
git remote add origin URL_DE_SU_REPOSITORIO
git push -u origin main
```
