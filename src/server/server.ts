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
    origin: "http://localhost:5173",
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
    const developer = await developerManager.createDeveloper(req.body);
    res.json(developer);
  } catch (error) {
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

app.post('/api/developers/:id/input', (req, res) => {
  try {
    developerManager.sendInput(req.params.id, req.body.input);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/notifications', (req, res) => {
  res.json(notificationManager.getAllNotifications());
});

app.post('/api/notifications/:id/read', (req, res) => {
  notificationManager.markAsRead(req.params.id);
  res.json({ success: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, server, io };