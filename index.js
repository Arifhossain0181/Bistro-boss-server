const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb"); // ✅

require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection string
const uri = `mongodb+srv://${process.env.BD_USER}:${process.env.BD_PASS}@co.sb0kq7l.mongodb.net/?retryWrites=true&w=majority&appName=Co`;

// MongoDB client config
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();

    const db = client.db("bistrobd");
    const menuCollection = db.collection("menu");
    const userCollection = db.collection("users");
    const reviewsCollection = db.collection("remenu");
    const cartCollection = db.collection("carts");

    // ROUTES
    app.get("/", (req, res) => {
      res.send("✅ Server is up and running!");
    });

    app.get("/menu", async (req, res) => {
      console.log("📥 GET /menu called");
      try {
        const result = await menuCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("❌ Error in /menu:", error);
        res.status(500).send({ error: "Error fetching menu data" });
      }
    });

    // users related API
     app.get('/users' ,async (req,res) =>{
      const result = await userCollection.find().toArray()
      res.send(result)
     })

    app.post("/users", async (req, res) => {
      // insert email if user doesnt exists:
      // you can do this many ways (1 email unique 2 uPsert 3 simPle checking)
      try {
        const user = req.body;

        // check if user already exists by email
        const existingUser = await userCollection.findOne({
          email: user.email,
        });
        if (existingUser) {
          return res.send({ message: "User already exists", insertedId: null });
        }

        // insert new user
        const result = await userCollection.insertOne({
          name: user.name,
          email: user.email,
          photoURL: user.photoURL,
          role: "user",
          createdAt: new Date(),
        });

        res.send(result); // will have insertedId
      } catch (error) {
        console.error("❌ Error inserting user:", error);
        res.status(500).send({ error: "Failed to insert user" });
      }
    });

    app.get("/remenu", async (req, res) => {
      console.log("📥 GET /reviews called");
      try {
        const result = await reviewsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("❌ Error in /reviews:", error);
        res.status(500).send({ error: "Error fetching reviews data" });
      }
    });
    //carts collection
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find().toArray();
      res.send(result);
    });
    app.post("/carts", async (req, res) => {
      const cartitem = req.body;
      const result = await cartCollection.insertOne(cartitem);
      res.send(result);
    });
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // Ping test to MongoDB
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Successfully connected to MongoDB!");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
  }
}

run().catch(console.dir);

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
