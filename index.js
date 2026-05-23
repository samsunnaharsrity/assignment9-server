const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ObjectId } = require("mongodb");
const { jwtVerify } = require("jose-cjs");

dotenv.config();

const app = express();
app.use(cors({
  origin: [
    "http://localhost:3000",
    process.env.CLIENT_URL
  ],
  credentials: true
}));
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URL);
let db;

async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db("StudyNook");
  }
  return db;
}

// JWT
const JWKS = new URL(`${process.env.CLIENT_URL}/api/auth/jwks`);

const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).send({ message: "Unauthorized" });

    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;

    next();
  } catch {
    res.status(401).send({ message: "Invalid Token" });
  }
};

app.get("/rooms", async (req, res) => {
  const db = await connectDB();
  const rooms = await db.collection("rooms").find().toArray();
  res.send(rooms);
});

app.get("/rooms/:id", verifyToken, async (req, res) => {
  const db = await connectDB();

  const room = await db.collection("rooms").findOne({
    _id: new ObjectId(req.params.id),
  });

  res.send(room);
});

app.post("/rooms", verifyToken, async (req, res) => {
  const db = await connectDB();

  const result = await db.collection("rooms").insertOne({
    ...req.body,
    enrollmentCount: 0,
    createdAt: new Date(),
    ownerEmail: req.user.email,
  });

  res.send(result);
});

app.delete("/rooms/:id", verifyToken, async (req, res) => {
  const db = await connectDB();

  const result = await db.collection("rooms").deleteOne({
    _id: new ObjectId(req.params.id),
  });

  res.send(result);
});

// SINGLE BOOKINGS ROUTE ONLY
app.post("/bookings", verifyToken, async (req, res) => {
  const db = await connectDB();

  const booking = req.body;

  const room = await db.collection("rooms").findOne({
    _id: new ObjectId(booking.roomId),
  });

  if (!room) return res.status(404).send({ message: "Room not found" });

  const result = await db.collection("enrollment").insertOne({
    ...booking,
    userEmail: req.user.email,
    bookedAt: new Date(),
  });

  await db.collection("rooms").updateOne(
    { _id: new ObjectId(booking.roomId) },
    { $inc: { enrollmentCount: 1 } }
  );

  res.send(result);
});

app.get("/enrollments/:id", verifyToken, async (req, res) => {
  const db = await connectDB();

  const result = await db.collection("enrollment")
    .find({ userId: req.params.id })
    .toArray();

  res.send(result);
});

module.exports = app;