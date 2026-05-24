const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
} = require("mongodb");

const {
  createRemoteJWKSet,
  jwtVerify,
} = require("jose-cjs");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

/* ======================
   MIDDLEWARE
====================== */

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());

/* ======================
   MONGODB
====================== */

const uri = process.env.MONGODB_URL;

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
  try {
    const { authorization } = req.headers;

    const token = authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Unauthorized Access",
      });
    }

    const { payload } = await jwtVerify(token, JWKS);

    req.user = payload;

    next();
  } catch (error) {
    console.log(error);

    return res.status(401).json({
      message: "Invalid Token",
    });
  }
};

/* ======================
   DATABASE FUNCTION
====================== */

async function run() {
  try {
    // await client.connect();

    const db = client.db("StudyNook");

    const roomsCollection = db.collection("rooms");

    const bookingsCollection = db.collection("bookings");

    /* ======================
       HOME
    ====================== */

    app.get("/", (req, res) => {
      res.send("StudyNook Server Running");
    });

    /* ======================
       ROOMS
    ====================== */

    // all rooms
    app.get("/rooms", async (req, res) => {
      try {
        const result = await roomsCollection.find().toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Failed to fetch rooms",
        });
      }
    });

    // single room
    app.get("/rooms/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await roomsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.status(404).json({
            message: "Room not found",
          });
        }

        res.send(result);
      } catch (error) {
        res.status(500).json({
          message: "Failed to fetch room",
        });
      }
    });

    // create room
    app.post("/rooms", verifyToken, async (req, res) => {
      try {
        const roomData = req.body;

        const result = await roomsCollection.insertOne({
          ...roomData,

          ownerEmail: req.user.email,
          ownerId: req.user.id,

          enrollmentCount: 0,

          createdAt: new Date(),
        });

        res.send(result);
      } catch (error) {
        res.status(500).json({
          message: "Room creation failed",
        });
      }
    });

    // my rooms
    app.get("/my-rooms", verifyToken, async (req, res) => {
      try {
        const email = req.user.email;

        const result = await roomsCollection
          .find({
            ownerEmail: email,
          })
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).json({
          message: "Failed to fetch my rooms",
        });
      }
    });

    // delete room
    app.delete("/rooms/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;

        const result = await roomsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        res.status(500).json({
          message: "Delete failed",
        });
      }
    });

    /* ======================
       BOOKINGS
    ====================== */

    // create booking
    app.post("/bookings", verifyToken, async (req, res) => {
      try {
        const bookingInfo = req.body;

        const room = await roomsCollection.findOne({
          _id: new ObjectId(bookingInfo.roomId),
        });

        if (!room) {
          return res.status(404).json({
            message: "Room not found",
          });
        }

        const result = await bookingsCollection.insertOne({
          ...bookingInfo,

          userEmail: req.user.email,
          userId: req.user.id,

          status: "confirmed",

          bookedAt: new Date(),
        });

        await roomsCollection.updateOne(
          {
            _id: new ObjectId(bookingInfo.roomId),
          },
          {
            $inc: {
              enrollmentCount: 1,
            },
          }
        );

        res.send(result);
      } catch (error) {
        console.log(error);

        res.status(500).json({
          message: "Booking failed",
        });
      }
    });

    // my bookings
    app.get("/bookings", verifyToken, async (req, res) => {
      try {
        const email = req.user.email;

        const result = await bookingsCollection
          .find({
            userEmail: email,
          })
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).json({
          message: "Failed to fetch bookings",
        });
      }
    });

    // cancel booking
    app.delete("/bookings/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;

        const result = await bookingsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        res.status(500).json({
          message: "Cancel failed",
        });
      }
    });

    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.log(error);
  }
}

run();

/* ======================
   SERVER
====================== */

app.get("/" ,(req,res)=>{
  res.send("Assignment 9 server is running");
}


)

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});