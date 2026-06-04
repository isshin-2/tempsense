<p align="center">
  <h1 align="center">🌡️ TEMPSENSE</h1>
  <p align="center">
    <strong>Cold Chain IoT Monitoring Platform</strong><br/>
    <em>by Maxworth Techserv</em>
  </p>
  <p align="center">
    Real-time temperature and humidity monitoring for cold chain logistics,<br/>
    warehouses, and sensitive storage facilities.
  </p>
</p>

---

## ✨ Feature Highlights

| Feature | Description |
|---------|-------------|
| 📊 **Real-Time Dashboard** | Live temperature & humidity monitoring with interactive charts powered by Recharts |
| 🔐 **Role-Based Access (RBAC)** | Three user roles — Admin, Site Manager, Customer — with granular permissions |
| 🚨 **Smart Alerts** | Configurable temperature/humidity thresholds with email notifications via SMTP |
| 📄 **Export Reports** | Download data as **PDF** or **CSV** with custom date ranges |
| 📅 **Scheduled Reports** | Automated report generation and delivery on a set schedule |
| 🏢 **Multi-Site Support** | Manage multiple sites, rooms, and sensor nodes from a single dashboard |
| 📡 **TCP Sensor Ingestion** | High-performance raw TCP server (port 1024) for direct sensor node connections |
| 🔄 **Live Updates** | WebSocket-powered real-time data push via Socket.IO |
| 🐳 **Docker Ready** | One-command deployment with Docker Compose |

---

## 🚀 Quick Start

Choose your preferred deployment method:

### Option A: Local Development (run.bat)

> **Best for**: Development, testing, and single-machine deployments on Windows.

#### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later (LTS recommended)
- [PostgreSQL](https://www.postgresql.org/download/windows/) 15+ running on `localhost:5432`
- Database `tempsense` created with user `postgres` / password `postgres`

#### Steps

```
1. Clone the repository
   git clone https://github.com/isshin-2/tempsense.git
   cd tempsense

2. Double-click run.bat   (or run it from a terminal)
```

That's it! The launcher will:
- ✅ Verify Node.js and PostgreSQL are available
- ✅ Auto-install dependencies if `node_modules` is missing
- ✅ Kill any stale processes on ports 3001 / 5173
- ✅ Start backend and frontend in minimized windows
- ✅ Open the dashboard in your browser automatically
- ✅ Show login credentials and status summary

To stop: press any key in the launcher window, or run `stop.bat`.

---

### Option B: Docker Deployment (docker-start.bat)

> **Best for**: Production, demos, and environments where you want zero manual setup.

#### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

#### Steps

```
1. Clone the repository
   git clone https://github.com/isshin-2/tempsense.git
   cd tempsense

2. Double-click docker-start.bat   (or run it from a terminal)
```

The launcher will build all containers, wait for health checks, and open the browser.

#### Docker Services

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost | React dashboard (Nginx, port 80) |
| Backend API | http://localhost:3001 | Express REST API |
| Health Check | http://localhost:3001/api/health | Backend health endpoint |
| Adminer | http://localhost:8080 | Database management GUI |
| PostgreSQL | localhost:5432 | Database (internal) |
| TCP Listener | port 1024 | Sensor data ingestion |

---

## 🔑 Default Login Credentials

| Field | Value |
|-------|-------|
| **Email** | `admin@maxworthonline.com` |
| **Password** | `TMS@2026` |
| **Role** | Super Admin |

> ⚠️ **Change the default password after first login in production environments.**

---

## 👥 User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full system access — manage users, sites, rooms, nodes, settings, and view all reports |
| **Site Manager** | Manage assigned sites — view data, configure rooms/nodes, generate reports for their sites |
| **Customer** | View-only access — see the dashboard and reports for sites assigned to them |

---

## 🏗️ Architecture

```
                                    ┌──────────────────────┐
                                    │    Sensor Nodes       │
                                    │  (ESP32 / Arduino)    │
                                    └──────────┬───────────┘
                                               │ TCP :1024
                                               ▼
┌─────────────┐    HTTP :5173    ┌─────────────────────────────┐
│   Browser    │◄───────────────►│      Frontend (React)        │
│  Dashboard   │                 │      Vite Dev / Nginx        │
└──────┬──────┘                 └──────────────┬──────────────┘
       │                                        │
       │              WebSocket                 │ REST API
       │              (Socket.IO)               │
       │                                        ▼
       │                        ┌─────────────────────────────┐
       └───────────────────────►│      Backend (Express)       │
                                │                              │
                                │  • REST API     :3001        │
                                │  • TCP Server   :1024        │
                                │  • WebSocket    (Socket.IO)  │
                                │  • PDF/CSV Gen  (PDFKit)     │
                                │  • SMTP Alerts  (Nodemailer) │
                                └──────────────┬──────────────┘
                                               │
                                               ▼
                                ┌─────────────────────────────┐
                                │    PostgreSQL Database        │
                                │    Port 5432                 │
                                │                              │
                                │  Tables:                     │
                                │  • users, sites, rooms       │
                                │  • nodes, sensor_data        │
                                │  • alerts, settings          │
                                └─────────────────────────────┘
```

---

## 📁 Project Structure

```
tempsense/
├── backend/                 # Node.js Express API server
│   ├── server.js            # Main entry — Express + TCP + Socket.IO
│   ├── db/                  # Database connection and schema setup
│   ├── routes/              # API route handlers
│   │   ├── auth.js          #   Authentication & user management
│   │   ├── data.js          #   Sensor data CRUD & export
│   │   ├── nodes.js         #   Sensor node management
│   │   ├── rooms.js         #   Room management
│   │   ├── sites.js         #   Site management
│   │   └── settings.js      #   System settings & thresholds
│   ├── middleware/           # Auth middleware (JWT verification)
│   ├── services/            # Business logic services
│   ├── .env                 # Environment configuration
│   ├── Dockerfile           # Docker build for backend
│   └── package.json
│
├── frontend/                # React + Vite dashboard
│   ├── src/
│   │   ├── App.jsx          # Root component with routing
│   │   ├── main.jsx         # React DOM entry point
│   │   ├── pages/           # Page components (Dashboard, Login, etc.)
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # React context providers (Auth, etc.)
│   │   └── services/        # API client services
│   ├── public/              # Static assets
│   ├── index.html           # HTML template
│   ├── vite.config.js       # Vite configuration
│   ├── Dockerfile           # Docker build for frontend (Nginx)
│   └── package.json
│
├── docker-compose.yml       # Multi-container orchestration
├── run.bat                  # One-click local launcher (Windows)
├── stop.bat                 # Stop local services (Windows)
├── docker-start.bat         # One-click Docker launcher (Windows)
└── README.md                # This file
```

---

## 📡 Connecting Sensor Nodes

TEMPSENSE accepts sensor data over raw TCP on **port 1024**.

### Connection Settings

| Parameter | Value |
|-----------|-------|
| **Protocol** | TCP |
| **Host** | Your server's IP (e.g., `192.168.1.100`) |
| **Port** | `1024` |
| **Format** | As expected by the TCP handler in `server.js` |

### Supported Hardware

- ESP32 / ESP8266 with DHT22/DHT11 sensors
- Arduino with Ethernet/WiFi shield
- Any device capable of raw TCP socket communication

> 💡 **Tip**: Register your sensor node in the dashboard first (Admin → Nodes), then configure the hardware to send data to the TCP port.

---

## 🔧 Troubleshooting

### `EADDRINUSE: port 3001 already in use`

Another process is using port 3001. Run `stop.bat` to kill it, or manually:
```powershell
# Find the process
netstat -aon | findstr ":3001"
# Kill by PID
taskkill /F /PID <PID_NUMBER>
```

### `EADDRINUSE: port 5173 already in use`

Same as above but for port 5173:
```powershell
netstat -aon | findstr ":5173"
taskkill /F /PID <PID_NUMBER>
```

### `Database "tempsense" does not exist`

Create the database manually:
```sql
-- Connect to PostgreSQL as the postgres user
CREATE DATABASE tempsense;
```
Or via command line:
```powershell
psql -U postgres -c "CREATE DATABASE tempsense;"
```

### `Connection refused` to PostgreSQL

1. Ensure PostgreSQL service is running:
   ```powershell
   # Check service status
   Get-Service -Name "postgresql*"
   # Start if stopped
   Start-Service -Name "postgresql-x64-15"
   ```
2. Verify connection settings in `backend/.env` match your PostgreSQL installation.

### Docker: `port is already allocated`

Stop conflicting services or change ports in `docker-compose.yml`:
```powershell
docker-compose down
# Then restart
docker-compose up -d --build
```

### Frontend shows blank page / API errors

1. Check backend is running: visit http://localhost:3001/api/health
2. Check browser console for CORS or network errors
3. Ensure `vite.config.js` proxy is pointing to the correct backend port

---

## ⚙️ Environment Variables

All backend configuration lives in `backend/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Express HTTP server port |
| `TCP_PORT` | `1024` | Raw TCP sensor data ingestion port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `tempsense` | Database name |
| `DB_USER` | `postgres` | Database username |
| `DB_PASS` | `postgres` | Database password |
| `JWT_SECRET` | *(set in .env)* | Secret key for signing JWT tokens |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server for email alerts |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | *(your email)* | SMTP authentication username |
| `SMTP_PASS` | *(your password)* | SMTP authentication password (app password) |
| `ALERT_FROM` | `alerts@tempsense.io` | "From" address for alert emails |
| `ALERT_TO` | `admin@maxworth.in` | Default recipient for alert emails |

> ⚠️ **For production**: Change `JWT_SECRET`, use strong database passwords, and configure real SMTP credentials.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 6, React Router 7, Recharts, Lucide Icons, Socket.IO Client |
| **Backend** | Node.js, Express 5, Socket.IO, PDFKit, csv-stringify, Nodemailer, bcryptjs, jsonwebtoken |
| **Database** | PostgreSQL 15 |
| **DevOps** | Docker, Docker Compose, Nginx |

---

## 📜 Credits

**TEMPSENSE** is developed and maintained by **Maxworth Techserv**.

- Repository: [github.com/isshin-2/tempsense](https://github.com/isshin-2/tempsense)
- Author: [isshin-2](https://github.com/isshin-2)

---

<p align="center">
  <em>Built with ❤️ for cold chain safety</em>
</p>
