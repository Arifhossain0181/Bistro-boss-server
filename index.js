const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIE_SECTET_KEY);
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
    await client.connect();

    const db = client.db("bistrobd");
    const menuCollection = db.collection("menu");
    const userCollection = db.collection("users");
    const reviewsCollection = db.collection("remenu");
    const cartCollection = db.collection("carts");
    const PaymentCollection = db.collection("Payment");

    // ✅ JWT Login
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // ✅ Middleware: Verify Token
    const verifyToken = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // ✅ Middleware: Verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";

      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // ✅ Routes
    app.get("/", (req, res) => {
      res.send("✅ Server is up and running!");
    });

    // Menu
    app.get("/menu", async (req, res) => {
      try {
        const result = await menuCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Error fetching menu data" });
      }
    });

    app.post("/menu", verifyToken, verifyToken, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    });
    //uPdate
    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);
    });
    app.patch("/menu/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recip: item.recip,
          image: item.imageUrl,
        },
      };
      const result =await menuCollection.updateOne(filter,updateDoc)
      res.send(result)
    });


    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    // Promote User to Admin
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role: "admin" } };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    // Delete User
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // Get All Users (Admin only)
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Check if User is Admin
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);

      let isAdmin = false;
      if (user) {
        isAdmin = user?.role === "admin";
      }
      res.send({ isAdmin });
    });

    // Create User
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const existingUser = await userCollection.findOne({
          email: user.email,
        });

        if (existingUser) {
          return res.send({ message: "User already exists", insertedId: null });
        }

        const result = await userCollection.insertOne({
          name: user.name,
          email: user.email,
          photoURL: user.photoURL,
          role: "user",
          createdAt: new Date(),
        });

        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to insert user" });
      }
    });

    // Reviews
    app.get("/remenu", async (req, res) => {
      try {
        const result = await reviewsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Error fetching reviews data" });
      }
    });

    // Carts
    app.get("/carts", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).send({ error: "Email is required" });
      }
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", verifyToken, async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    app.delete("/carts/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });
  
    ///Payment intent
   app.post('/create-payment-intent', async (req, res) => {
  try {
    const { price } = req.body;
    const amount = parseInt(price * 100);

    console.log(amount, 'amount inside the intent');

    // ✅ use paymentIntents (plural) not PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method_types: ['card'], // ✅ correct spelling
    });

    res.send({
      clientSecret: paymentIntent.client_secret, // ✅ correct property
    });
  } catch (error) {
    console.error("Stripe Error:", error.message);
    res.status(500).send({ error: error.message });
  }
});
//Payment related API
 app.get('/Payment/:email' ,verifyToken,async (req,res) =>{
  const query = {email: req.params.email}
  if(req.params.email !== req.decoded.email){
    return res.status(403).send({message :'frobidden'})
  }
  const result = await PaymentCollection.find(query).toArray()
  res.send(result)
 })

app.post('/Payment',async (req,res) =>{
  const Payment = req.body;
  const Paymentresult = await PaymentCollection.insertOne(Payment)

  /// carefully delete each item from the cart
  const query = {_id: {
    $in:Payment.cartIds.map(id => new ObjectId(id))
  }};
  const deleteresult = await cartCollection.deleteMany(query)
  res.send(Paymentresult,deleteresult)
})



    // ✅ MongoDB Ping
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Successfully connected to MongoDB!");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
  }
}

run().catch(console.dir);

// Start Server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
