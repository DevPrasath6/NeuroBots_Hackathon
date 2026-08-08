# MetalliSense — Production-Grade AI Smelting & Voice Safety Assistant

MetalliSense is an advanced industrial AI intelligence platform and Digital Twin control system for metallurgy and electric arc furnace smelting. It integrates machine learning predictive models, real-time telemetry dashboards, event-driven voice guidance, and automated compliance auditing to transform high-temperature metallurgical manufacturing.

---

## 🏗️ System Architecture

MetalliSense operates on a robust, decoupled three-tier architecture designed for low-latency feedback loops and high availability:

```
┌──────────────────────────────────────────────────────────────────┐
│                   Vercel Global CDN (Frontend)                   │
│         Vite + React SPA (Three.js 3D centerpieces, Recharts)     │
└──────────────────────────────────────────────────────────────────┘
                                 │
                   (Secured REST APIs / JSON)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                 Render Web Service (Django REST API)              │
│       Finite State Machine (FSM), AI Recommendations Engine,      │
│      Statistical Ingestion & Optical Emission Spectrometry (OES)  │
└──────────────────────────────────────────────────────────────────┘
            │                                           │
            ▼                                           ▼
┌──────────────────────┐                     ┌──────────────────────┐
│  Managed PostgreSQL  │                     │     Redis Cache      │
│  State, Runs, Logs   │                     │  Celery Tasks Broker │
└──────────────────────┘                     └──────────────────────┘
```

---

## 🌟 Core Functionalities & Features

### 1. Robust Production State Machine (FSM)
MetalliSense governs furnace runs via a strict, database-driven finite state machine, completely decoupling the production lifecycle from frontend animations or transient browser sessions:
`Standby` ➔ `Alloy Selected` ➔ `Batch Size Entered` ➔ `Recipe Calculated` ➔ `Charging` ➔ `Heating` ➔ `Melting` ➔ `Live Monitoring` ➔ `OES Sampling` ➔ `AI Correction` ➔ `Validation` ➔ `Ready to Tap` ➔ `Tapping Animation` ➔ `Batch Completed` ➔ `Report Generated` ➔ `Dashboard`.

### 2. Conversational AI Metallurgist & Advisor
- Chat interface allowing operators to query alloy grades, find application recommendations (e.g., *"marine grade steel"*), and perform weight-based charge calculations.
- Performs automated inventory checks during recipe calculations and highlights stock shortages (e.g. *"Ferronickel shortage: 120 kg required, 85 kg in stock"*).

### 3. Real-Time Telemetry & Digital Twin
- **Holographic Crucible Visualizer**: Displays live crucible state, core melt temperatures, induction heating efficiency, and cooling water flow pressure.
- **Dynamic Charts**: Renders live curves of induction power consumption, temperature milestones, and thermal stability.
- **3D Molten Metal Droplet**: Floating 3D liquid chrome centerpiece driven by a custom Three.js Simplex noise shader that responds to mouse position and furnace temperatures.

### 4. Machine Learning Predictive Engine
- **Quality Score Prediction**: Estimates final alloy composition pass-probability.
- **Anomaly Detection**: Real-time warning systems monitoring temperature deviations to flag thermal runaway.
- **Resource Optimization**: Estimates heat duration (minutes) and electricity usage (kWh) before the power cycles begin.
- **Neural Network Visualizer**: Interactive rendering of active layers and nodes as data flows through the neural network.
- **Multi-Grade Learning Module**: Demonstrates training dataset convergence and error rates across Stainless Steel, Tool Steel, and Nickel Superalloys.

### 5. Spectrometer (OES) Verification & AI Trim Trimming
- Simulates an Optical Emission Spectrometry (OES) scan of the molten pool.
- Compares element concentrations (Cr, Ni, Mn, Si, C, Fe) against ASTM/ISO specifications.
- Automatically calculates precise correction trim additions (e.g., Ferrochrome or Ferrosilicon) to bring off-spec chemistry into alignment.

### 6. Dynamic Unit-Aware UI & Persistent Dual Units
- Standardized support for **Kilograms (kg)** and **Tonnes (t)**.
- Internal calculations utilize canonical kilogram values, while frontend labels, AI recommendations, charging checklists, and logs present dual units (e.g. `1.500 tonnes (1500 kg)`).
- Persisted database properties (`input_unit`, `target_mass_kg`, `display_mass`, `display_unit`) are fully synchronized.

### 7. Voice Safety Assistant
- Local Web Speech synthesis providing step-by-step charging and refinement confirmation.
- Quiet operation during normal runs; triggers alerts only when critical temperature anomalies or composition deviations occur.
- Strict limit of 2 anomaly warnings per production cycle to prevent audio alert fatigue.

### 8. Compliance Reporting & Batch History Logs
- Generates detailed, print-ready PDF Production Reports summarizing batch metadata, charge logs, temperature curves, OES validations, and AI recommendations.
- History log module allowing search, filter, and review of all completed batches.

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

### Frontend (Vercel)
- **Configuration File**: Created `frontend/vercel.json` to handle client-side routing rewrites and API proxies.
- **How to Deploy**:
  1. Link your GitHub repository to Vercel.
  2. Select `frontend` as the **Root Directory**.
  3. Choose **Vite** as the framework preset and deploy.

### Backend (Render)
- **Configuration File**: Added production requirements (`gunicorn`, `dj-database-url`, and `psycopg2-binary`) to `backend/requirements.txt`.
- **Database Configuration**: Programmed `backend/alloy_backend/settings.py` to bind database connections to Render PostgreSQL via `DATABASE_URL`.
- **How to Deploy**:
  1. Spin up a **PostgreSQL** database on Render.
  2. Create a new **Web Service** on Render, linking it to your repository.
  3. Set build directory root to `backend`.
  4. Specify Build Command:
     ```bash
     pip install -r requirements.txt && python manage.py migrate
     ```
  5. Specify Start Command:
     ```bash
     gunicorn alloy_backend.wsgi:application
     ```
  6. Add the environment variable `DATABASE_URL` pointing to your Render PostgreSQL connection string.
