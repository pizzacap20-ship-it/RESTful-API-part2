let express = require("express");
let path = require("path");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { DATABASE_URL, SECRET_KEY } = process.env;

let app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    require: true,
  },
});

async function getPostgresVersion() {
  const client = await pool.connect();
  try {
    const response = await client.query("SELECT version()");
    console.log(response.rows[0]);
  } finally {
    client.release();
  }
}

getPostgresVersion();

// Signup endpoint
app.post("/signup", async (req, res) => {
  const client = await pool.connect();
  try {
    // Hash the password and check existence of username
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check for existing username
    const userResult = await client.query(
      "SELECT * FROM users WHERE username = $1",
      [username],
    );

    // If username already exists, return response
    if (userResult.rows.length > 0) {
      return res.status(400).json({ message: "Username already taken" });
    }
    // username doesn't exist, then we proceed with the rest of the code
    await client.query(
      "INSERT INTO users (username, password) VALUES ($1, $2)",
      [username, hashedPassword],
    );

    res.status(200).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error: ", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Log in endpoint
app.post("/login", async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT * FROM users WHERE username = $1",
      [req.body.username],
    );
    const user = result.rows[0];

    if (!user)
      return res
        .status(400)
        .json({ message: "Username or password incorrect" });

    const passwordIsValid = await bcrypt.compare(
      req.body.password,
      user.password,
    );
    if (!passwordIsValid)
      return res.status(401).json({ auth: false, token: null });

    var token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, {
      expiresIn: 86400,
    });
    res.status(200).json({ auth: true, token: token });
  } catch (error) {
    console.error("Error: ", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Create a new post and save it to the database
app.post("/posts", async (req, res) => {
  const client = await pool.connect();
  try {
    const data = {
      title: req.body.title,
      content: req.body.content,
      author: req.body.author,
      created_at: new Date().toISOString(),
    };

    const query = `INSERT INTO posts (title, content, author, created_at) VALUES ($1, $2, $3, $4) RETURNING id`;
    const params = [data.title, data.content, data.author, data.created_at];

    const result = await client.query(query, params);
    data.id = result.rows[0].id; //assign the last inserted id to data object

    console.log(`Post created successfully with id ${data.id}`);
    res.json({
      status: "success",
      data: data,
      message: "Post created successfully",
    });
  } catch (error) {
    console.error("Error: ", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Fetch all posts
app.get("/posts", async (req, res) => {
  const client = await pool.connect();
  try {
    const query = "SELECT * FROM posts";
    const result = await client.query(query);
    res.json(result.rows);
  } catch (err) {
    console.log(err.stack);
    res.status(500).send("An error occurred");
  } finally {
    client.release();
  }
});

// Update a post
app.put("/posts/:id", async (req, res) => {
  const id = req.params.id;
  const updatedData = req.body;
  const client = await pool.connect();
  try {
    const updateQuery =
      "UPDATE posts Set title = $1, content = $2, author = $3 WHERE id = $4";
    const queryData = [
      updatedData.title,
      updatedData.content,
      updatedData.author,
      id,
    ];
    await client.query(updateQuery, queryData);
    res.json({ status: "success", message: "Post updated successfully" });
  } catch (error) {
    console.error("Error: ", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Delete a post
app.delete("/posts/:id", async (req, res) => {
  const id = req.params.id;
  const client = await pool.connect();
  try {
    const deleteQuery = "DELETE FROM posts WHERE id  = $1";
    await client.query(deleteQuery, [id]);
    res.json({ status: "success", message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error: ", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Delete a post using author name
app.delete("/posts/author/:authorName", async (req, res) => {
  const authorName = req.params.authorName;
  const client = await pool.connect();
  try {
    const deleteAuthor = "DELETE FROM posts WHERE author = $1";
    const result = await client.query(deleteAuthor, [authorName]);
    if (result.rowCount === 0) {
      res.status(404).json({ status: "error", message: "Post not found" });
    }
    res.json({
      status: "success",
      message: `All posts by ${authorName} deleted`,
    });
  } catch (error) {
    console.error("Error", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get a post using id
app.get("/posts/:id", async (req, res) => {
  const id = req.params.id;
  const client = await pool.connect();
  try {
    const query = "SELECT * FROM posts WHERE id = $1";
    const result = await client.query(query, [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ status: "error", message: "Post not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error: ", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get a post using author name
app.get("/posts/author/:authorName", async (req, res) => {
  const authorName = req.params.authorName;
  const client = await pool.connect();
  try {
    const queryAuthor = "SELECT * FROM posts WHERE author = $1";
    const result = await client.query(queryAuthor, [authorName]);
    if (result.rows.length === 0) {
      res.status(404).json({ status: "error", message: "Post not found" });
    }
    res.json(result.rows);
  } catch (error) {
    console.error("Error: ", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get a post using date range
app.get("/posts/dates/:startDate/:endDate", async (req, res) => {
  const startDate = req.params.startDate;
  const endDate = req.params.endDate;
  const client = await pool.connect();
  try {
    const queryDate = "SELECT * FROM posts WHERE created_at BETWEEN $1 AND $2 ";
    const result = await client.query(queryDate, [startDate, endDate]);
    if (result.rows.length === 0) {
      res
        .status(404)
        .json({ status: "error", message: "no posts found in this range" });
    }
    res.json(result.rows);
  } catch (error) {
    console.error("Error: ", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get("/username", (req, res) => {
  // Check if the Authorization Bearer token was provided
  const authToken = req.headers.authorization;

  if (!authToken) return res.status(401).json({ error: "Access Denied" })

  try {
    // Verify the token and fetch the user information
    const verified = jwt.verify(authToken, SECRET_KEY);
    res.json({
      username: verified.username // Here, fetching the username from the token
    })
  } catch (err) {
    // Return an error if the token is not valid
    res.status(400).json({ error: "Invalid Token"})
  }
})

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname + "/index.html"));
  // res.sendFile(path.join('/home/runner/RESTful-API' + '/index.html'))
  // res.sendFile(path.join('/home/runner/RESTful-API/index.html'))
});

// Catch 404 and forward to error handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname + "/404.html"));
});

app.listen(3000, () => {
  console.log("App is listening on port 3000");
});
