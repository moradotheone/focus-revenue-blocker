# FocusRevenue (MVP v0) — Bloqueador de Distracciones por Meta de Facturación

Prototipo funcional **MVP v0** desarrollado a partir de las decisiones vigentes y documentos de Jorge:
- **Espacio Google Drive:** [Carpeta compartida Idea A](https://drive.google.com/drive/folders/1b-c6QCCMV52VDPs-Q7SFJeqGQEpT_BEy?usp=drive_link)
- **Ficha de Hipótesis y Validación:** Prioridad 1 (07/11/2026).
- **Estrategia de Go-to-Market:** Objetivo de 10 usuarios activos en menos de 7 días.

---

## 🎯 ¿Qué es FocusRevenue?

Una extensión de navegador (Chromium / Manifest V3) que vincula el acceso a distracciones digitales (redes sociales, streaming, foros) a una **meta económica diaria** elegida por el emprendedor.

### El bucle de compromiso:
1. **Configuras tu meta diaria:** Por ejemplo, 200 € / día.
2. **Las distracciones quedan en pausa:** Intentar entrar en Twitter/X, YouTube, Reddit o Instagram te redirige a una pantalla de enfoque que te recuerda tu progreso económico y cuánto te falta para desbloquearlas.
3. **Registras tus cobros o facturas:** Acepta cobros confirmados de Stripe/PayPal y facturas emitidas. Incorpora un simulador instantáneo de webhooks para pruebas inmediatas.
4. **Al alcanzar la meta:** Los sitios se desbloquean automáticamente.
5. **Salida de Emergencia Segura en todo momento:** Desbloqueo temporal sin coerción (5 a 20 min) registrando el motivo para atender urgencias laborales o comunicación crítica con clientes.

---

## 📦 Estructura del Proyecto

```text
focus-revenue-blocker/
├── manifest.json                  # Manifiesto Chromium V3 oficial
├── icons/                         # Iconos oficiales (16x16, 32x32, 48x48, 128x128)
│   └── generate_icons.py          # Script de generación de iconos PNG
├── src/
│   ├── background/
│   │   └── background.js          # Service worker MV3 (reglas dinámicas, alarmas de sesión)
│   ├── popup/                     # Popup rápido de la extensión
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── blocked/                   # Pantalla intersticial cuando se visita un sitio bloqueado
│   │   ├── blocked.html
│   │   ├── blocked.css
│   │   └── blocked.js
│   ├── dashboard/                 # Panel de control completo (Opciones / Pestaña completa)
│   │   ├── dashboard.html
│   │   ├── dashboard.css
│   │   └── dashboard.js
│   └── lib/
│       ├── storage.js             # Capa de almacenamiento y ciclo de fechas
│       ├── billing.js             # Motor de cálculo de ingresos, 3% fee y detección de duplicados
│       └── rules.js               # Sincronización dinámica de declarativeNetRequest
├── test-preview/                  # Entorno interactivo para probar todas las vistas en el navegador
│   ├── index.html
│   ├── preview.css
│   └── preview.js
├── pilot/
│   ├── pilot-protocol.md          # Protocolo de métricas y validación del encargo de Jorge
│   └── gtm-outreach-templates.md  # Copys de outreach orgánico y seguimiento
├── package.json                   # Scripts de ejecución y empaquetado
└── README.md                      # Esta documentación
```

---

## 🚀 Cómo Instalar y Probar en Chrome / Brave / Edge

1. Abre tu navegador Chromium y escribe en la barra de direcciones:
   ```text
   chrome://extensions   (o brave://extensions / edge://extensions)
   ```
2. Activa el interruptor **«Modo de desarrollador»** (esquina superior derecha).
3. Haz clic en el botón **«Cargar descomprimida»** (Load unpacked).
4. Selecciona la carpeta del proyecto:
   ```text
   /Users/moradotheone/.gemini/antigravity/scratch/focus-revenue-blocker
   ```
5. ¡Listo! Fija el icono en la barra de extensiones.

---

## 💻 Vista Previa Interactiva Rápida (Sin instalar)

Si deseas probar la interfaz completa (Popup, Pantalla de Bloqueo y Panel de Control) directamente en una pestaña del navegador:

```bash
cd /Users/moradotheone/.gemini/antigravity/scratch/focus-revenue-blocker
npm run preview
```
Luego abre en tu navegador: `http://localhost:3000/test-preview/`

---

## 🛡️ Alineación con las Decisiones y Restricciones de Jorge

| Requisito del Documento | Solución Implementada en el MVP v0 |
| :--- | :--- |
| **Prioridad 1 y Enfoque Extensión** | Extensión nativa Manifest V3 compatible con Chrome, Brave y Edge. |
| **Ángulo TDAH no-clínico** | Garantía explícita en la interfaz: no diagnostica, no trata patologías ni recoge datos de salud. |
| **Pagos confirmados + Facturas emitidas** | Permite registrar Stripe, PayPal y facturas emitidas con totales desglosados. |
| **Riesgo de doble conteo** | Algoritmo que detecta y alerta visualmente si una factura emitida y un cobro coinciden en monto y fecha. |
| **Salida Segura (Emergencia)** | Módulo de bypass temporal con trazabilidad de motivo (5-20 min) para evitar atrapar al usuario. |
| **Fee 3% sobre facturación** | Cálculo informativo transparente del 3% en tiempo real. |
| **Penalización optativa (H-A4)** | Módulo de penalización voluntaria con cláusula de consentimiento explícito (sin cargos bancarios reales). |
| **Objetivo 10 usuarios activos** | Pestaña de validación del piloto que evalúa la definición de activo y exporta evidencia JSON. |

---

## 🎯 Protocolo para el Piloto de 7 Días

Consulta la carpeta `pilot/` para los documentos de soporte:
- [pilot/pilot-protocol.md](pilot/pilot-protocol.md): Directrices de verificación de usuarios activos.
- [pilot/gtm-outreach-templates.md](pilot/gtm-outreach-templates.md): Plantillas de mensajes para redes propias y outreach 1-on-1.
