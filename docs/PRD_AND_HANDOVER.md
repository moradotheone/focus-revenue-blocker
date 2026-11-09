# FocusRevenue — Product Requirements Document (PRD) & Handover Técnico

**Versión del Documento:** 1.0  
**Fecha:** Noviembre 2026  
**Autor:** Jorge Morado (`jorge@morado.one`)  
**Repositorio GitHub:** [https://github.com/moradotheone/focus-revenue-blocker](https://github.com/moradotheone/focus-revenue-blocker)  
**ID Carpeta Google Drive:** `1b-c6QCCMV52VDPs-Q7SFJeqGQEpT_BEy`  
**Estado del Proyecto:** MVP v0 Funcional & Validado

---

## 1. Resumen Ejecutivo y Visión

**FocusRevenue** es una extensión de navegador (Google Chrome Manifest V3) diseñada para freelancers, consultores y emprendedores de alto rendimiento (incluyendo perfiles con rasgos o diagnóstico no clínico de TDAH). 

### 1.1 El Problema Fundamental
Los profesionales independientes pierden un promedio de 2.5 a 4 horas diarias en distracciones digitales de baja fricción (Twitter/X, YouTube, Reddit, Instagram, LinkedIn, foros). Los bloqueadores convencionales (Freedom, Cold Turkey, StayFocusd) fallan sistemáticamente porque:
1. Son arbitrarios basados en tiempo (técnicas Pomodoro desconectadas del impacto comercial).
2. Son fáciles de ignorar o desinstalar sin consecuencias tangibles.
3. No alinean el bloqueo con el principal generador de dopamina y supervivencia económica: **la facturación de clientes y el cobro de ingresos**.

### 1.2 La Solución de FocusRevenue: "The Revenue Shield"
FocusRevenue bloquea por hardware y red los sitios distractores desde las 08:00 de la mañana. El escudo **SOLO se desactiva cuando el usuario acredita que ha entrado dinero real** en su negocio (meta diaria de facturación, ej. 200 € / $250).
- Se conecta vía API de solo lectura a **Stripe** y **PayPal**.
- Lee cobros en tiempo real sin tocar datos personales de los clientes.
- Desactiva el bloqueo de inmediato cuando la meta es alcanzada.
- Cuenta con un modo de **Anulación de Emergencia Ética** (salida temporal no coercitiva para no atrapar al usuario en situaciones críticas).
- Estética y UX inspiradas en los sistemas de telemetría y cabina de **SpaceX / Starlink** (HUD minimalista, oscuro, táctico).

---

## 2. Requerimientos del Producto (PRD)

### 2.1 Requerimientos Funcionales (RF)

| ID | Módulo | Descripción | Estado MVP v0 |
|---|---|---|---|
| **RF-01** | **Bloqueo a nivel de red** | Interceptar dominios distractores configurables mediante `chrome.declarativeNetRequest` (Manifest V3) antes de que se descarguen bytes. | ✅ Implementado |
| **RF-02** | **Página intersticial HUD** | Redirigir intentos de acceso a una página interna (`blocked.html`) con citas tácticas, telemetría de facturación y botón de salida. | ✅ Implementado |
| **RF-03** | **Lectura pasarela Stripe** | Consultar balance y cargos diarios (`/v1/charges?created[gte]=...`) usando Restricted API Keys de solo lectura. | ✅ Implementado |
| **RF-04** | **Lectura pasarela PayPal** | Autenticación OAuth2 Client Credentials y consulta de órdenes/capturas del día. | ✅ Implementado |
| **RF-05** | **Inyección manual de ventas** | Permitir registrar ingresos manuales (transferencias bancarias, efectivo, cheques) para autónomos no integrados en pasarelas. | ✅ Implementado |
| **RF-06** | **Detección anti-duplicados** | Validación de hash e IDs de transacción para evitar contar dos veces la misma venta al refrescar o cambiar de pasarela. | ✅ Implementado |
| **RF-07** | **Anulación de emergencia** | Bypass temporal configurable (5, 10, 20 minutos) con registro de motivo obligatorio para introspección y auto-responsabilidad. | ✅ Implementado |
| **RF-08** | **Mission Control Dashboard** | Consola centralizada con 5 pestañas operativas: Telemetría, Pasarelas & Facturación, Escudo de Bloqueo, Anulación de Emergencia y Modelo Comercial. | ✅ Implementado |
| **RF-09** | **Cobro al usuario por éxito** | Liquidación o cobro de comisión del 3% sobre los ingresos auditados mediante Stripe Checkout / Payment Links. | ⏳ Próximo Sprint (v0.2) |
| **RF-10** | **Penalización proactiva voluntaria** | Compromiso monetario (diario, semanal, mensual) fijado previamente que se liquida si no se cumple el objetivo fijado. | ⏳ Próximo Sprint (v0.2) |

### 2.2 Requerimientos No Funcionales (RNF)

1. **Privacidad y Cumplimiento Estricto (Zero-PII):**
   - Prohibido recopilar nombres de compradores, correos de clientes, números de tarjeta o direcciones de facturación.
   - Solo se registran metadatos: importe numérico, divisa, timestamp y transaction ID anonimizada.
2. **Seguridad Criptográfica Local:**
   - Las API Keys (Stripe / PayPal) residen única y exclusivamente en `chrome.storage.local` del usuario. Cero envío a servidores de terceros en el MVP v0.
3. **Compatibilidad Manifest V3:**
   - Service worker en segundo plano sin dependencias de background pages obsoletas (MV2).
   - Gestión declarativa de reglas sin latencia de navegación.
4. **Diseño No Coercitivo (Ética & Salud Mental):**
   - El sistema estimula la disciplina pero nunca ejerce control hostil ni bloquea acceso bancario, médico o legal.
   - El ángulo de TDAH/ADHD se trata estrictamente como un framework de productividad y marketing, jamás como tratamiento clínico ni diagnóstico médico.
5. **Estética SpaceX / Starlink HUD:**
   - Paleta monocromática oscura profunda (`#05070a`, `#0a0e16`), acentos en verde orbital (`#00f59b`), cian espacial (`#00e5ff`) y ámbar de alerta (`#ffb300`).
   - Tipografía monoespaciada táctica para cifras e indicadores.

---

## 3. Arquitectura del Sistema (Manifest V3)

```
+-----------------------------------------------------------------------------------+
|                            CHROME BROWSER ENVIRONMENT                             |
|                                                                                   |
|  +---------------------+        +--------------------+        +----------------+  |
|  |     Popup HUD       |        |   Mission Control  |        |  Blocked Page  |  |
|  |    (popup.html)     |        |  (dashboard.html)  |        | (blocked.html) |  |
|  +----------+----------+        +---------+----------+        +-------+--------+  |
|             |                             |                           |           |
|             +----------------------+      |      +--------------------+           |
|                                    v      v      v                                |
|                         +---------------------------------+                       |
|                         |    Librerías de Soporte (/lib)   |                       |
|                         |  - storage.js (Estado local)    |                       |
|                         |  - billing.js (Conciliación)    |                       |
|                         |  - rules.js   (declarativeNet)  |                       |
|                         |  - payments.js (Stripe/PayPal)  |                       |
|                         +----------------+----------------+                       |
|                                          |                                        |
|                                          v                                        |
|                         +---------------------------------+                       |
|                         | Background Service Worker       |                       |
|                         | (background.js)                 |                       |
|                         | - Alarma periódica (15 min)     |                       |
|                         | - Reevaluación de escudo        |                       |
|                         | - Sincronización pasarelas      |                       |
|                         +----------------+----------------+                       |
|                                          |                                        |
+------------------------------------------|----------------------------------------+
                                           | Fetch HTTPS (Restricted)
                                           v
                        +--------------------------------------+
                        |        PASARELAS EXTERNAS            |
                        | - Stripe API (api.stripe.com)        |
                        | - PayPal REST API (api-m.paypal.com) |
                        +--------------------------------------+
```

### 3.1 Estructura del Repositorio
```
focus-revenue-blocker/
├── manifest.json              # Configuración Manifest V3 y permisos
├── icons/                     # Iconografía HUD en 16, 32, 48 y 128 px
├── src/
│   ├── background/
│   │   └── background.js      # Service Worker, alarmas y reconciliador de estado
│   ├── popup/
│   │   ├── popup.html         # Ventana rápida de estado y entrada de ventas
│   │   ├── popup.css          # Estilo HUD Starlink
│   │   └── popup.js           # Lógica del popup y acciones rápidas
│   ├── blocked/
│   │   ├── blocked.html       # Pantalla de intercepción táctica
│   │   ├── blocked.css        # Estilos intersticiales
│   │   └── blocked.js         # Temporizador y bypass ético
│   ├── dashboard/
│   │   ├── dashboard.html     # Consola de Operaciones de 5 pestañas
│   │   ├── dashboard.css      # Sistema de diseño completo
│   │   └── dashboard.js       # Gestión de pasarelas, listas y telemetría
│   └── lib/
│       ├── storage.js         # Capa de persistencia chrome.storage / local
│       ├── billing.js         # Motor de cálculo y deduplicación
│       ├── rules.js           # Orquestador declarativeNetRequest
│       └── payments.js        # Clientes de API Stripe & PayPal
├── test-preview/              # Simulador en navegador sin empaquetar
├── tests/
│   ├── test_billing.js        # Tests unitarios del motor de facturación
│   └── test_payments.js       # Tests de integración de pasarelas
├── docs/                      # PRD, Handover y Landing Page Copy
│   ├── PRD_AND_HANDOVER.md
│   └── LANDING_COPY.md
├── package.json               # Configuración npm y scripts de test
└── README.md                  # Documentación principal y guía de sideloading
```

---

## 4. Handover Técnico y Operativo

### 4.1 Entorno y Requisitos
- **Node.js:** Versión 18+ (desarrollado con v22.23.1).
- **Navegadores soportados:** Google Chrome (versión 102+), Brave Browser, Microsoft Edge, Opera.
- **Git:** Repositorio en GitHub configurado con SSH/HTTPS (`moradotheone/focus-revenue-blocker`).

### 4.2 Comandos Clave

```bash
# 1. Clonar o acceder al repositorio local
cd ~/Documents/devIA/focus-revenue-blocker

# 2. Ejecutar la suite de tests unitarios
node tests/test_billing.js

# 3. Ejecutar los tests de integración de pasarelas
node tests/test_payments.js

# 4. Sincronizar cambios entre scratch y devIA (si aplica)
rsync -av --exclude='.git' /Users/moradotheone/.gemini/antigravity/scratch/focus-revenue-blocker/ /Users/moradotheone/Documents/devIA/focus-revenue-blocker/

# 5. Generar paquete ZIP para sideloading
zip -r /Users/moradotheone/Documents/devIA/focus-revenue-mvp-v0.zip . -x "*.git*" "*tests*" "*test-preview*"
```

### 4.3 Procedimiento de Instalación (Sideloading)
1. Abrir `chrome://extensions/` en Google Chrome.
2. Activar el interruptor **Modo de desarrollador** (arriba a la derecha).
3. Hacer clic en **Cargar descomprimida** (*Load unpacked*).
4. Seleccionar la carpeta: `/Users/moradotheone/Documents/devIA/focus-revenue-blocker`.
5. Anclar la extensión a la barra de herramientas para monitorizar el HUD.

---

## 5. Roadmap Inmediato y Siguientes Pasos

### Sprint 1: Motor de Monetización del Usuario (En desarrollo)
* **Cobro por Éxito (3%):**
  * Generación dinámica de sesión de **Stripe Payment Links** o **Stripe Checkout** para abonar la comisión del 3% sobre la facturación acumulada del ciclo.
  * Selector de periodicidad de facturación: diaria, semanal o mensual.
* **Penalización Proactiva (Commitment Contract):**
  * Configuración de penalización voluntaria acordada previamente (ej. 15 €, 50 € o 100 €).
  * Retención de método de pago (Stripe SetupIntent / Customer Authorization) que solo se ejecuta si el usuario termina el ciclo con la meta sin cumplir y sin anulación justificada.
* **Múltiples Pasarelas de Cobro:**
  * Conexión directa a la cuenta de Stripe del propietario del producto (Jorge Morado).
  * Soporte secundario opcional para cobro vía PayPal o Crypto/USDC para clientes internacionales.

### Sprint 2: Webhooks Serverless en Tiempo Real
* Despliegue de un micro-endpoint serverless (Cloudflare Worker o Supabase Edge Function) para recibir webhooks de Stripe y PayPal instantáneamente, eliminando la necesidad de sondeo periódico de 15 minutos.
* Notificación push a la extensión mediante Chrome Web Push o SSE.

### Sprint 3: Publicación y Crecimiento
* Preparación de assets oficiales para Chrome Web Store (capturas 1280x800, iconos promocionales, política de privacidad).
* Publicación de la Landing Page de alta conversión en Vercel / GitHub Pages utilizando el copy preparado en `docs/LANDING_COPY.md`.
* Outreach inicial a comunidad de freelancers y profesionales con TDAH en IndieHackers, Twitter/X y Reddit r/freelance.
