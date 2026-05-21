const express = require('express')
const dotenv = require('dotenv')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
dotenv.config()
const app = express()
app.use(cors())
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
const verifyToken = async(req , res , next) =>{
        const {authorization} = req.headers
        // console.log(`${req.headers} | ${req.url}`);
        const token = authorization?.split(" ")[1]


        if(!token){
          return res.status(401).json({message:"Unauthorize"})
        }

          try {
    const JWKS = createRemoteJWKSet(
      new URL('http://localhost:3000/api/auth/jwks')
    )
    const { payload } = await jwtVerify(token, JWKS, {
    })
    // return payload
        req.user = payload;
    next();

  } catch (error) {
    console.error('Token validation failed:', error)
  }
      }

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db("StudyNook")
    const roomsData = db.collection("rooms")

    app.get("/rooms" , async(req , res)=>{
        const cursor = roomsData.find()
        const result = await cursor.toArray();
        res.send(result)
    })

                    // single data
    app.get("/rooms/:id" ,
      loggedIn,
      verifyToken,
      async(req , res)=>{
        const {id} = req.params;

        const query = {_id: new ObjectId(id)}
        const result =await roomsData.findOne(query)
        res.send(result)
    })


app.get("/visibleRooms", async (req, res) => {

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
