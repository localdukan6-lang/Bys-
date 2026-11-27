
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 5000;

// --------------------------------------------------
// RENDER PROXY CONFIGURATION
// --------------------------------------------------

app.set("trust proxy", 1);

// --------------------------------------------------
// REQUIRED ENVIRONMENT VARIABLES
// --------------------------------------------------

const requiredEnv = [
    "DATABASE_URL",
    "JWT_SECRET",
    "ADMIN_PASSWORD",
    "OFFICE_SYNC_SECRET"
];

for (const key of requiredEnv) {
    if (!process.env[key]) {
        console.error(`Missing environment variable: ${key}`);
        process.exit(1);
    }
}

// --------------------------------------------------
// POSTGRESQL CONNECTION
// --------------------------------------------------

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    ssl: process.env.PGSSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,

    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

pool.on("error", (error) => {
    console.error("PostgreSQL Pool Error:", error.message);
});

// --------------------------------------------------
// ASYNC HANDLER
// --------------------------------------------------

const asyncHandler = fn =>
    (req, res, next) =>
        Promise.resolve(fn(req, res, next)).catch(next);

// --------------------------------------------------
// MIDDLEWARE
// --------------------------------------------------

app.use(helmet({
    contentSecurityPolicy: false
}));

// Allowed Website Origins
const defaultOrigins = [
    "https://bys-public.vercel.app",
    "https://www.bysassociatejob.com",
    "https://bysassociatejob.com"
];

