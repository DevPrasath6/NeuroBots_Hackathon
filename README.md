# MetalliSense — AI Smelting & Voice Safety Assistant

MetalliSense is a production-grade, state-of-the-art industrial AI intelligence system for metallurgy and arc furnace smelting control. Built to optimize alloy compositions, monitor real-time thermal telemetry, prevent safety anomalies, and automate production reporting.

---

## 🚀 Key Features

### 1. Robust Production State Machine (FSM)
Smelting runs follow a strict, non-stalling state machine governed by the backend database engine:
`Standby` ➔ `Alloy Selected` ➔ `Batch Size Entered` ➔ `Recipe Calculated` ➔ `Charging` ➔ `Heating` ➔ `Melting` ➔ `Live Monitoring` ➔ `OES Sampling` ➔ `AI Correction` ➔ `Validation` ➔ `Ready to Tap` ➔ `Tapping Animation` ➔ `Batch Completed` ➔ `Report Generated` ➔ `Dashboard`.

### 2. Event-Driven AI Voice Safety Assistant
- Restricts audio output to critical safety anomalies and guided loading stages (no continuous random chatter).
- Strict alert cap: Maximum of 2 anomaly voice alerts per production cycle.
- Integrates local Web Speech API synthesis with on-screen visual warning indicators.

### 3. Dynamic Dual-Unit Calculation & Persistence
- Support for **Kilograms (kg)** and **Tonnes (t)** throughout the application.
- All internal calculations run on a high-precision canonical kg value, but UI displays both units (e.g. `1.500 tonnes (1500 kg)`).
- Persisted properties (`input_unit`, `target_mass_kg`, `display_mass`, `display_unit`) are fully synchronized in PostgreSQL.

### 4. Premium 3D Liquid Metal Hero Droplet
- An organic, breathing 3D droplet of molten chrome/liquid mercury frozen in motion.
- Driven by a custom Three.js Simplex noise vertex shader.
- Physical reflections (roughness: 0.05, metalness: 1.0, clearcoat: 1.0) reacting to dynamic furnace light sources.

---

## 🛠️ Local Development Setup

### Backend (Django REST Framework)
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a python virtual environment:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run migrations and database seeding:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   python manage.py seed_db
   ```
5. Start development server:
   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```

### Frontend (Vite + React)
1. Navigate to the `frontend` directory:
   ```bash
   cd ../frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start Vite development server:
   ```bash
   npm run dev
   ```
   *Frontend is accessible at `http://localhost:8080`.*

---

## 🌐 Production Deployment

We have preconfigured the repository configuration files to make hosting simple and automated:

### Frontend (Vercel)
- **Configuration File**: Created `frontend/vercel.json` to configure URL routing (rewrites SPA routing to prevent 404s) and proxy requests matching `/api/*` to Render.
- **How to Deploy**:
  1. Push the branch to your Git provider (GitHub/GitLab).
  2. Import the project in Vercel, setting `frontend` as the **Root Directory**.
  3. Select **Vite** as the framework preset and deploy.

### Backend (Render)
- **Configuration File**: Updated `backend/requirements.txt` to include `gunicorn`, `dj-database-url`, and `psycopg2-binary`.
- **Database Configuration**: Programmed `backend/alloy_backend/settings.py` to automatically bind database connections to your Render PostgreSQL database via the `DATABASE_URL` environment variable.
- **How to Deploy**:
  1. Create a **PostgreSQL** database on Render.
  2. Create a new **Web Service** on Render, linking it to the same Git repository.
  3. Set the build directory root to `backend`.
  4. Specify the Build Command:
     ```bash
     pip install -r requirements.txt && python manage.py migrate
     ```
  5. Specify the Start Command:
     ```bash
     gunicorn alloy_backend.wsgi:application
     ```
  6. Add the environment variable `DATABASE_URL` pointing to your Render PostgreSQL connection string.
