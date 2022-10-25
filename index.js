const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.SK_SECRET_KEY);

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_PASS}@cluster0.26jpjro.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "unAuthorized Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    await client.connect();
    const serviceCollection = client
      .db("manufacturer-services")
      .collection("services");
    const bookingCollection = client
      .db("manufacturer-services")
      .collection("booking");
    const reviewCollection = client
      .db("manufacturer-services")
      .collection("review");
    const userCollection = client
      .db("manufacturer-services")
      .collection("user");
    const paymentCollection = client
      .db("manufacturer-services")
      .collection("payment");

    const verifyAdmin = (req, res, next) => {};

    app.get("/services", async (req, res) => {
      const query = {};
      const cursor = await serviceCollection.find(query).toArray();
      res.send(cursor);
    });

    // app.get("/services/:id",  async (req, res) => {
    //   const id = req.params.id;
    //   const query = {_id: ObjectId(id)};
    //   const service = await serviceCollection.findOne(query);
    //   console.log(id)
    //   res.send(service);
    // })

    app.post("/service", async (req, res) => {
      const service = req.body;
      const result = await serviceCollection.insertOne(service);
      res.send({ success: true, result });
    });

    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send({ success: true, result });
    });

    app.get("/booking", verifyJWT, async (req, res) => {
      const query = {};
      const booking = await bookingCollection.find(query).toArray();
      res.send(booking);
    });

    app.get("/booking/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded.email;
      if (email === decodedEmail) {
      } else {
        return res.status(404).send({ message: "forbidden" });
      }
      const query = { email };
      const booking = await bookingCollection.find(query).toArray();
      res.send(booking);
    });

    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          plot: user,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    app.get("/users", verifyJWT, async (req, res) => {
      const users = await userCollection.find({}).toArray();
      res.send(users);
    });

    app.get("/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    app.put("/user/admin/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    app.get("/bookingId/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const bookingID = await bookingCollection.findOne(query);
      res.send(bookingID);
    });

    app.patch('/booking/:id', verifyJWT, async(req,res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const payment = req.body;
      const updateDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId
         },
      };
      const updateBooking = await bookingCollection.updateOne(filter, updateDoc);
      const result = await paymentCollection.insertOne(payment);
      res.send(updateDoc);
    });

    app.post("/review", async (req, res) => {
      const review = req.body;
      const query = { email: req.body.email };
      const cursor = await reviewCollection.findOne(query);
      if (cursor) {
        return res.send({ success: false });
      }
      const result = await reviewCollection.insertOne(review);
      res.send({ success: true, result });
    });

    app.post("/payment", verifyJWT, async (req, res) => {
      const service = req.body;
      const amount = service.price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Running training session");
});

app.listen(port, () => {
  console.log("listening to port", port);
});
