const express = require("express");
const fs = require("fs");
const { Client } = require("pg");

const app = express();
app.use(express.json());

// PostgreSQL Client Configuration
const dbClient = new Client({
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    host: process.env.DB_HOST || "test-statefulset-service",
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || "testdb"
});

let isDbConnected = false;

// Function to connect and initialize database
async function initializeDatabase() {
    try {
        await dbClient.connect();
        console.log("✅ Connected to PostgreSQL");
        isDbConnected = true;
        
        // Create table if it doesn't exist
        await dbClient.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("✅ Users table ready");
    } catch (err) {
        console.error("❌ Database initialization error:", err.message);
        isDbConnected = false;
        // Retry after 5 seconds
        setTimeout(initializeDatabase, 5000);
    }
}

// Initialize database on startup
initializeDatabase();

app.get("/", (req, res) => {
    let message = process.env.APP_MESSAGE || "No ConfigMap";
    let password = process.env.APP_PASSWORD || "No Secret";

    let fileData = "File not found";
    try {
        fileData = fs.readFileSync("/data/info.txt", "utf8");
    } catch {}

    res.json({
        messageFromConfigMap: message,
        secretPassword: password,
        podName: process.env.HOSTNAME,   // to test StatefulSet identity
        pvFileContent: fileData
    });
});

// readiness probe
app.get("/ready", (req, res) => {
    res.send("READY");
});

// liveness probe
app.get("/live", (req, res) => {
    res.send("ALIVE");
});


app.get("/checking", (req, res) => {
    res.send(`configMap message is: ${process.env.APP_MESSAGE || "No ConfigMap"} And secret password is: ${process.env.APP_PASSWORD || "No Secret"}`);
});

// Database API Endpoints

// GET all users
app.get("/users", async (req, res) => {
    if (!isDbConnected) {
        return res.status(503).json({
            success: false,
            error: "Database not connected yet. Please try again in a moment."
        });
    }
    try {
        const result = await dbClient.query("SELECT * FROM users ORDER BY created_at DESC");
        res.json({
            success: true,
            data: result.rows,
            count: result.rows.length
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// GET user by ID
app.get("/users/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await dbClient.query("SELECT * FROM users WHERE id = $1", [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// POST - Create a new user
app.post("/users", async (req, res) => {
    if (!isDbConnected) {
        return res.status(503).json({
            success: false,
            error: "Database not connected yet. Please try again in a moment."
        });
    }
    try {
        const { name, email } = req.body;
        
        if (!name || !email) {
            return res.status(400).json({
                success: false,
                error: "Name and email are required"
            });
        }
        
        const result = await dbClient.query(
            "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
            [name, email]
        );
        
        res.status(201).json({
            success: true,
            message: "User created successfully",
            data: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// PUT - Update user
app.put("/users/:id", async (req, res) => {
    if (!isDbConnected) {
        return res.status(503).json({
            success: false,
            error: "Database not connected yet. Please try again in a moment."
        });
    }
    try {
        const { id } = req.params;
        const { name, email } = req.body;
        
        if (!name || !email) {
            return res.status(400).json({
                success: false,
                error: "Name and email are required"
            });
        }
        
        const result = await dbClient.query(
            "UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING *",
            [name, email, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }
        
        res.json({
            success: true,
            message: "User updated successfully",
            data: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// DELETE - Delete user
app.delete("/users/:id", async (req, res) => {
    if (!isDbConnected) {
        return res.status(503).json({
            success: false,
            error: "Database not connected yet. Please try again in a moment."
        });
    }
    try {
        const { id } = req.params;
        
        const result = await dbClient.query(
            "DELETE FROM users WHERE id = $1 RETURNING *",
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }
        
        res.json({
            success: true,
            message: "User deleted successfully",
            data: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// GET database status
app.get("/db-status", async (req, res) => {
    try {
        const result = await dbClient.query("SELECT NOW() as current_time, version() as db_version");
        res.json({
            success: true,
            message: "Database is connected",
            data: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: "Database connection failed",
            details: err.message
        });
    }
});

app.listen(3030, () => {
    console.log("App running on port 3030");
});
