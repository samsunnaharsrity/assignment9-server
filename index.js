const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ======================
   ENV
====================== */
const uri = process.env.MONGODB_URL;
const port = process.env.PORT || 5000;

/* ======================
   MONGODB
====================== */
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

/* ======================
   AUTH
====================== */
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid Token" });
  }
};

/* ======================
   DB + ROUTES
====================== */
async function run() {
  try {
    await client.connect();

    const db = client.db("StudyNook");
    const rooms = db.collection("rooms");
    const bookings = db.collection("bookings");

    /* ======================
       HEALTH CHECK
    ====================== */
    app.get("/", (req, res) => {
      res.send("StudyNook API Running 🚀");
    });

    /* ======================
       ROOMS
    ====================== */

    // Get all rooms
    app.get("/rooms", async (req, res) => {
      const result = await rooms.find().toArray();
      res.send(result);
    });

    // Get single room
    app.get("/rooms/:id", async (req, res) => {
      const result = await rooms.findOne({
        _id: new ObjectId(req.params.id),
      });

      if (!result) {
        return res.status(404).json({ message: "Room not found" });
      }

      res.send(result);
    });

    // Create room
    app.post("/rooms", verifyToken, async (req, res) => {
      const room = {
        ...req.body,
        ownerEmail: req.user.email,
        ownerId: req.user.id,
        enrollmentCount: 0,
        createdAt: new Date(),
      };

      const result = await rooms.insertOne(room);
      res.send(result);
    });

    // My rooms
    app.get("/my-rooms", verifyToken, async (req, res) => {
      const result = await rooms
        .find({ ownerEmail: req.user.email })
        .toArray();

      res.send(result);
    });

    // Delete room
    app.delete("/rooms/:id", verifyToken, async (req, res) => {
      const result = await rooms.deleteOne({
        _id: new ObjectId(req.params.id),
      });

      res.send(result);
    });

    /* ======================
       BOOKINGS (ONLY ONE VERSION)
    ====================== */

    app.post("/bookings", verifyToken, async (req, res) => {
      try {
        const { roomId, date, startTime, endTime } = req.body;

        const room = await rooms.findOne({
          _id: new ObjectId(roomId),
        });

        if (!room) {
          return res.status(404).json({ message: "Room not found" });
        }

        // conflict check
        const conflict = await bookings.findOne({
          roomId,
          date,
          status: "confirmed",
          $or: [
            {
              startTime: { $lt: endTime },
              endTime: { $gt: startTime },
            },
          ],
        });

        if (conflict) {
          return res.status(400).json({
            message: "Time slot already booked",
          });
        }

        const result = await bookings.insertOne({
          roomId,
          userId: req.user.id,
          userEmail: req.user.email,
          date,
          startTime,
          endTime,
          status: "confirmed",
          bookedAt: new Date(),
        });

        await rooms.updateOne(
          { _id: new ObjectId(roomId) },
          { $inc: { enrollmentCount: 1 } }
        );

        res.send(result);
      } catch (err) {
        res.status(500).json({ message: "Booking failed" });
      }
    });

    // My bookings
    app.get("/bookings", verifyToken, async (req, res) => {
      const result = await bookings
        .find({ userEmail: req.user.email })
        .toArray();

      res.send(result);
    });

    // Cancel booking
    app.delete("/bookings/:id", verifyToken, async (req, res) => {
      const result = await bookings.deleteOne({
        _id: new ObjectId(req.params.id),
      });

      res.send(result);
    });

    console.log("MongoDB Connected 🚀");
  } catch (err) {
    console.log(err);
  }
}

run();

/* ======================
   EXPORT (Vercel)
====================== */
module.exports = app;