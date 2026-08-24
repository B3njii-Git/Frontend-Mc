# 🍔 Frontend - Pedidos360 (Arquitectura Cloud-Native)

Este repositorio contiene la capa de presentación (Frontend) para el sistema **Pedidos360**. El proyecto ha sido refactorizado desde una arquitectura monolítica/autogestionada hacia un modelo **Cloud-Native de Microservicios Multi-Nube**.

## 🏗️ Arquitectura y Tecnologías

* **Framework:** React + Vite (Frontend SPA puro).
* **Gestión de Identidad (IDaaS):** Integración con **Microsoft Entra ID (Azure AD)** utilizando el flujo `OAuth 2.0 / OIDC con PKCE`.
* **Seguridad Perimetral:** Envío de Tokens JWT adjuntos de forma silenciosa en las cabeceras HTTP hacia **AWS API Gateway**.
* **Integración API:** Uso de `Axios` con interceptores globales para centralizar la lógica de autorización.

## 🚀 Requisitos Previos

Antes de ejecutar este proyecto, asegúrate de tener:
1. **Node.js** (v18 o superior) instalado en tu sistema.
2. Un tenant activo en **Microsoft Azure (Entra ID)** con una Aplicación (SPA) registrada.
3. Las URLs de despliegue de tus microservicios detrás del **AWS API Gateway**.

## ⚙️ Configuración del Proyecto

1. **Clonar el repositorio y entrar a la carpeta:**
   ```bash
   # (Reemplaza con la URL de tu repositorio de Github)
   git clone https://github.com/tu-usuario/pedidos360-frontend.git
   cd pedidos360-frontend
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar Variables de Entorno:**
   Crea un archivo llamado `.env` en la raíz del proyecto (puedes guiarte con el `.env.example` si existe) y agrega las siguientes variables de tu infraestructura en la nube:
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

1. El usuario ingresa a la aplicación de manera anónima y puede visualizar el catálogo de productos (obtenido mediante un `GET` público).
2. Para procesar un carrito, el usuario debe hacer clic en "Login". MSAL interceptará esto y abrirá el flujo de autorización contra **Azure AD**.
3. Al obtener éxito, Azure devuelve un Token JWT.
4. El cliente HTTP (`axiosClient.ts`) captura cualquier solicitud saliente hacia AWS y, mediante su interceptor `request`, adjunta este Token en la cabecera `Authorization: Bearer <token>`.
5. El **API Gateway en AWS** valida la firma y emisor del token (JWKS de Azure) en el borde (Edge) rechazando peticiones ilícitas (401/403) antes de llegar a los microservicios backend.

---
*Desarrollado para evaluación de Arquitectura Cloud-Native Multi-Nube.*