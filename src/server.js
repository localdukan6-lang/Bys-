
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 5000;

app.set("trust proxy", 1);

// ==================================================
// ENVIRONMENT VARIABLES
// ==================================================

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

// ==================================================
// POSTGRESQL
// ==================================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

pool.on("error", error => {
    console.error("PostgreSQL Pool Error:", error.message);
});

// ==================================================
// HELPERS
// ==================================================

const asyncHandler = fn =>
    (req, res, next) =>
        Promise.resolve(fn(req, res, next)).catch(next);

function safeText(value, maxLength = 1000) {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, maxLength);
}

function normalizeMobile(value) {
    let mobile = String(value || "").replace(/\D/g, "");

    if (mobile.length === 12 && mobile.startsWith("91")) {
        mobile = mobile.slice(2);
    }

    if (mobile.length === 11 && mobile.startsWith("0")) {
        mobile = mobile.slice(1);
    }

    return mobile;
}

function validMobile(value) {
    return /^[6-9]\d{9}$/.test(normalizeMobile(value));
}

function mobileFingerprint(mobile) {
    return crypto
        .createHmac("sha256", process.env.JWT_SECRET)
        .update(normalizeMobile(mobile))
        .digest("hex");
}

function safeEqual(a, b) {
    const first = Buffer.from(String(a || ""));
    const second = Buffer.from(String(b || ""));

    return first.length === second.length &&
        crypto.timingSafeEqual(first, second);
}

