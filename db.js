const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Agents Table
        db.run(`CREATE TABLE IF NOT EXISTS agents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            phone TEXT,
            cnic TEXT,
            territory TEXT,
            status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Active', 'Suspended')),
            profile_photo TEXT,
            cnic_document TEXT,
            terms_accepted BOOLEAN DEFAULT 0,
            commission_rate REAL DEFAULT 10.0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Customers Table (Added status)
        db.run(`CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            business_name TEXT NOT NULL,
            owner_name TEXT,
            email TEXT CHECK(email IS NOT NULL OR email != '') , -- Can be null now, handled by logic to ensure some uniqueness or dummy
            password TEXT NOT NULL, // Can be hash of 'default' for leads
            phone TEXT,
            address TEXT,
            business_type TEXT,
            status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Lead', 'Inactive')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            location_lat REAL,
            location_lng REAL,
            qr_code_url TEXT
        )`, (err) => {
            if (!err) {
                const cols = [
                    'ALTER TABLE customers ADD COLUMN status TEXT DEFAULT "Active"',
                    'ALTER TABLE customers ADD COLUMN location_lat REAL',
                    'ALTER TABLE customers ADD COLUMN location_lng REAL',
                    'ALTER TABLE customers ADD COLUMN qr_code_url TEXT'
                ];
                cols.forEach(q => db.run(q, () => { }));
            }
        });

        // Services Table
        db.run(`CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER,
            agent_id INTEGER,
            service_type TEXT,
            status TEXT DEFAULT 'Requested' CHECK(status IN ('Requested', 'Scheduled', 'In Progress', 'Completed', 'Cancelled')),
            request_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            scheduled_date DATETIME,
            completed_date DATETIME,
            amount REAL DEFAULT 0,
            commission REAL DEFAULT 0,
            notes TEXT,
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (agent_id) REFERENCES agents(id)
        )`);

        // Extinguishers Table (Detailed Inventory)
        db.run(`CREATE TABLE IF NOT EXISTS extinguishers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER,
            visit_id INTEGER,
            type TEXT,
            capacity TEXT,
            quantity INTEGER DEFAULT 1,
            install_date DATE,
            last_refill_date DATE,
            expiry_date DATE,
            condition TEXT, -- Good, Fair, Poor, Needs Replacement
            status TEXT, -- Valid, Expired
            certificate_photo TEXT,
            extinguisher_photo TEXT,
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (visit_id) REFERENCES visits(id)
        )`, (err) => {
            if (!err) {
                const cols = [
                    'ALTER TABLE extinguishers ADD COLUMN visit_id INTEGER',
                    'ALTER TABLE extinguishers ADD COLUMN condition TEXT',
                    'ALTER TABLE extinguishers ADD COLUMN extinguisher_photo TEXT'
                ];
                cols.forEach(q => db.run(q, () => { }));
            }
        });

        // Visits Table (Enhanced)
        db.run(`CREATE TABLE IF NOT EXISTS visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id INTEGER,
            customer_id INTEGER, -- Link to customer record
            customer_name TEXT, -- Fallback/Snapshot
            business_type TEXT,
            visit_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            risk_assessment TEXT,
            service_recommendations TEXT,
            follow_up_date DATE,
            status TEXT DEFAULT 'Completed',
            FOREIGN KEY (agent_id) REFERENCES agents(id),
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )`, (err) => {
            if (!err) {
                const cols = [
                    'ALTER TABLE visits ADD COLUMN customer_id INTEGER',
                    'ALTER TABLE visits ADD COLUMN risk_assessment TEXT',
                    'ALTER TABLE visits ADD COLUMN service_recommendations TEXT',
                    'ALTER TABLE visits ADD COLUMN status TEXT DEFAULT "Completed"'
                ];
                cols.forEach(q => db.run(q, () => { }));
            }
        });

        // Admin Table
        db.run(`CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT
        )`, (err) => {
            if (!err) {
                // Seed Super Admin
                const bcrypt = require('bcryptjs'); // Need to require this at top if not present, but better to just do it here for seed
                const adminEmail = 'admin@tradmak.com';
                const adminPass = 'admin@tradmak.com';
                const hashed = bcrypt.hashSync(adminPass, 8);

                db.get("SELECT id FROM admins WHERE email = ?", [adminEmail], (err, row) => {
                    if (!row) {
                        db.run("INSERT INTO admins (email, password, name) VALUES (?, ?, ?)", [adminEmail, hashed, 'Super Admin']);
                        console.log("Super Admin seeded.");
                    }
                });
            }
        });

        // Add Migrations for Agents Table (Location)
        const agentCols = [
            'ALTER TABLE agents ADD COLUMN location_lat REAL',
            'ALTER TABLE agents ADD COLUMN location_lng REAL',
            'ALTER TABLE agents ADD COLUMN last_active DATETIME'
        ];
        agentCols.forEach(q => db.run(q, () => { }));

    });
}

module.exports = db;
