# CMSCET Alloy Alchemy - Frontend & Backend Integration Guide

## Overview
This guide explains how to run the complete AI-driven Alloy Addition System with both frontend and backend integrated.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Nginx (Port 80)                    │
│              (Reverse Proxy & Static Files)          │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────────────┐      ┌─────────────────┐  │
│  │  React Frontend      │      │  Django Backend │  │
│  │  (Port 3000/8080)    │─────▶│  (Port 8000)    │  │
│  └──────────────────────┘      └─────────────────┘  │
│                                          │            │
│         ┌──────────────────────────────┴─────┐       │
│         │                                    │       │
│    ┌────▼────┐                      ┌────────▼──┐   │
│    │ MongoDB │                      │   Redis   │   │
│    │ (27017) │                      │  (6379)   │   │
│    └─────────┘                      └───────────┘   │
│                                                       │
└─────────────────────────────────────────────────────┘
        Docker Network: alloy_network
```

## Running with Docker Compose

### 1. Full Stack (All services)
```bash
# From root directory
cd G:/CMSCET

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### 2. What Gets Started
- **MongoDB** (Port 27017) - Database
- **Redis** (Port 6379) - Cache & Message Broker
- **Django Backend** (Port 8000) - REST API
- **Celery Worker** - Async Task Processing
- **Nginx + Frontend** (Port 80) - Frontend Application

### 3. Access the Application
- **Frontend**: http://localhost
- **Backend API**: http://localhost/api
- **Django Admin**: http://localhost:8000/admin

## Development Setup

### Frontend Development (Local)
```bash
cd frontend

# Install dependencies
npm install

# Start dev server with API proxy
npm run dev

# Frontend runs on: http://localhost:8080
# API calls proxy to: http://localhost:8000/api
```

### Backend Development (Local)
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Start development server
python manage.py runserver

# Backend runs on: http://localhost:8000
```

## Key Files

### Docker Compose
- `docker-compose.yml` - Root level orchestration
- `backend/docker-compose.yml` - Backend-only services

### Frontend
- `frontend/Dockerfile` - Multi-stage build for production
- `frontend/nginx.conf` - Nginx reverse proxy config
- `frontend/.env` - Environment variables
- `frontend/src/services/alloyApi.ts` - API client with env-based URL

### Backend
- `backend/Dockerfile` - Django application container
- `backend/alloy_backend/settings.py` - Django configuration
- `backend/.env` - Backend environment variables

## Environment Variables

### Frontend (.env)
```env
VITE_API_URL=/api                    # API endpoint (proxied)
VITE_APP_NAME=Alloy Alchemy
VITE_ENABLE_ANALYTICS=true
```

### Backend (.env)
```env
SECRET_KEY=your-secret-key
MONGO_DB_NAME=alloy_alchemy
MONGO_URI=mongodb://admin:admin123@mongodb:27017
DEBUG=True
```

## API Communication

### In Docker
- Frontend → Nginx → Django
- Frontend uses `/api` endpoint (proxied by nginx to backend:8000)

### Local Development
- Frontend → Vite Proxy → Django
- Frontend uses `http://localhost:8000/api`

## API Endpoints

### Alloy Composition
- `GET /api/compositions/` - List all alloy compositions
- `POST /api/compositions/` - Create new composition
- `GET /api/compositions/{id}/` - Get specific composition

### Process Data
- `GET /api/process-data/` - Get process data with filters
- `POST /api/process-data/` - Log new process data

### Inventory
- `GET /api/inventory/` - List inventory items
- `POST /api/inventory/` - Add inventory item

### AI Endpoints
- `POST /api/ai/recommendations/` - Generate material recommendations
- `GET /api/ai/quality-analysis/` - Quality analysis
- `POST /api/ai/optimize-process/` - Process optimization
- `GET /api/ai/predictive-maintenance/` - Predictive maintenance

## Database Setup

### MongoDB
The MongoDB service starts automatically with:
- Username: `admin`
- Password: `admin123`
- Database: `alloy_alchemy_production`

### SQLite (Development Only)
Use SQLite for faster local development:
```bash
# In backend directory
python manage.py migrate
python manage.py runserver
```

## Troubleshooting

### Frontend can't connect to backend
1. Check if backend service is running: `docker ps`
2. Verify CORS settings in `backend/alloy_backend/settings.py`
3. In Docker: Backend must be accessible at `http://backend:8000`
4. Locally: Use `http://localhost:8000`

### Database connection issues
```bash
# Check MongoDB connection
docker exec alloy_mongodb mongosh -u admin -p admin123

# Check Redis connection
docker exec alloy_redis redis-cli ping
```

### Rebuild containers
```bash
# Remove and rebuild
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## Production Deployment

For production:
1. Update `.env` with production keys and credentials
2. Set `DEBUG=False` in backend
3. Configure proper `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS`
4. Use production database (MongoDB Atlas recommended)
5. Use production Redis (Redis Cloud recommended)
6. Enable HTTPS with Let's Encrypt or similar

## Performance Optimization

### Frontend
- Built with Vite for fast development and production builds
- Uses React Query for efficient data fetching
- Lazy loading for routes and components

### Backend
- Django REST Framework with pagination
- Redis caching for frequently accessed data
- Celery for async task processing
- MongoDB for flexible schema storage

## Monitoring

View logs for specific services:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
```

## Common Tasks

### Run database migrations
```bash
docker-compose exec backend python manage.py migrate
```

### Create Django superuser
```bash
docker-compose exec backend python manage.py createsuperuser
```

### Collect static files
```bash
docker-compose exec backend python manage.py collectstatic --noinput
```

### Run Celery worker
```bash
docker-compose exec celery celery -A alloy_backend worker --loglevel=info
```

## Next Steps

1. Start the full stack: `docker-compose up -d`
2. Access frontend at: http://localhost
3. Log in to Django admin: http://localhost:8000/admin
4. Test API endpoints with the frontend interface
5. Monitor model training and ML predictions
