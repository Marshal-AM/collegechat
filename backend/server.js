// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const activeUsers = new Map(); // socketId -> {email, gender, chatPartner}
const emailToSocket = new Map(); // email -> socketId
const waitingUsers = {
  male: new Set(),
  female: new Set()
};

function isValidCollegeEmail(email) {
  const validDomains = ['.edu', '.ac.in', '.edu.in'];
  return validDomains.some(domain => email.toLowerCase().endsWith(domain));
}

function disconnectUser(socketId) {
  const user = activeUsers.get(socketId);
  if (user) {
    // Remove from email tracking
    emailToSocket.delete(user.email);
    
    // Notify chat partner if exists
    if (user.chatPartner) {
      io.to(user.chatPartner).emit('partnerLeft');
      const partner = activeUsers.get(user.chatPartner);
      if (partner) {
        partner.chatPartner = null;
      }
    }
    
    // Remove from waiting queues
    waitingUsers.male.delete(socketId);
    waitingUsers.female.delete(socketId);
    
    // Remove from active users
    activeUsers.delete(socketId);
  }
}

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  socket.on('register', ({ email, gender }) => {
    if (!isValidCollegeEmail(email)) {
      socket.emit('error', 'Please use a valid college email (.edu, .ac.in, or .edu.in)');
      return;
    }

    // Check if email is already in use
    const existingSocketId = emailToSocket.get(email);
    if (existingSocketId) {
      // Disconnect old socket if it exists
      disconnectUser(existingSocketId);
      const existingSocket = io.sockets.sockets.get(existingSocketId);
      if (existingSocket) {
        existingSocket.disconnect();
      }
    }

    // Register new user
    emailToSocket.set(email, socket.id);
    activeUsers.set(socket.id, { email, gender, chatPartner: null });
    findMatch(socket);
  });

  function findMatch(socket) {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    const oppositeGender = user.gender === 'male' ? 'female' : 'male';
    
    if (waitingUsers[oppositeGender].size > 0) {
      // Get first waiting user of opposite gender
      const partnerSocketId = waitingUsers[oppositeGender].values().next().value;
      waitingUsers[oppositeGender].delete(partnerSocketId);
      
      // Connect both users
      const partner = activeUsers.get(partnerSocketId);
      if (partner) {
        user.chatPartner = partnerSocketId;
        partner.chatPartner = socket.id;
        
        // Notify both users
        socket.emit('chatStart', { partnerId: partnerSocketId });
        io.to(partnerSocketId).emit('chatStart', { partnerId: socket.id });
      } else {
        // If partner not found, put user in waiting queue
        waitingUsers[user.gender].add(socket.id);
        socket.emit('waiting');
      }
    } else {
      // Add user to waiting queue
      waitingUsers[user.gender].add(socket.id);
      socket.emit('waiting');
    }
  }

  socket.on('message', (message) => {
    const user = activeUsers.get(socket.id);
    if (user && user.chatPartner) {
      io.to(user.chatPartner).emit('message', message);
    }
  });

  socket.on('next', () => {
    const user = activeUsers.get(socket.id);
    if (user && user.chatPartner) {
      io.to(user.chatPartner).emit('partnerLeft');
      const partner = activeUsers.get(user.chatPartner);
      if (partner) {
        partner.chatPartner = null;
      }
      user.chatPartner = null;
      findMatch(socket);
    }
  });

  socket.on('disconnect', () => {
    disconnectUser(socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});