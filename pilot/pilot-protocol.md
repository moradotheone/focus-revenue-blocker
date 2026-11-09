# Protocolo de Validación del Piloto — FocusRevenue MVP v0

Basado en las decisiones de Jorge documentadas en Google Drive:
- **Ficha de Hipótesis y Validación:** Prioridad 1 (07/11/2026).
- **Estrategia de Go-to-Market:** Plan candidato para 10 usuarios activos en menos de 7 días.

---

## 1. Objetivo Decidido por Jorge
- **Meta cuantitativa:** 10 usuarios activos únicos antes de cumplirse 7 días desde el arranque autorizado.
- **Presupuesto:** Mínimo indispensable (0 € en publicidad; tracción orgánica por redes propias y outreach manual consentido).

## 2. Definición Operativa de «Usuario Activo»
> *«Usuario único que instala la extensión disponible, configura un objetivo y registra una sesión de uso verificable con consentimiento y datos mínimos. Registros, interesados y voluntarios no cuentan como activos.»*

El MVP v0 evalúa automáticamente estos 3 criterios:
1. `[x] Instala la extensión:` Extensión cargada en Chrome / Brave / Edge.
2. `[x] Configura meta económica:` Define un objetivo diario (ej. 150 € / 200 $).
3. `[x] Registra sesión verificable:` Registra al menos una facturación o interacción de foco con bloqueo/desbloqueo.

## 3. Salvaguardas Éticas y Legales Obligatorias
- **Ángulo no-clínico:** La referencia a dispersión / TDAH es estrictamente un ángulo comunicacional para emprendedores que necesitan facturar y se distraen. **Queda terminantemente prohibido** diagnosticar, sugerir tratamiento médico, etiquetar clínicamente a usuarios o recoger datos de salud.
- **Salida de Emergencia (Salida Segura):** El bloqueo nunca debe atrapar al usuario. La extensión incorpora un botón de emergencia para desbloqueo temporal (5 a 20 min) registrando el motivo.
- **Privacidad de Pagos:** No se almacenan números de tarjetas, cuentas bancarias ni datos personales de los clientes del emprendedor. Todos los cálculos y registros se gestionan localmente en `chrome.storage.local`.
- **Riesgo de Doble Conteo:** La extensión distingue entre cobros confirmados (Stripe/PayPal) y facturas emitidas, emitiendo una alerta visual si se detecta un posible duplicado del mismo monto el mismo día.

## 4. Trazabilidad y Recolección de Evidencia
Desde la pestaña **«🎯 Validación del Piloto»** en el panel de la extensión:
- Cada usuario del piloto puede hacer clic en **«📥 Exportar Evidencia de Uso (JSON)»**.
- El archivo generado incluye: ID anónimo de instalación, confirmación de meta configurada, número de sesiones y fecha de activación.
- El orquestador o Jorge pueden compilar estos JSONs para certificar con evidencia real la consecución de los 10 usuarios activos.
