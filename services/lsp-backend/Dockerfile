FROM node:20-slim

# Install Python 3
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Install Pyright globally via NPM
RUN npm install -g pyright

WORKDIR /app

# Copy dependency definition and install
COPY package.json ./
RUN npm install --production

# Copy application script
COPY index.js ./

EXPOSE 3003

ENV PORT=3003

CMD ["node", "index.js"]