const environmentOrigins = (process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

const allowedOrigins = [
    ...new Set([
        ...defaultOrigins,
        ...environmentOrigins
    ].map(origin => origin.replace(/\/$/, "")))
];

console.log("Allowed Website Origins:", allowedOrigins);

app.use(cors({
    origin(origin, callback) {

        // Allow requests without browser Origin
        if (!origin) {
            return callback(null, true);
        }

        const normalizedOrigin = origin.replace(/\/$/, "");

        if (allowedOrigins.includes(normalizedOrigin)) {
            return callback(null, true);
        }

        console.log("Blocked Website Origin:", origin);

        return callback(new Error("Origin not allowed by CORS"));
    },

    credentials: true,
    optionsSuccessStatus: 204
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Global API Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
});

app.use("/api", apiLimiter);

app.use(express.static(path.join(__dirname, "../public")));

// --------------------------------------------------
// DATABASE TABLES
// --------------------------------------------------

async function initializeDatabase() {

    await pool.query(`
        CREATE TABLE IF NOT EXISTS jobs (
            id BIGSERIAL PRIMARY KEY,
            data JSONB NOT NULL,
            category VARCHAR(30) DEFAULT 'Private',
            status VARCHAR(60) DEFAULT 'Application Started',
            featured BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_jobs_created
        ON jobs(created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_jobs_category
        ON jobs(category);

        CREATE TABLE IF NOT EXISTS sync_queue (
            id BIGSERIAL PRIMARY KEY,
            record_type VARCHAR(30) NOT NULL,
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_sync_queue_type_id
        ON sync_queue(record_type, id);
    `);

    console.log("PostgreSQL tables initialized.");
}

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function formatJob(row) {

    if (!row) return null;

    return {
        ...row.data,
        _id: String(row.id),
        category: row.category,
        status: row.status,
        featured: row.featured,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function safeText(value, maxLength = 1000) {

    if (typeof value !== "string") return "";

    return value.trim().slice(0, maxLength);
}

function validMobile(value) {

    return /^[6-9]\d{9}$/.test(String(value || ""));
}

function safeEqual(a, b) {

    const first = Buffer.from(String(a || ""));
    const second = Buffer.from(String(b || ""));

    return first.length === second.length &&
        crypto.timingSafeEqual(first, second);
}

// --------------------------------------------------
// ADMIN AUTHENTICATION
// --------------------------------------------------

function adminAuth(req, res, next) {

    const token = (req.headers.authorization || "")
        .replace(/^Bearer\s+/i, "");

    if (!token) {
        return res.status(401).json({
            message: "Admin login required."
        });
    }

    try {

        const payload = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        if (payload.role !== "admin") {
            throw new Error("Invalid role");
        }

        req.admin = payload;

        next();

    } catch {

        return res.status(401).json({
            message: "Session expired. Please login again."
        });
    }
}

// --------------------------------------------------
// OFFICE AUTHENTICATION
// --------------------------------------------------

function officeAuth(req, res, next) {

    const secret = req.headers["x-office-secret"];

    if (!safeEqual(secret, process.env.OFFICE_SYNC_SECRET)) {
        return res.status(401).json({
            message: "Invalid office credentials."
        });
    }

    next();
}

// --------------------------------------------------
// ADMIN LOGIN
// --------------------------------------------------

app.post(
    "/api/admin/login",

    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        standardHeaders: true,
        legacyHeaders: false
    }),

    asyncHandler(async (req, res) => {

        const { username, password } = req.body || {};

        const expectedUser = process.env.ADMIN_USERNAME || "admin";

        const userMatches = safeEqual(
            username,
            expectedUser
        );

        const passwordMatches =
            typeof password === "string" &&
            await bcrypt.compare(
                password,
                await bcrypt.hash(process.env.ADMIN_PASSWORD, 10)
            );

        if (!userMatches || !passwordMatches) {
            return res.status(401).json({
                message: "Wrong username or password."
            });
        }

        const token = jwt.sign(
            {
                role: "admin",
                username: expectedUser
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "8h"
            }
        );

        res.json({
            token,
            username: expectedUser
        });
    })
);

// --------------------------------------------------
// PUBLIC JOB LIST
// --------------------------------------------------

app.get(
    "/api/jobs",

    asyncHandler(async (req, res) => {

        const conditions = [];
        const values = [];

        if (["Government", "Private"].includes(req.query.category)) {

            values.push(req.query.category);

            conditions.push(
                `category = $${values.length}`
            );
        }

        if (req.query.status) {

            values.push(
                safeText(req.query.status, 60)
            );

            conditions.push(
                `status = $${values.length}`
            );
        }

        if (req.query.q) {

            values.push(
                `%${safeText(req.query.q, 100)}%`
            );

            const index = values.length;

            conditions.push(`
                (
                    data->>'title' ILIKE $${index}
                    OR data->>'organization' ILIKE $${index}
                    OR data->>'qualification' ILIKE $${index}
                )
            `);
        }

        const where = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const result = await pool.query(`
            SELECT *
            FROM jobs
            ${where}
            ORDER BY featured DESC, created_at DESC
        `, values);

        res.json(result.rows.map(formatJob));
    })
);

// --------------------------------------------------
// SINGLE JOB
// --------------------------------------------------

app.get(
    "/api/jobs/:id",

    asyncHandler(async (req, res) => {

        if (!/^\d+$/.test(req.params.id)) {
            return res.status(400).json({
                message: "Invalid job ID."
            });
        }

        const result = await pool.query(
            "SELECT * FROM jobs WHERE id = $1",
            [req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                message: "Job not found."
            });
        }

        res.json(formatJob(result.rows[0]));
    })
);

// --------------------------------------------------
// JOB APPLICATION
// --------------------------------------------------

app.post(
    "/api/jobs/:id/apply",

    asyncHandler(async (req, res) => {

        if (!/^\d+$/.test(req.params.id)) {
            return res.status(400).json({
                message: "Invalid job ID."
            });
        }

        const jobResult = await pool.query(
            "SELECT * FROM jobs WHERE id = $1",
            [req.params.id]
        );

        if (!jobResult.rows.length) {
            return res.status(404).json({
                message: "Job not found."
            });
        }

        const job = formatJob(jobResult.rows[0]);

        if ([
            "Application Closed",
            "Result Declared"
        ].includes(job.status)) {

            return res.status(400).json({
                message: "Applications are closed for this job."
            });
        }

        const applicantName = safeText(
            req.body.applicantName,
            100
        );

        const mobile = safeText(
            req.body.mobile,
            15
        );

        if (!applicantName || !validMobile(mobile)) {

            return res.status(400).json({
                message: "Please enter your name and valid 10 digit mobile number."
            });
        }

        const applicationId =
            "BYS" +
            Date.now().toString().slice(-8) +
            crypto.randomBytes(3).toString("hex").toUpperCase();

        const payload = {

            applicationId,

            jobId: job._id,

            jobTitle: job.title || "",

            organization: job.organization || "",

            applicantName,

            mobile,

            email: safeText(
                req.body.email,
                150
            ).toLowerCase(),

            qualification: safeText(
                req.body.qualification,
                100
            ),

            message: safeText(
                req.body.message,
                1000
            ),

            status: "Pending"
        };

        await pool.query(
            `INSERT INTO sync_queue (record_type, payload)
             VALUES ('application', $1::jsonb)`,
            [JSON.stringify(payload)]
        );

        res.status(201).json({
            message: "Application submitted successfully.",
            applicationId
        });
    })
);

// --------------------------------------------------
// WORKER REGISTRATION
// --------------------------------------------------

app.post(
    "/api/workers/register",

    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 15,
        standardHeaders: true,
        legacyHeaders: false
    }),

    asyncHandler(async (req, res) => {

        const data = {

            registrationId:
                "WRK" +
                Date.now().toString().slice(-8) +
                crypto.randomBytes(3).toString("hex").toUpperCase(),

            name: safeText(req.body.name, 100),

            mobile: safeText(req.body.mobile, 10),

            whatsapp: safeText(req.body.whatsapp, 10),

            email: safeText(req.body.email, 150).toLowerCase(),

            state: safeText(req.body.state, 100),

            district: safeText(req.body.district, 100),

            address: safeText(req.body.address, 500),

            qualification: safeText(req.body.qualification, 100),

            experience: safeText(req.body.experience, 100),

            workType: safeText(req.body.workType, 100),

            message: safeText(req.body.message, 1000),

            status: "Pending"
        };

        if (
            !data.name ||
            !validMobile(data.mobile) ||
            (data.whatsapp && !validMobile(data.whatsapp)) ||
            !data.state ||
            !data.district ||
            !data.address ||
            !data.qualification ||
            !data.experience ||
            !data.workType
        ) {

            return res.status(400).json({
                message: "Please enter all required details correctly."
            });
        }

        if (
            data.email &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
        ) {

            return res.status(400).json({
                message: "Please enter a valid email address."
            });
        }

        await pool.query(
            `INSERT INTO sync_queue (record_type, payload)
             VALUES ('worker', $1::jsonb)`,
            [JSON.stringify(data)]
        );

        res.status(201).json({
            message: "Worker registration submitted successfully.",
            registrationId: data.registrationId
        });
    })
);

