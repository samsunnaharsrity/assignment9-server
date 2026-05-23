const express = require('express')
const dotenv = require('dotenv')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
dotenv.config()
const app = express()
app.use(cors())
app.use(express.json())
const port = process.env.PORT || 5000

                // from mongodb

const uri = process.env.MONGODB_URL;

    const JWKS = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
    )



const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const loggedIn = (req , res , next) =>{
        console.log(`${req.method} | ${req.url}`);
        next();
      }
const verifyToken = async (req, res, next) => {

  const { authorization } = req.headers;

  const token = authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {

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
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const db = client.db("StudyNook")
    const roomsData = db.collection("rooms")
    const enrollmentData = db.collection("enrollment")

    app.get("/rooms" , async(req , res)=>{
        const cursor = roomsData.find()
        const result = await cursor.toArray();
        res.send(result)
        
    })

    // cancel data

app.delete("/enrollments/:id", async (req, res) => {

  const id = req.params.id;

  const query = { _id: new ObjectId(id) };

  const result = await enrollmentData.deleteOne(query);

  res.send(result);

});

// delete data
app.delete("/rooms/:id", async (req, res) => {

  try {

    const id = req.params.id;

    const result = await roomsData.deleteOne({
      _id: new ObjectId(id),
    });

    res.send(result);

  } catch (error) {

    res.status(500).send({
      message: "Delete Failed",
    });

  }

});
// bookings page
app.post("/bookings", verifyToken, async (req, res) => {
  try {
    const { roomId, date, startTime, endTime } = req.body;

    const room = await roomsData.findOne({
      _id: new ObjectId(roomId),
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // 🚨 CONFLICT CHECK
    const conflict = await enrollmentData.findOne({
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

    const result = await enrollmentData.insertOne({
      roomId,
      userId: req.user.id,
      userEmail: req.user.email,
      date,
      startTime,
      endTime,
      status: "confirmed",
      bookedAt: new Date(),
    });

    await roomsData.updateOne(
      { _id: new ObjectId(roomId) },
      { $inc: { enrollmentCount: 1 } }
    );

    res.send(result);
  } catch (err) {
    res.status(500).json({ message: "Booking failed" });
  }
});

app.get("/bookings", verifyToken, async (req, res) => {
  try {
    const email = req.user.email;

    const result = await enrollmentData
      .find({ userEmail: email })
      .toArray();

    res.send(result);
  } catch (err) {
    res.status(500).json({ message: "Failed" });
  }
});

// cancel


app.get("/rooms/:id", verifyToken, async (req, res) => {

  try {

    const { id } = req.params;

    const result = await roomsData.findOne({
      _id: new ObjectId(id),
    });

    if (!result) {
      return res.status(404).json({
        message: "Room not found",
      });
    }

    res.send(result);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      message: "Failed to fetch room",
    });
  }

});





                    // single data
app.get("/enrollments/:id", verifyToken, async (req, res) => {

  try {

    const id = req.params.id;

    const result = await enrollmentData.find({
      userId: id,
    }).toArray();

    res.send(result);

  } catch (err) {

    res.status(500).json({
      message: "Failed",
    });
  }

});





app.patch(
  "/enrollments/:id",
  verifyToken,
  async (req, res) => {

    const { id } = req.params;
    const enrollmentInfo = req.body;

    const room = await roomsData.findOne({
      _id: new ObjectId(id),
    });

    if (!room) {
      return res
        .status(404)
        .json({ message: "Room Not Found" });
    }

    await roomsData.updateOne(
      { _id: new ObjectId(id) },
      {
        $inc: {
          enrollCount: 1,
        },

        $set: {
          lastEnrolledAt: new Date(),
        },
      }
    );

    const result = await enrollmentData.insertOne({
      ...enrollmentInfo,
      enrolledAt: new Date(),
    });

    res.send(result);
  }
);




app.post("/bookings", verifyToken, async (req, res) => {

  try {

    const booking = req.body;

    console.log("BOOKING DATA:", booking);

    const room = await roomsData.findOne({
      _id: new ObjectId(booking.roomId),
    });

    if (!room) {
      return res.status(404).json({
        message: "Room not found",
      });
    }

    const result = await enrollmentData.insertOne({

      roomId: booking.roomId,
      roomName: booking.roomName,
      roomImage: room.roomImage,

      userId: req.user.id,
      userEmail: req.user.email,

      status: "confirmed",

      bookedAt: new Date(),

    });

    await roomsData.updateOne(
      {
        _id: new ObjectId(booking.roomId),
      },
      {
        $inc: {
          enrollmentCount: 1,
        },
      }
    );

    res.send(result);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      message: "Booking failed",
    });

  }

});




app.get("/enrollments/:id", verifyToken, async (req, res) => {

  const id = req.params.id;

  const result = await enrollmentData.find({
    userId: id,
  }).toArray();

  res.send(result);

});

app.post("/bookings", verifyToken, async (req, res) => {
  try {
    const bookingInfo = req.body;

    const room = await roomsData.findOne({
      _id: new ObjectId(bookingInfo.roomId),
    });

    if (!room) {
      return res.status(404).json({ message: "Room Not Found" });
    }

    // 1. Save booking
    const result = await enrollmentData.insertOne({
      ...bookingInfo,
      enrolledAt: new Date(),
    });

    // 2. Update room stats
    await roomsData.updateOne(
      { _id: new ObjectId(bookingInfo.roomId) },
      {
        $inc: { enrollmentCount: 1 },
        $set: { lastEnrolledAt: new Date() },
      }
    );




    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Booking failed" });
  }
});




app.post("/bookings", verifyToken, async (req, res) => {
  try {
    const booking = req.body;

    const room = await roomsData.findOne({
      _id: new ObjectId(booking.roomId),
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const result = await enrollmentData.insertOne({
      ...booking,
      userEmail: req.user.email,
      bookedAt: new Date(),
    });

    await roomsData.updateOne(
      { _id: new ObjectId(booking.roomId) },
      {
        $inc: { enrollmentCount: 1 },
      }
    );

    res.send(result);
  } catch (err) {
    res.status(500).json({ message: "Booking failed" });
  }
});


app.get("/my-rooms", verifyToken, async (req, res) => {
  const email = req.user.email;

  const result = await roomsData
    .find({ ownerEmail: email })
    .toArray();

  res.send(result);
});


app.get("/rooms", async (req, res) => {
  const result = await roomsData.find().toArray();
  res.send(result);
});


app.post("/rooms", verifyToken, async (req, res) => {
  try {
    const roomData = req.body;

    const result = await roomsData.insertOne({
      ...roomData,
      enrollmentCount: 0,
      createdAt: new Date(),
    });

    res.send(result);
  } catch (err) {
    res.status(500).json({ message: "Room creation failed" });
  }
});

app.get("/visibleRooms", verifyToken , async (req, res) => {

  const { search } = req.query;

  let query = {};

  if (search) {
    query = {
      roomName: {
        $regex: search,
        $options: "i"
      }
    };
  }

  const result = await roomsData
    .find(query)
    .limit(6)
    .toArray();

  res.send(result);
});

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Hello World!')
})


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
