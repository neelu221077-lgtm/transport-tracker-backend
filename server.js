const express = require('express');
const mongoose = require('mongoose');
const admin = require('firebase-admin');
const cors = require('cors');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

// === Firebase Admin from Environment Variables ===
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// === MongoDB Connection ===
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

const VehicleSchema = new mongoose.Schema({
  vehicleId: String,
  route: String,
  lat: Number,
  lng: Number,
  timestamp: { type: Date, default: Date.now }
});

const Vehicle = mongoose.model('Vehicle', VehicleSchema);

// Protected route – update vehicle location
app.post('/api/vehicles', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    await admin.auth().verifyIdToken(token);
    const { vehicleId, route, lat, lng } = req.body;

    const vehicle = await Vehicle.findOneAndUpdate(
      { vehicleId },
      { vehicleId, route, lat, lng, timestamp: new Date() },
      { upsert: true, new: true }
    );

    io.emit('vehicleUpdate', vehicle);
    res.json(vehicle);
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Get all vehicles (public for demo – add auth if you want)
app.get('/api/vehicles', async (req, res) => {
  const vehicles = await Vehicle.find();
  res.json(vehicles);
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
