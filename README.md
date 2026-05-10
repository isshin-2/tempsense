# TEMPSENSE - Cold Chain IoT Platform

TEMPSENSE is a robust IoT monitoring platform designed for cold chain logistics and warehouse management. It features a real-time dashboard, automated alerts, and a high-performance TCP server for sensor data ingestion.

## 🚀 Quick Start (Docker)

The easiest way to get TEMPSENSE running is using Docker. This will automatically set up the PostgreSQL database, the Node.js backend, and the React frontend.

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac/Linux)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/isshin-2/tempsense.git
   cd tempsense
   ```

2. **Run the system**:
   - **Windows**: Double-click `docker-start.bat` or run:
     ```bash
     docker-compose up -d --build
     ```
   - **Linux/Mac**:
     ```bash
     docker-compose up -d --build
     ```

## 🖥️ Accessing the Platform

Once the containers are running, you can access the following:

- **Web Dashboard**: [http://localhost](http://localhost) (Port 80)
- **API Health Check**: [http://localhost:3001/api/health](http://localhost:3001/api/health)
- **Database Management (Adminer)**: [http://localhost:8080](http://localhost:8080)
  - *Server*: `db`
  - *Username*: `postgres`
  - *Password*: `postgres`
  - *Database*: `tempsense`

## 📡 Connecting Sensors

Sensor nodes should be configured to send data via TCP:

- **Server IP**: Your computer's local IP (e.g., `192.168.x.x`)
- **Port**: `1024`

## 🛠️ Project Structure

- `/backend`: Node.js Express server + TCP listener.
- `/frontend`: React + Vite dashboard.
- `docker-compose.yml`: Multi-container orchestration.

---
Created by [isshin-2](https://github.com/isshin-2)
