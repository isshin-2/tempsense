# Use Node.js 22 alpine as the base image for latest features and security updates
FROM node:22-alpine

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

# (Frontend dependencies will be installed after COPY to guarantee no host interference)

# Copy the rest of the files (including .git)
WORKDIR /app
COPY . .

# Build the frontend assets on docker build
WORKDIR /app/frontend
RUN rm -rf node_modules && npm install --include=dev --legacy-peer-deps && npm run build

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
