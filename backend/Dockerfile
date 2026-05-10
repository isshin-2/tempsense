# Use Node.js 20 slim as the base image
FROM node:20-slim

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application code
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

# Start the server
CMD ["node", "server.js"]
