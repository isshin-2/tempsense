# Use Node.js 20 slim as the base image to avoid Alpine/musl npm crashes
FROM node:20-slim

# Install curl and git for health checks and update checks (forcing IPv4 to avoid DNS hangs)
RUN apt-get update -o Acquire::ForceIPv4=true && apt-get install -y --no-install-recommends curl git ca-certificates && rm -rf /var/lib/apt/lists/*

# Set the working directory to /app
WORKDIR /app

# Copy package files for backend and frontend
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm install --production

# Copy the rest of the files (including .git)
WORKDIR /app
COPY . .

# Build the frontend assets on docker build
WORKDIR /app/frontend
ENV NODE_ENV=development
RUN rm -rf node_modules && npm install --legacy-peer-deps && npm run build

# Expose ports
WORKDIR /app/backend
EXPOSE 3001
EXPOSE 1024

ENV PORT=3001
ENV TCP_PORT=1024
ENV DB_HOST=db
ENV DB_PORT=5432
ENV DB_NAME=tempsense
ENV DB_USER=postgres
ENV DB_PASS=postgres

# Start the server
ENV NODE_ENV=production
CMD ["node", "server.js"]
