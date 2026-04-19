require('dotenv').config();
// Line 1-5: Import the tools we installed
const express = require('express');        // Web server framework
const mysql = require('mysql2/promise');   // Database connection (async version)
const multer = require('multer');          // File upload handler
const csv = require('csv-parser');         // CSV file reader
const fs = require('fs');                  // File system (built into Node)
const cors = require('cors');              // Cross-origin requests
const axios = require('axios');  // NEW: HTTP client to talk to Ollama

// Line 7: Create the Express application
const app = express();

// Line 8: Allow frontend to talk to backend
app.use(cors());

// Line 9: Parse JSON bodies in requests
app.use(express.json());

// Line 11-20: Configure file upload
// 'uploads/' folder will store CSV files temporarily
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')  // Save files to 'uploads/' folder
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)  // Rename: timestamp-originalname.csv
    }
});
const upload = multer({ storage: storage });

// Line 22-30: Database connection pool
// Why pool? It keeps connections ready instead of opening/closing each time
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD || '',           // If your MySQL has no password, leave empty
    database: 'revenue_insight',
    waitForConnections: true,
    connectionLimit: 10,    // Max 10 simultaneous connections
    queueLimit: 0
});

// Line 32-34: Create uploads folder if it doesn't exist
if (!fs.existsSync('uploads/')) {
    fs.mkdirSync('uploads/');
}


// ============ NEW: AI REPORT GENERATOR FUNCTION ============
// This is the brain of your app. It reads data, talks to Ollama, saves the result.
async function generateReport(uploadId) {
    
    // Step 1: Ask MySQL for summary numbers
    const [stats] = await pool.execute(`
        SELECT 
            COUNT(*) as total_transactions,
            SUM(total_amount) as total_revenue,
            AVG(total_amount) as avg_order_value,
            COUNT(DISTINCT customer_id) as unique_customers
        FROM sales_records 
        WHERE upload_id = ?
    `, [uploadId]);
    
    const s = stats[0];
    
    // Step 2: Ask MySQL for top 3 products
    const [topProducts] = await pool.execute(`
        SELECT product_name, SUM(quantity) as total_sold
        FROM sales_records 
        WHERE upload_id = ?
        GROUP BY product_name
        ORDER BY total_sold DESC
        LIMIT 3
    `, [uploadId]);
    
    // Step 3: Build the prompt (the "question" we ask the AI)
    const productList = topProducts.map(p => `${p.product_name} (${p.total_sold} units)`).join(', ');
    
    const prompt = `
You are a senior business analyst writing for a small tea shop owner in India.
Analyze this sales data and respond with exactly 2 short paragraphs:
1. A summary of what the data shows.
2. One specific, actionable recommendation to increase revenue.

Data:
- Total Transactions: ${s.total_transactions}
- Total Revenue: ₹${Number(s.total_revenue).toFixed(2)}
- Average Order Value: ₹${Number(s.avg_order_value).toFixed(2)}
- Unique Customers: ${s.unique_customers}
- Top Products: ${productList}

Write in plain English. Be direct. No fluff.
`;
    
    // Step 4: Send to Ollama (localhost:11434 is where Ollama listens)
    const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'llama3.2',
        prompt: prompt,
        stream: false           // false = wait for full response, don't stream tokens
    });
    
    const aiText = response.data.response;
    
    // Step 5: Save the report to database
    await pool.execute(
        'INSERT INTO reports (upload_id, summary_text, recommendations) VALUES (?, ?, ?)',
        [uploadId, aiText, aiText]  // We store full text in both columns for now
    );
    
    return aiText;
}

// ============ UPLOAD ENDPOINT (MODIFIED) ============
// Line 36-65: THE UPLOAD ENDPOINT
// When someone POSTs to /upload with a file, this runs
app.post('/upload', upload.single('csvFile'), async (req, res) => {
    try {
        // req.file = the uploaded file info
        const filePath = req.file.path;
        const originalName = req.file.originalname;
        
        // For now, hardcode user_id as 1 (we'll add login later)
        const userId = 1;
        
        // Step 1: Record the upload in database
        const [uploadResult] = await pool.execute(
            'INSERT INTO uploads (user_id, filename, file_path) VALUES (?, ?, ?)',
            [userId, originalName, filePath]
        );
        const uploadId = uploadResult.insertId;  // MySQL gives us the new row's ID
        
        // Step 2: Parse CSV and insert rows
        const results = [];
        
        // Create a stream to read the file
        fs.createReadStream(filePath)
            .pipe(csv())  // Pass through CSV parser
            .on('data', async (row) => {
                // Each 'row' is one line from CSV
                // Expected columns: date, product, quantity, price, customer_id
                results.push(row);
            })
            .on('end', async () => {
                // All rows read. Now insert to database
                for (const row of results) {
                    await pool.execute(
                        'INSERT INTO sales_records (upload_id, transaction_date, product_name, quantity, unit_price, total_amount, customer_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [
                            uploadId,
                            row.date,
                            row.product,
                            parseInt(row.quantity),
                            parseFloat(row.price),
                            parseInt(row.quantity) * parseFloat(row.price),  // Calculate total
                            row.customer_id
                        ]
                    );
                }
                // ============ NEW: CALL THE AI ============
                const report = await generateReport(uploadId);

                res.json({
                    success: true,
                    message: `Uploaded ${results.length} records`,
                    uploadId: uploadId,
                    report: report          // NEW: AI analysis included in response
                });
            });
            
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Line 67-69: Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`AI Bridge active. Ollama must be running on port 11434.`);
});