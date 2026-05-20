# 🏗️ Reporte Diario de Obra (RDO) · Control S-Curve & EVM

Una plataforma web móvil-first híbrida diseñada para ingenieros, supervisores y capataces de construcción. Permite registrar en tiempo real el avance de obra y los costos asociados en el campo, calculando automáticamente indicadores de rendimiento bajo la metodología **EVM (Earned Value Management)** y sincronizando los datos directamente con **Google Sheets**.

---

## 🚀 La Aplicación es 100% Independiente

> [!IMPORTANT]
> **Nota de Independencia:** Este repositorio y tu aplicación local son **completamente independientes de Google AI Studio / Gemini Build**. El texto anterior en el `README.md` era simplemente una plantilla inicial de Google. Si decides eliminar o dar de baja el proyecto en la web de Google AI Studio, **esta aplicación no sufrirá absolutamente ningún inconveniente y seguirá funcionando al 100%**.

---

## 🎯 Características Principales

* **🔄 Arquitectura de Reporte Dual:** 
  * **🏗️ Modo Producción:** Registra avances físicos (EV) vinculados a códigos EDT/WBS obligatorios y costos reales (AC) de Mano de Obra, Materiales y Equipos.
  * **🛡️ Modo Seguridad e HSE:** Panel de control de sitio global independiente que recopila horas de personal total, auditorías de seguridad e incidentes sin distorsionar los datos financieros.
* **📊 Indicadores EVM en Tiempo Real:** Cálculo automático en el tablero de control de:
  * **PV** (Valor Planificado), **EV** (Valor Ganado), **AC** (Costo Real).
  * **SV** (Varianza de Plazo) y **CV** (Varianza de Costo).
  * **SPI** (Índice de Rendimiento del Plazo) y **CPI** (Índice de Rendimiento del Costo).
* **🔌 Sincronización Flexible con Google Sheets:** Interfaz de configuración integrada para ingresar tu propia **URL de Google Apps Script Web App** y enviar los datos directamente a una base de datos centralizada de 4 tablas estilizadas en la nube.
* **✍️ Captura de Firmas y Fotos en Campo:**
  * Lienzo táctil e interactivo (Canvas) para firmas digitales en sitio.
  * Soporte para adjuntar hasta 4 fotografías de avances procesadas a base64.
* **📡 Resiliencia Offline Extrema:** Copias de seguridad automáticas cada 15 segundos en `localStorage` y descarga de respaldos JSON manuales para evitar pérdida de información en zonas con nula cobertura celular.
* **🤖 Análisis con Inteligencia Artificial (Opcional):** Conexión directa a **Gemini 3.5 Flash** usando una clave API genérica para generar diagnósticos ejecutivos instantáneos de causas y planes de mitigación de obra.

---

## 💻 Ejecución en Entorno Local

### Requisitos Previos
* **Node.js** (versión 18 o superior) instalado en tu computadora.

### Instrucciones de Inicio

1. **Instalar las dependencias del proyecto:**
   ```bash
   npm install
   ```

2. **Configurar las variables de entorno:**
   Crea un archivo llamado `.env.local` en la raíz del proyecto y agrega tu clave de Gemini si deseas usar la IA:
   ```env
   GEMINI_API_KEY=tu_clave_api_aqui
   ```

3. **Correr el servidor local de desarrollo:**
   ```bash
   npm run dev
   ```
   La aplicación se abrirá automáticamente en tu navegador en `http://localhost:3000`.

---

## 🌐 Despliegue en Producción (GitHub Pages)

Este repositorio está configurado con **GitHub Actions**. Cada vez que subes un cambio a la rama `main`, la aplicación se compila y se despliega de forma automática en tu sitio web estático:

👉 **[https://aureliosrios.github.io/reporte-diario-obra/](https://aureliosrios.github.io/reporte-diario-obra/)**

*Los reportes guardados en la versión web de GitHub Pages se sincronizarán directamente con tu Google Sheets en la nube configurando tu URL de Apps Script en la pestaña "Despliegue Sheets".*
