# Use Node.js 20 alpine as the base image for smaller size and fewer DNS/network issues
FROM node:20-alpine

# Install curl and git for health checks and update checks
RUN apk add --no-cache curl git

# Set the working directory to /app
WORKDIR /app

# Copy package files for backend and frontend
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm install --production

# Install frontend dependencies
WORKDIR /app/frontend
RUN npm install --legacy-peer-deps

# Copy the rest of the files (including .git)
WORKDIR /app
COPY . .

# Build the frontend assets on docker build
WORKDIR /app/frontend
RUN npm run build

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
CMD ["node", "server.js"]
