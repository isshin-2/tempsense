# Use Node.js 20 slim as the base image
FROM node:20-slim

# Install curl and git for health checks and update checks
RUN apt-get update && apt-get install -y curl git && rm -rf /var/lib/apt/lists/*

# Set the working directory to /app
WORKDIR /app

# Copy package files from backend directory
COPY backend/package*.json ./backend/

# Install dependencies in /app/backend
WORKDIR /app/backend
RUN npm install --production

# Go back to /app and copy the entire project (including .git)
WORKDIR /app
COPY . .

# Expose the HTTP API port and the TCP Sensor port
EXPOSE 3001
EXPOSE 1024

# Set environment defaults (can be overridden by docker-compose)
ENV PORT=3001
ENV TCP_PORT=1024
ENV DB_HOST=db
ENV DB_PORT=5432
ENV DB_NAME=tempsense
ENV DB_USER=postgres
ENV DB_PASS=postgres

# Start the server from /app/backend
WORKDIR /app/backend
CMD ["node", "server.js"]
