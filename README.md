# Flame Steel: Death Mask 2

A multiplayer 3D dungeon crawler web game with a retro-cyberpunk aesthetic, featuring procedural maps, terminal-based interactions, and real-time multiplayer gameplay.

## 🎮 Features

- **3D Exploration**: First-person perspective dungeon crawling using Flame Steel Engine 2 + Three.js.
- **Multiplayer**: Real-time visibility of other players and entities.
- **Terminal Interface**: integrated command-line for advanced game actions, debugging, and chatting.
- **Procedural Generation**: Randomly generated dungeon maps with rooms and corridors.
- **Interactive World**:
  - **Combat**: Attack hostile "Filter" entities to gain bits.
  - **Looting**: Unlock "Chests" to upgrade stats and resources.
  - **Survival**: Manage health and use healing items.
- **Responsive UI**: Mobile-friendly controls with on-screen buttons and a minimap.

## 🛠️ Technology Stack

### Client (`/client`)
- **Frontend**: Vanilla JavaScript (ES Modules)
- **3D Engine**: [Three.js](https://threejs.org/)
- **Hosting**: Express.js (serves static assets + proxy)

### Server (`/server`)
- **Runtime**: Node.js
- **Communication**: WebSocket (`ws`)
- **Database**: MongoDB (User profiles, Map persistence)
- **State Management**: Redis (Real-time player positioning & spatial indexing)

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- *Or for manual dev*: Node.js v18+, MongoDB, Redis

### 🐳 Docker Quick Start (Recommended)
1. Clone the repository:
   ```bash
   git clone https://github.com/Start-0-Process/Flame-Steel-Death-Mask-2.git
   cd Flame-Steel-Death-Mask-2
   ```

2. Start the game stack:
   ```bash
   docker-compose up --build -d
   ```

3. Open your browser:
   - Go to [http://localhost:3000](http://localhost:3000)

### 🔧 Manual Setup

#### Server
1. Ensure MongoDB and Redis are running locally.
2. Navigate to server directory:
   ```bash
   cd server
   npm install
   ```
3. Start the server (defaults to port 8080):
   ```bash
   npm start
   ```

#### Client
1. Navigate to client directory:
   ```bash
   cd client/web
   npm install
   ```
2. Start the client (defaults to port 3000):
   ```bash
   npm start
   ```

## 🕹️ How to Play

1. **Initialize**: Enter a codename to register.
2. **Move**: Use the on-screen arrows or keyboard commands to navigate.
3. **Interact**:
   - **Attack**: Defeat enemies adjacent to you.
   - **Unlock**: Open chests adjacent to you (costs Bits, rewards stats).
   - **Heal**: Restore health using available heal items.
4. **Terminal**: Toggle the console to use commands like:
   - `help`: List available commands
   - `map <id> <private_uuid>`: Request a map
   - `teleport <map_id> <x> <y> <uuid>`: Teleport to coordinates
   - `heal <uuid>`: Heal via command line

## 📦 Deployment Configuration

To deploy under a subpath (e.g., `/my-game`), set the `BASE_URL` environment variable in `docker-compose.yml` or run:

```bash
docker-compose run -d --service-ports -e BASE_URL=/my-game client
```

## 📜 License
[ISC](LICENSE)
