// Global state
let sessionId: string | null = null;
let ws: WebSocket | null = null;
let messageCount = 0;
let totalLatency = 0;
let successCount = 0;
let totalBytes = 0;

// DOM elements
const elements = {
  gatewayUrl: document.getElementById('gatewayUrl') as HTMLInputElement,
  apiKey: document.getElementById('apiKey') as HTMLInputElement,
  transport: document.getElementById('transport') as HTMLSelectElement,
  target: document.getElementById('target') as HTMLInputElement,
  messagePayload: document.getElementById('messagePayload') as HTMLTextAreaElement,
  connectionStatus: document.getElementById('connectionStatus') as HTMLDivElement,
  handshakeStatus: document.getElementById('handshakeStatus') as HTMLDivElement,
  messageStatus: document.getElementById('messageStatus') as HTMLDivElement,
  messageCount: document.getElementById('messageCount') as HTMLDivElement,
  avgLatency: document.getElementById('avgLatency') as HTMLDivElement,
  successRate: document.getElementById('successRate') as HTMLDivElement,
  bytesSent: document.getElementById('bytesSent') as HTMLDivElement,
  log: document.getElementById('log') as HTMLDivElement,
};

// Logging functions
function log(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
  elements.log.appendChild(entry);
  elements.log.scrollTop = elements.log.scrollHeight;
}

function updateMetrics() {
  elements.messageCount.textContent = messageCount.toString();
  elements.avgLatency.textContent = messageCount > 0 ? `${Math.round(totalLatency / messageCount)}ms` : '0ms';
  elements.successRate.textContent = messageCount > 0 ? `${Math.round((successCount / messageCount) * 100)}%` : '100%';
  elements.bytesSent.textContent = formatBytes(totalBytes);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
}

// API functions
async function makeRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${elements.gatewayUrl.value}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': elements.apiKey.value,
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    log(`API Error: ${error}`, 'error');
    throw error;
  }
}

// Connection functions
async function connect() {
  try {
    log('Testing connection to gateway...', 'info');
    
    const response = await makeRequest('/v1/health');
    
    if (response.status === 'ok') {
      elements.connectionStatus.textContent = 'Connected';
      elements.connectionStatus.className = 'status success';
      log('Successfully connected to gateway', 'success');
    } else {
      throw new Error('Gateway health check failed');
    }
  } catch (error) {
    elements.connectionStatus.textContent = 'Connection failed';
    elements.connectionStatus.className = 'status error';
    log(`Connection failed: ${error}`, 'error');
  }
}

async function handshake() {
  try {
    log('Establishing handshake...', 'info');
    
    const response = await makeRequest('/v1/handshake', {
      method: 'POST',
      body: JSON.stringify({
        transport: elements.transport.value,
        target: elements.target.value,
        features: {
          compression: 'zstd',
          fec: true,
          crypto: false,
          maxMtu: 1500,
        },
      }),
    });

    sessionId = response.sessionId;
    elements.handshakeStatus.textContent = `Session established: ${sessionId}`;
    elements.handshakeStatus.className = 'status success';
    log(`Handshake successful - Session ID: ${sessionId}`, 'success');
    
    // Connect WebSocket for streaming
    connectWebSocket();
  } catch (error) {
    elements.handshakeStatus.textContent = 'Handshake failed';
    elements.handshakeStatus.className = 'status error';
    log(`Handshake failed: ${error}`, 'error');
  }
}

function connectWebSocket() {
  if (!sessionId) {
    log('No session ID available for WebSocket connection', 'error');
    return;
  }

  const wsUrl = elements.gatewayUrl.value.replace('http', 'ws') + `/v1/messages?sessionId=${sessionId}`;
  
  try {
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      log('WebSocket connected', 'success');
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        log(`Received: ${JSON.stringify(message)}`, 'info');
      } catch (error) {
        log(`Failed to parse WebSocket message: ${error}`, 'error');
      }
    };
    
    ws.onclose = () => {
      log('WebSocket disconnected', 'info');
    };
    
    ws.onerror = (error) => {
      log(`WebSocket error: ${error}`, 'error');
    };
  } catch (error) {
    log(`WebSocket connection failed: ${error}`, 'error');
  }
}

async function sendMessage() {
  if (!sessionId) {
    elements.messageStatus.textContent = 'No active session';
    elements.messageStatus.className = 'status error';
    log('No active session - establish handshake first', 'error');
    return;
  }

  try {
    const payload = JSON.parse(elements.messagePayload.value);
    const startTime = Date.now();
    
    log(`Sending message: ${JSON.stringify(payload)}`, 'info');
    
    const response = await makeRequest('/v1/encode', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        target: elements.target.value,
        payload,
        requireTranscript: true,
      }),
    });

    const latency = Date.now() - startTime;
    messageCount++;
    successCount++;
    totalLatency += latency;
    totalBytes += response.size || 0;

    elements.messageStatus.textContent = `Message sent successfully (${latency}ms)`;
    elements.messageStatus.className = 'status success';
    
    log(`Message sent successfully - ID: ${response.msgId}, Latency: ${latency}ms, Size: ${formatBytes(response.size)}`, 'success');
    
    updateMetrics();

    // Also send via WebSocket if available
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'send',
        payload,
        timestamp: new Date().toISOString(),
      }));
    }

  } catch (error) {
    messageCount++;
    elements.messageStatus.textContent = 'Message failed';
    elements.messageStatus.className = 'status error';
    log(`Message failed: ${error}`, 'error');
    updateMetrics();
  }
}

function clearLog() {
  elements.log.innerHTML = '';
}

// Global functions for HTML onclick handlers
(window as any).connect = connect;
(window as any).handshake = handshake;
(window as any).sendMessage = sendMessage;
(window as any).clearLog = clearLog;

// Initialize
log('Browser client initialized', 'info');
