# 🍔 Frontend - Pedidos360 (Arquitectura Cloud-Native)

Este repositorio contiene la capa de presentación (Frontend) para el sistema **Pedidos360**. El proyecto ha sido refactorizado hacia un modelo **Cloud-Native de Microservicios Multi-Nube**.

## 🏗️ Arquitectura y Tecnologías

* **Framework:** React + Vite (Frontend SPA puro).
* **Enrutamiento:** `react-router-dom` para el manejo de páginas (Single Page Application).
* **Estado Global:** Context API (`CartContext`) para persistencia del pedido entre rutas.
* **Gestión de Identidad (IDaaS):** Integración con **Microsoft Entra ID (Azure AD)** utilizando el flujo `OAuth 2.0 / OIDC con PKCE`.
* **Seguridad Perimetral:** Envío de Tokens JWT adjuntos de forma silenciosa en las cabeceras HTTP hacia **AWS API Gateway**.
* **Integración API:** Uso de `Axios` con interceptores globales para centralizar la lógica de autorización.

## 🗺️ Estructura de Navegación

La aplicación está dividida en 3 vistas principales, aplicando seguridad de rutas:

1. **`/` (Login):** Puerta de entrada. Delega la autenticación a Microsoft. Si el usuario ya posee un token válido, es redirigido automáticamente.
2. **`/menu` (Catálogo):** Vista protegida donde el cliente interactúa con el Microservicio de Productos (vía API Gateway). Los ítems se guardan en el contexto global del carrito.
3. **`/checkout` (Pago):** Resumen del pedido. Al presionar "Pagar", se dispara una petición `POST` al Microservicio de Carrito. El interceptor inyecta el Token JWT de Azure para que el API Gateway valide la transacción.

## 🚀 Requisitos Previos

Antes de ejecutar este proyecto, asegúrate de tener:
1. **Node.js** (v18 o superior) instalado en tu sistema.
2. Un tenant activo en **Microsoft Azure (Entra ID)** con una Aplicación (SPA) registrada.
3. Las URLs de despliegue de tus microservicios detrás del **AWS API Gateway**.

## ⚙️ Configuración del Proyecto

1. **Clonar el repositorio y entrar a la carpeta:**
   ```bash
   git clone https://github.com/tu-usuario/pedidos360-frontend.git
   cd pedidos360-frontend
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar Variables de Entorno:**
   Crea un archivo llamado `.env` en la raíz del proyecto y agrega las siguientes variables de tu infraestructura en la nube:
   ```env
   # Credenciales de Azure AD (Tenant e ID de aplicación)
   VITE_AZURE_CLIENT_ID="tu-client-id-de-azure"
   VITE_AZURE_TENANT_ID="common" # O tu ID de Tenant específico

   # URL perimetral de tu AWS API Gateway
   VITE_AWS_API_GATEWAY_URL="https://tu-api-id.execute-api.us-east-1.amazonaws.com/prod"
   ```

4. **Levantar servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   *La aplicación estará disponible típicamente en `http://localhost:5173/`.*

## 🔒 Flujo de Seguridad (Target Architecture)

1. Para ingresar al menú, el usuario debe hacer clic en "Login". MSAL interceptará esto y abrirá el flujo de autorización contra **Azure AD**.
2. Al obtener éxito, Azure devuelve un Token JWT.
3. El usuario interactúa con la tienda en `/menu` y añade productos.
4. Al ir a `/checkout` y enviar el pedido, el cliente HTTP (`axiosClient.ts`) captura la solicitud hacia AWS y adjunta este Token en la cabecera `Authorization: Bearer <token>`.
5. El **API Gateway en AWS** valida la firma y emisor del token (JWKS de Azure) en el borde (Edge) rechazando peticiones ilícitas (401/403) antes de que lleguen a los contenedores/lambdas de los microservicios.

---
*Desarrollado para evaluación de Arquitectura Cloud-Native Multi-Nube.*