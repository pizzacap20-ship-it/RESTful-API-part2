let express = require("express");
let path = require("path");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();
const { DATABASE_URL } = process.env;

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
  const authorName = req.params.authorName
  const client = await pool.connect()
  try {
    const deleteAuthor = "DELETE FROM posts WHERE author = $1"
    const result = await client.query(deleteAuthor, [authorName])
    if (result.rows.length === 0) {
      res.status(404).json({ status: "error", message: "Post not found"})
    }
    res.json({ status: 'success', message: `All posts by ${authorName} deleted`})
  } catch (error) {
    console.error("Error", error.message)
    res.status(500).json({ error: error.message })
  } finally {
    client.release()
  }
})

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
  const authorName = req.params.authorName
  const client = await pool.connect()
  try {
    const queryAuthor = "SELECT * FROM posts WHERE author = $1"
    const result = await client.query(queryAuthor, [authorName])
    if (result.rows.length === 0) {
      res.status(404).json({ status: "error", message: "Post not found"})
    }
    res.json(result.rows[0])
  } catch (error) {
    console.error("Error: ", error.message)
    res.status(500).json({ error: error.message})
  }
})

// Get a post using date range
app.get("/posts/dates/:startDate/:endDate", async (req, res) => {
  const startDate = req.params.startDate
  const endDate = req.params.endDate
  const client = await pool.connect()
  try {
    const queryDate = "SELECT * FROM posts WHERE created_at BETWEEN $1 AND $2 "
    const result = await client.query(queryDate, [startDate, endDate])
    if (result.rows.length === 0) {
      res.status(404).json({ status: "error", message: "no posts found in this range"})
    }
    res.json(result.rows)
  } catch (error) {
    console.error("Error: ", error.message)
    res.status(500).json({ error: error.message})
  } finally {
    client.release()
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
