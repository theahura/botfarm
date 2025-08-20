import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { DeveloperManager } from './DeveloperManager';
import { NotificationManager } from './NotificationManager';
import { SocketEvents } from '../shared/types';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const developerManager = new DeveloperManager(io);
const notificationManager = new NotificationManager(io);

app.get('/api/developers', (req, res) => {
  res.json(developerManager.getAllDevelopers());
});

app.post('/api/developers', async (req, res) => {
  try {
    console.log('🔧 API: Creating developer with request body:', req.body);
    const developer = await developerManager.createDeveloper(req.body);
    console.log('✅ API: Developer created successfully:', developer.id);
    res.json(developer);
  } catch (error) {
    console.error('❌ API: Failed to create developer:', error);
    console.error('❌ API: Error stack:', (error as Error).stack);
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/developers/:id', (req, res) => {
  const developer = developerManager.getDeveloper(req.params.id);
  if (!developer) {
    return res.status(404).json({ error: 'Developer not found' });
  }
  res.json(developer);
});

app.delete('/api/developers/:id', async (req, res) => {
  try {
    await developerManager.deleteDeveloper(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/developers/:id/commit', async (req, res) => {
  try {
    const pullRequestUrl = await developerManager.commitAndCreatePR(req.params.id, req.body.message);
    res.json({ pullRequestUrl });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/developers/:id/merge', async (req, res) => {
  try {
    await developerManager.mergePRAndCleanup(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/developers/:id/activate', async (req, res) => {
  try {
    const developer = await developerManager.activateDeveloper(req.params.id);
    res.json(developer);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});



app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

io.on('connection', (socket) => {
  console.log(`🔌 Socket.IO client connected: ${socket.id}`);
  
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Socket.IO client disconnected: ${socket.id}, reason: ${reason}`);
  });
  
  socket.on('error', (error) => {
    console.error(`🔌 Socket.IO error for ${socket.id}:`, error);
  });
  
  // Handle terminal connection requests
  socket.on('terminal:connect', (developerId: string) => {
    console.log(`🔌 Client ${socket.id} connecting to terminal for developer ${developerId}`);
    const terminal = developerManager.getTerminal(developerId);
    if (terminal) {
      // Join a room for this developer's terminal
      socket.join(`terminal:${developerId}`);
      console.log(`✅ Client ${socket.id} joined terminal room for developer ${developerId}`);
      
      // Send terminal history to the newly connected client
      const history = developerManager.getTerminalHistory(developerId);
      if (history) {
        socket.emit('terminal:history', history);
        console.log(`📜 Sent terminal history to client ${socket.id} (${history.length} characters)`);
      }
    } else {
      socket.emit('terminal:error', `Terminal not found for developer ${developerId}`);
    }
  });
  
  socket.on('terminal:disconnect', (developerId: string) => {
    console.log(`🔌 Client ${socket.id} disconnecting from terminal for developer ${developerId}`);
    socket.leave(`terminal:${developerId}`);
  });
  
  socket.on('terminal:input', ({ developerId, data }: { developerId: string, data: string }) => {
    console.log(`⌨️ Client ${socket.id} sending input to terminal ${developerId}: "${data}"`);
    try {
      developerManager.sendTerminalInput(developerId, data);
    } catch (error) {
      socket.emit('terminal:error', (error as Error).message);
    }
  });

  socket.on('terminal:reset', (developerId: string) => {
    console.log(`🔄 Client ${socket.id} requesting terminal reset for developer ${developerId}`);
    try {
      developerManager.resetTerminal(developerId);
    } catch (error) {
      socket.emit('terminal:error', (error as Error).message);
    }
  });
  
  // Log when we emit events
  const originalEmit = socket.emit;
  socket.emit = function(...args) {
    console.log(`📡 Emitting to ${socket.id}:`, args[0], args.length > 1 ? 'with data' : 'no data');
    return originalEmit.apply(this, args);
  };
});

// Log global Socket.IO emissions
const originalGlobalEmit = io.emit;
io.emit = function(...args) {
  console.log(`📡 Broadcasting to all clients:`, args[0], args.length > 1 ? 'with data' : 'no data');
  return originalGlobalEmit.apply(this, args);
};

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, server, io };