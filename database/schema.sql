-- Users table (business owners who log in)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    business_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Uploaded data files
CREATE TABLE uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Parsed sales data (extracted from CSV)
CREATE TABLE sales_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    upload_id INT NOT NULL,
    transaction_date DATE,
    product_name VARCHAR(255),
    quantity INT,
    unit_price DECIMAL(10,2),
    total_amount DECIMAL(10,2),
    customer_id VARCHAR(100),
    FOREIGN KEY (upload_id) REFERENCES uploads(id)
);

-- AI-generated reports
CREATE TABLE reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    upload_id INT NOT NULL,
    summary_text TEXT NOT NULL,
    recommendations TEXT,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (upload_id) REFERENCES uploads(id)
);