// --------------------------------------------------
// ADMIN: JOB MANAGEMENT
// --------------------------------------------------

app.get(
    "/api/admin/jobs",

    adminAuth,

    asyncHandler(async (req, res) => {

        const result = await pool.query(
            "SELECT * FROM jobs ORDER BY created_at DESC"
        );

        res.json(result.rows.map(formatJob));
    })
);

// ADD JOB
app.post(
    "/api/admin/jobs",

    adminAuth,

    asyncHandler(async (req, res) => {

        const data = req.body || {};

        if (!safeText(data.title, 200)) {
            return res.status(400).json({
                message: "Job title is required."
            });
        }

        const category = [
            "Government",
            "Private"
        ].includes(data.category)
            ? data.category
            : "Private";

        const status = safeText(data.status, 60) ||
            "Application Started";

        const featured = data.featured === true;

        const result = await pool.query(`
            INSERT INTO jobs (data, category, status, featured)
            VALUES ($1::jsonb, $2, $3, $4)
            RETURNING *
        `, [
            JSON.stringify(data),
            category,
            status,
            featured
        ]);

        res.status(201).json(
            formatJob(result.rows[0])
        );
    })
);

// UPDATE JOB
app.put(
    "/api/admin/jobs/:id",

    adminAuth,

    asyncHandler(async (req, res) => {

        if (!/^\d+$/.test(req.params.id)) {
            return res.status(400).json({
                message: "Invalid job ID."
            });
        }

        const data = req.body || {};

        if (!safeText(data.title, 200)) {
            return res.status(400).json({
                message: "Job title is required."
            });
        }

        const category = [
            "Government",
            "Private"
        ].includes(data.category)
            ? data.category
            : "Private";

        const status = safeText(data.status, 60) ||
            "Application Started";

        const result = await pool.query(`
            UPDATE jobs
            SET data = $1::jsonb,
                category = $2,
                status = $3,
                featured = $4,
                updated_at = NOW()
            WHERE id = $5
            RETURNING *
        `, [
            JSON.stringify(data),
            category,
            status,
            data.featured === true,
            req.params.id
        ]);

        if (!result.rows.length) {
            return res.status(404).json({
                message: "Job not found."
            });
        }

        res.json(formatJob(result.rows[0]));
    })
);