function formatJob(row) {
    if (!row) return null;

    return {
        ...(row.data || {}),
        _id: String(row.id),
        category: row.category,
        status: row.status,
        featured: row.featured,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function isAccepted(value) {
    return value === true ||
        value === "true" ||
        value === "on" ||
        value === "yes" ||
        value === "1";
}

function validEmail(email) {
    return !email ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ==================================================
// MIDDLEWARE
// ==================================================

app.use(helmet({
    contentSecurityPolicy: false
}));

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
        if (!origin) return callback(null, true);

        const normalized = origin.replace(/\/$/, "");

        if (allowedOrigins.includes(normalized)) {
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

app.use("/api", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
}));

app.use(express.static(path.join(__dirname, "../public")));

// ==================================================
// DATABASE INITIALIZATION
// ==================================================

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
            created_at TIMESTAMPTZ DEFAULT NOW(),
            synced_at TIMESTAMPTZ DEFAULT NULL
        );

        ALTER TABLE sync_queue
        ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT NULL;

        CREATE INDEX IF NOT EXISTS idx_sync_queue_type_id
        ON sync_queue(record_type, id);

        CREATE INDEX IF NOT EXISTS idx_sync_queue_retention
        ON sync_queue(created_at)
        WHERE record_type IN ('worker', 'application');

        CREATE TABLE IF NOT EXISTS form_dedup (
            record_type VARCHAR(30) NOT NULL,
            scope_key VARCHAR(100) NOT NULL,
            mobile_hash CHAR(64) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (
                record_type,
                scope_key,
                mobile_hash
            )
        );
    `);

    // Migrate existing records into permanent duplicate protection.
    const existing = await pool.query(`
        SELECT record_type, payload
        FROM sync_queue
        WHERE record_type IN ('worker', 'application')
    `);

    let migrated = 0;

    for (const row of existing.rows) {
        const payload = row.payload || {};
        const mobile = normalizeMobile(payload.mobile);

        if (!validMobile(mobile)) continue;

        let scopeKey = "worker";

        if (row.record_type === "application") {
            scopeKey = String(payload.jobId || "");

            if (!/^\d+$/.test(scopeKey)) continue;
        }

        const fingerprint = mobileFingerprint(mobile);

        const result = await pool.query(`
            INSERT INTO form_dedup (
                record_type,
                scope_key,
                mobile_hash
            )
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
        `, [
            row.record_type,
            scopeKey,
            fingerprint
        ]);

        migrated += result.rowCount;
    }

    console.log("PostgreSQL tables initialized.");
    console.log("Existing duplicate fingerprints migrated:", migrated);
}

// ==================================================
// CLOUD RETENTION
// Worker + Application records: 6 months
// Dedup fingerprints: Permanent
// Jobs: Never deleted by this cleanup
// ==================================================

async function cleanupExpiredRecords() {

    const result = await pool.query(`
        DELETE FROM sync_queue
        WHERE record_type IN ('worker', 'application')
          AND created_at < NOW() - INTERVAL '6 months'
        RETURNING id, record_type
    `);

    const workersDeleted = result.rows.filter(
        row => row.record_type === "worker"
    ).length;

    const applicationsDeleted = result.rows.filter(
        row => row.record_type === "application"
    ).length;

    if (result.rowCount > 0) {
        console.log("Cloud retention cleanup:", {
            workersDeleted,
            applicationsDeleted,
            totalDeleted: result.rowCount
        });
    }

    return result.rowCount;
}

// ==================================================
// ADMIN AUTHENTICATION
// ==================================================

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

// ==================================================
// OFFICE AUTHENTICATION
// ==================================================

function officeAuth(req, res, next) {

    const secret = req.headers["x-office-secret"];

    if (!safeEqual(secret, process.env.OFFICE_SYNC_SECRET)) {
        return res.status(401).json({
            message: "Invalid office credentials."
        });
    }

    next();
}

// ==================================================
// ADMIN LOGIN
// ==================================================

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

        const userMatches = safeEqual(username, expectedUser);
        const passwordMatches = safeEqual(
            password,
            process.env.ADMIN_PASSWORD
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
            { expiresIn: "8h" }
        );

        res.json({
            token,
            username: expectedUser
        });
    })
);

// ==================================================
// WORKER REGISTRATION
// One mobile = One registration permanently
// All fields saved in JSONB
// ==================================================

app.post(
    "/api/workers/register",

    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 15,
        standardHeaders: true,
        legacyHeaders: false
    }),

    asyncHandler(async (req, res) => {

        const body = req.body || {};

        const mobile = normalizeMobile(body.mobile);
        const whatsapp = normalizeMobile(body.whatsapp);
        const alternateMobile = normalizeMobile(body.alternateMobile);

        const data = {

            registrationId:
                "WRK" +
                Date.now().toString().slice(-8) +
                crypto.randomBytes(3).toString("hex").toUpperCase(),

            // Personal Details
            name: safeText(body.name, 100),
            fatherName: safeText(body.fatherName, 100),
            motherName: safeText(body.motherName, 100),
            dob: safeText(body.dob, 20),
            gender: safeText(body.gender, 30),
            maritalStatus: safeText(body.maritalStatus, 50),
            category: safeText(body.category, 50),
            otherCategory: safeText(body.otherCategory, 100),
            nationality: safeText(body.nationality, 60),

            // Contact Details
            mobile,
            whatsapp,
            alternateMobile,
            email: safeText(body.email, 150).toLowerCase(),

            // Address Details
            country: safeText(body.country, 100),
            state: safeText(body.state, 100),
            district: safeText(body.district, 100),
            city: safeText(body.city, 100),
            tehsil: safeText(body.tehsil, 100),
            postOffice: safeText(body.postOffice, 100),
            pincode: safeText(body.pincode, 10),
            address: safeText(body.address, 500),

            // Education Details
            qualification: safeText(body.qualification, 100),
            otherQualification: safeText(body.otherQualification, 150),
            course: safeText(body.course, 150),
            institute: safeText(body.institute, 200),
            passingYear: safeText(body.passingYear, 10),
            percentage: safeText(body.percentage, 20),

            // Experience Details
            experience: safeText(body.experience, 100),
            employmentStatus: safeText(body.employmentStatus, 100),
            company: safeText(body.company, 150),
            designation: safeText(body.designation, 150),
            industry: safeText(body.industry, 100),
            otherIndustry: safeText(body.otherIndustry, 100),

            // Job Preferences
            workType: safeText(body.workType, 100),
            otherWorkType: safeText(body.otherWorkType, 100),
            preferredLocation: safeText(body.preferredLocation, 200),
            expectedSalary: safeText(body.expectedSalary, 50),
            preferredShift: safeText(body.preferredShift, 50),
            relocation: safeText(body.relocation, 50),

            // Skills
            skills: safeText(body.skills, 1000),
            message: safeText(body.message, 1000),

            consent: isAccepted(body.consent),
            status: "Pending"
        };

        // Required field validation
        if (
            !data.name ||
            !validMobile(data.mobile) ||
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
            (data.whatsapp && !validMobile(data.whatsapp)) ||
            (data.alternateMobile && !validMobile(data.alternateMobile))
        ) {
            return res.status(400).json({
                message: "Please enter valid mobile numbers."
            });
        }

        if (!validEmail(data.email)) {
            return res.status(400).json({
                message: "Please enter a valid email address."
            });
        }

        if (data.pincode && !/^\d{6}$/.test(data.pincode)) {
            return res.status(400).json({
                message: "Please enter a valid 6 digit PIN code."
            });
        }

        if (!data.consent) {
            return res.status(400).json({
                message: "Please accept the registration declaration."
            });
        }

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const fingerprint = mobileFingerprint(data.mobile);

            await client.query(
                `SELECT pg_advisory_xact_lock(
                    hashtextextended($1, 0)
                )`,
                [`worker:${fingerprint}`]
            );

            const dedupResult = await client.query(`
                INSERT INTO form_dedup (
                    record_type,
                    scope_key,
                    mobile_hash
                )
                VALUES ('worker', 'worker', $1)
                ON CONFLICT DO NOTHING
                RETURNING mobile_hash
            `, [fingerprint]);

            if (dedupResult.rowCount === 0) {
                await client.query("ROLLBACK");

                return res.status(409).json({
                    duplicate: true,
                    message: "आपका Worker Registration पहले से मौजूद है। एक मोबाइल नंबर से केवल एक Registration किया जा सकता है।"
                });
            }

            await client.query(`
                INSERT INTO sync_queue (record_type, payload)
                VALUES ('worker', $1::jsonb)
            `, [JSON.stringify(data)]);

            await client.query("COMMIT");

            res.status(201).json({
                success: true,
                message: "Worker registration submitted successfully.",
                registrationId: data.registrationId
            });

        } catch (error) {
            await client.query("ROLLBACK");
            throw error;

        } finally {
            client.release();
        }
    })
);

// ==================================================
// PUBLIC JOB LIST
// ==================================================

app.get(
    "/api/jobs",

    asyncHandler(async (req, res) => {

        const conditions = [];
        const values = [];

        if (["Government", "Private"].includes(req.query.category)) {
            values.push(req.query.category);
            conditions.push(`category = $${values.length}`);
        }

        if (req.query.status) {
            values.push(safeText(req.query.status, 60));
            conditions.push(`status = $${values.length}`);
        }

        if (req.query.q) {
            values.push(`%${safeText(req.query.q, 100)}%`);

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

// ==================================================
// SINGLE JOB DETAILS
// ==================================================

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

// ==================================================
// JOB APPLICATION
// One mobile = One application per Job
// ==================================================

app.post(
    "/api/jobs/:id/apply",

    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 20,
        standardHeaders: true,
        legacyHeaders: false
    }),

    asyncHandler(async (req, res) => {

        if (!/^\d+$/.test(req.params.id)) {
            return res.status(400).json({
                message: "Invalid job ID."
            });
        }

        const body = req.body || {};

        const applicantName = safeText(body.applicantName, 100);
        const mobile = normalizeMobile(body.mobile);
        const email = safeText(body.email, 150).toLowerCase();

        if (!applicantName || !validMobile(mobile)) {
            return res.status(400).json({
                message: "Please enter your name and valid 10 digit mobile number."
            });
        }

        if (!validEmail(email)) {
            return res.status(400).json({
                message: "Please enter a valid email address."
            });
        }

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const jobResult = await client.query(
                "SELECT * FROM jobs WHERE id = $1",
                [req.params.id]
            );

            if (!jobResult.rows.length) {
                await client.query("ROLLBACK");

                return res.status(404).json({
                    message: "Job not found."
                });
            }

            const job = formatJob(jobResult.rows[0]);

            if ([
                "Application Closed",
                "Result Declared"
            ].includes(job.status)) {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    message: "Applications are closed for this job."
                });
            }

            const fingerprint = mobileFingerprint(mobile);
            const scopeKey = String(job._id);

            await client.query(
                `SELECT pg_advisory_xact_lock(
                    hashtextextended($1, 0)
                )`,
                [`application:${scopeKey}:${fingerprint}`]
            );

            const dedupResult = await client.query(`
                INSERT INTO form_dedup (
                    record_type,
                    scope_key,
                    mobile_hash
                )
                VALUES ('application', $1, $2)
                ON CONFLICT DO NOTHING
                RETURNING mobile_hash
            `, [scopeKey, fingerprint]);

            if (dedupResult.rowCount === 0) {
                await client.query("ROLLBACK");

                return res.status(409).json({
                    duplicate: true,
                    message: "आप इस Job के लिए पहले ही आवेदन कर चुके हैं। दोबारा आवेदन नहीं किया जा सकता।"
                });
            }

            const applicationId =
                "BYS" +
                Date.now().toString().slice(-8) +
                crypto.randomBytes(3).toString("hex").toUpperCase();

            // Save all application fields.
            const payload = {
                applicationId,
                jobId: job._id,
                jobTitle: job.title || "",
                organization: job.organization || "",

                applicantName,
                fatherName: safeText(body.fatherName, 100),
                mobile,
                email,

                dob: safeText(body.dob, 20),
                gender: safeText(body.gender, 30),
                qualification: safeText(body.qualification, 100),

                experienceStatus: safeText(body.experienceStatus, 100),
                experienceYears: safeText(body.experienceYears, 50),
                company: safeText(body.company, 150),

                address: safeText(body.address, 500),
                district: safeText(body.district, 100),
                state: safeText(body.state, 100),
                pincode: safeText(body.pincode, 10),

                message: safeText(body.message, 1000),
                status: "Pending"
            };

            await client.query(`
                INSERT INTO sync_queue (record_type, payload)
                VALUES ('application', $1::jsonb)
            `, [JSON.stringify(payload)]);

            await client.query("COMMIT");

            res.status(201).json({
                success: true,
                message: "Application submitted successfully.",
                applicationId
            });

        } catch (error) {
            await client.query("ROLLBACK");
            throw error;

        } finally {
            client.release();
        }
    })
);

// ==================================================
// ADMIN: JOB MANAGEMENT
// ==================================================

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

        const category = ["Government", "Private"].includes(data.category)
            ? data.category
            : "Private";

        const status = safeText(data.status, 60) ||
            "Application Started";

        const result = await pool.query(`
            INSERT INTO jobs (data, category, status, featured)
            VALUES ($1::jsonb, $2, $3, $4)
            RETURNING *
        `, [
            JSON.stringify(data),
            category,
            status,
            data.featured === true
        ]);

        res.status(201).json(formatJob(result.rows[0]));
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

        const category = ["Government", "Private"].includes(data.category)
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

// ==================================================
// ADMIN: APPLICATIONS
// ==================================================

app.get(
    "/api/admin/applications",
    adminAuth,
    asyncHandler(async (req, res) => {

        const result = await pool.query(`
            SELECT id, payload, created_at, synced_at
            FROM sync_queue
            WHERE record_type = 'application'
            ORDER BY id DESC
        `);

        res.json(result.rows.map(row => ({
            _id: String(row.id),
            ...row.payload,
            createdAt: row.created_at,
            syncedAt: row.synced_at
        })));
    })
);

// ==================================================
// ADMIN: WORKERS
// ==================================================

app.get(
    "/api/admin/workers",
    adminAuth,
    asyncHandler(async (req, res) => {

        const result = await pool.query(`
            SELECT id, payload, created_at, synced_at
            FROM sync_queue
            WHERE record_type = 'worker'
            ORDER BY id DESC
        `);

        res.json(result.rows.map(row => ({
            _id: String(row.id),
            ...row.payload,
            createdAt: row.created_at,
            syncedAt: row.synced_at
        })));
    })
);

// ==================================================
// OFFICE: FETCH UNSYNCED RECORDS
// ==================================================

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
            WHERE
                record_type NOT IN ('worker', 'application')
                OR (
                    record_type IN ('worker', 'application')
                    AND synced_at IS NULL
                )
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

// ==================================================
// OFFICE: ACKNOWLEDGE SAVED RECORDS
// Mark synced, do not delete
// ==================================================

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

        const uniqueIds = [...new Set(ids.map(String))];

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const result = await client.query(`
                UPDATE sync_queue
                SET synced_at = COALESCE(synced_at, NOW())
                WHERE id = ANY($1::bigint[])
                  AND record_type IN ('worker', 'application')
                RETURNING id, record_type
            `, [uniqueIds]);

            await client.query("COMMIT");

            const workersMarkedSynced = result.rows.filter(
                row => row.record_type === "worker"
            ).length;

            const applicationsMarkedSynced = result.rows.filter(
                row => row.record_type === "application"
            ).length;

            res.json({
                message: "Acknowledgement processed successfully.",
                workersMarkedSynced,
                applicationsMarkedSynced,
                totalRecordsMarkedSynced: result.rowCount,
                cloudDeletion: "After 6 months"
            });

        } catch (error) {
            await client.query("ROLLBACK");
            throw error;

        } finally {
            client.release();
        }
    })
);

// ==================================================
// HEALTH CHECK
// ==================================================

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

// ==================================================
// ERROR HANDLER
// ==================================================

app.use((err, req, res, next) => {

    console.error("API Error:", err.message);

    if (err.code === "23505") {
        return res.status(409).json({
            duplicate: true,
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

// ==================================================
// START SERVER
// ==================================================

async function startServer() {

    try {

        await pool.query("SELECT NOW()");

        await initializeDatabase();

        // Clean expired records at startup.
        await cleanupExpiredRecords();

        app.listen(PORT, () => {

            console.log(`BYS ASSOCIATE JOB running on port ${PORT}`);
            console.log("Database: PostgreSQL");

            console.log("Worker Cloud Retention: 6 Months");
            console.log("Application Cloud Retention: 6 Months");

            console.log("Worker Duplicate Protection: Permanent");
            console.log("Application Duplicate Protection: Per Job, Permanent");

            console.log("Worker ACK: Mark Synced, Do Not Delete");
            console.log("Application ACK: Mark Synced, Do Not Delete");
        });

        // Run retention cleanup every hour.
        const cleanupTimer = setInterval(() => {

            cleanupExpiredRecords().catch(error => {
                console.error("Retention Cleanup Error:", error.message);
            });

        }, 60 * 60 * 1000);

        cleanupTimer.unref();

    } catch (error) {

        console.error("Server startup failed:", error);
        process.exit(1);
    }
}

startServer();
