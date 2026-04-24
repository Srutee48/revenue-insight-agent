// ============ DOM ELEMENTS ============
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileName');
const uploadBtn = document.getElementById('uploadBtn');
const statusDiv = document.getElementById('status');
const resultsDiv = document.getElementById('results');
const metricsDiv = document.getElementById('metrics');
const reportTextDiv = document.getElementById('reportText');

let selectedFile = null;

// ============ DRAG & DROP ============
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith('.csv')) {
        handleFile(files[0]);
    } else {
        showStatus('Please drop a CSV file', 'error');
    }
});

// ============ FILE INPUT ============
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    selectedFile = file;
    fileNameDisplay.textContent = file.name;
    uploadBtn.disabled = false;
    showStatus('Ready to upload', 'info');
}

// ============ UPLOAD & ANALYZE ============
uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Analyzing...';
    showStatus('Step 1/3: Uploading CSV...', 'info');
    
    const formData = new FormData();
    formData.append('csvFile', selectedFile);
    
    try {
        const response = await fetch('http://localhost:3000/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showStatus('Step 3/3: Analysis complete!', 'success');
            uploadBtn.textContent = 'Upload & Analyze';
            displayResults(data);
        } else {
            showStatus(`Error: ${data.error}`, 'error');
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload & Analyze';
        }
    } catch (error) {
        showStatus(`Connection failed. Is server running on localhost:3000?`, 'error');
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload & Analyze';
    }
});

function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
}

// ============ DISPLAY RESULTS (CORE LOGIC) ============
function displayResults(data) {
    resultsDiv.classList.remove('hidden');
    
    let report = data.report;
    
    // Strip markdown
    report = report
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#{1,6}\s?/g, '')
        .trim();
    
    // Split into sentences
    const sentences = report.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    
    // Find pivot
    let pivotIndex = -1;
    const adviceMarkers = [
        'i recommend', 'recommendation', 'should consider',
        'could improve', 'try offering', 'focus on',
        'implement', 'to increase revenue', 'one specific recommendation'
    ];
    
    for (let i = 0; i < sentences.length; i++) {
        const lower = sentences[i].toLowerCase();
        if (adviceMarkers.some(marker => lower.includes(marker))) {
            pivotIndex = i;
            break;
        }
    }
    
    if (pivotIndex === -1) pivotIndex = Math.floor(sentences.length / 2);
    
    const observationSentences = sentences.slice(0, pivotIndex);
    const adviceSentences = sentences.slice(pivotIndex);
    
    // Clean summary
    let summaryText = observationSentences.join(' ').trim();
    summaryText = summaryText
        .replace(/^based on the sales data, here('s| is) what i('ve| have) observed:?/i, '')
        .replace(/^here('s| is) what i('ve| have) observed:?/i, '')
        .replace(/^here('s| is) (the|my) analysis:?/i, '')
        .replace(/^summary of (the )?data\s*/i, '')
        .replace(/^data summary\s*/i, '')
        .replace(/^summary of the (sales )?data:?/i, '')
        .trim();
    
    // Clean recommendation
    let recommendationText = adviceSentences.join(' ').trim();
    recommendationText = recommendationText
        .replace(/^based on this data, i recommend that you consider/i, 'Consider')
        .replace(/^based on (this|the) data[,:]?\s*/i, '')
        .replace(/^i recommend that you\s*/i, '')
        .replace(/^actionable recommendation\s*/i, '')
        .replace(/^recommendation\s*/i, '')
        .replace(/^to increase revenue[,:]?\s*/i, '')
        .replace(/^however[,:]?\s*/i, '')
        .replace(/^one specific recommendation to boost revenue is to focus on/i, 'Focus on')
        .trim();
    
    // Build HTML
    let html = '';
    if (summaryText) {
        html += `<div class="report-section">
            <h3>📊 Summary</h3>
            <p>${escapeHtml(summaryText)}</p>
        </div>`;
    }
    if (recommendationText) {
        html += `<div class="report-section recommendation">
            <h3>💡 Recommendation</h3>
            <p>${escapeHtml(recommendationText)}</p>
        </div>`;
    }
    if (!summaryText && !recommendationText) {
        html = `<div class="report-section"><p>${escapeHtml(report)}</p></div>`;
    }
    
    reportTextDiv.innerHTML = html;
    
    // Metrics
    const recordMatch = data.message.match(/\d+/);
    metricsDiv.innerHTML = `
        <div class="metric-row">
            <div class="metric-box">
                <span class="metric-number">${data.uploadId}</span>
                <span class="metric-label">Report ID</span>
            </div>
            <div class="metric-box">
                <span class="metric-number">${recordMatch ? recordMatch[0] : '-'}</span>
                <span class="metric-label">Records Analyzed</span>
            </div>
        </div>
    `;
}

// ============ UTILITIES ============
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}