// DELETE JOB
app.delete(
    "/api/admin/jobs/:id",

    adminAuth,

    asyncHandler(async (req, res) => {

        if (!/^\d+$/.test(req.params.id)) {
            return res.status(400).json({
                message: "Invalid job ID."
            });
        }

        // Existing sync queue records are not deleted.
        const result = await pool.query(
            "DELETE FROM jobs WHERE id = $1 RETURNING id",
            [req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                message: "Job not found."
            });
        }

        res.json({
            message: "Job deleted. Existing applications are preserved."
        });
    })
);

// --------------------------------------------------
// ADMIN: PENDING APPLICATIONS
// --------------------------------------------------

app.get(
    "/api/admin/applications",

    adminAuth,

    asyncHandler(async (req, res) => {

        const result = await pool.query(`
            SELECT id, payload, created_at
            FROM sync_queue
            WHERE record_type = 'application'
            ORDER BY id DESC
        `);

        res.json(result.rows.map(row => ({
            _id: String(row.id),
            ...row.payload,
            createdAt: row.created_at
        })));
    })
);

// --------------------------------------------------
// ADMIN: PENDING WORKER REGISTRATIONS
// --------------------------------------------------

app.get(
    "/api/admin/workers",

    adminAuth,

    asyncHandler(async (req, res) => {

        const result = await pool.query(`
            SELECT id, payload, created_at
            FROM sync_queue
            WHERE record_type = 'worker'
            ORDER BY id DESC
        `);

        res.json(result.rows.map(row => ({
            _id: String(row.id),
            ...row.payload,
            createdAt: row.created_at
        })));
    })
);

// --------------------------------------------------
// OFFICE: FETCH QUEUE RECORDS
// --------------------------------------------------

app.get(
    "/api/office/sync",

    officeAuth,

    asyncHandler(async (req, res) => {

        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 100, 1),
            500
        );

        const result = await pool.query(`
            SELECT id, record_type, payload, created_at
            FROM sync_queue
            ORDER BY id ASC
            LIMIT $1
        `, [limit]);

        res.json({
            records: result.rows.map(row => ({
                id: String(row.id),
                type: row.record_type,
                payload: row.payload,
                createdAt: row.created_at
            }))
        });
    })
);

// --------------------------------------------------
// OFFICE: ACKNOWLEDGE SAVED RECORDS
// --------------------------------------------------

app.post(
    "/api/office/ack",

    officeAuth,

    asyncHandler(async (req, res) => {

        const ids = req.body?.ids;

        if (
            !Array.isArray(ids) ||
            ids.length < 1 ||
            ids.length > 500 ||
            !ids.every(id => /^\d+$/.test(String(id)))
        ) {

            return res.status(400).json({
                message: "Please provide valid queue IDs."
            });
        }

        const uniqueIds = [
            ...new Set(ids.map(String))
        ];

        const result = await pool.query(`
            DELETE FROM sync_queue
            WHERE id = ANY($1::bigint[])
            RETURNING id
        `, [uniqueIds]);

        res.json({
            message: "Acknowledgement processed.",
            deletedCount: result.rowCount
        });
    })
);

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get(
    "/api/health",

    asyncHandler(async (req, res) => {

        await pool.query("SELECT 1");

        res.json({
            ok: true,
            database: "PostgreSQL",
            name: "BYS ASSOCIATE JOB API"
        });
    })
);

// --------------------------------------------------
// ERROR HANDLER
// --------------------------------------------------

app.use((err, req, res, next) => {

    console.error("API Error:", err.message);

    if (err.code === "23505") {
        return res.status(409).json({
            message: "Duplicate record."
        });
    }

    if (err.message === "Origin not allowed by CORS") {
        return res.status(403).json({
            message: "Website origin is not allowed."
        });
    }

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({
        message: "Server error. Please try again later."
    });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

async function startServer() {

    try {

        await pool.query("SELECT NOW()");

        await initializeDatabase();

        app.listen(PORT, () => {
            console.log(
                `BYS ASSOCIATE JOB running on port ${PORT}`
            );
        });

    } catch (error) {

        console.error(
            "Server startup failed:",
            error.message
        );

        process.exit(1);
    }
}

startServer();
