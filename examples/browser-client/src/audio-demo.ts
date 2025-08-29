import { 
  createAudioDecoder, 
  createAudioCapture, 
  AudioPresets,
  FFTAnalyzer 
} from '@gibberlink/audio-decoder';

export class AudioDemo {
  private decoder: any;
  private capture: any;
  private analyzer: FFTAnalyzer;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isRunning: boolean = false;
  private animationId: number | null = null;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    this.decoder = createAudioDecoder(AudioPresets.lowLatency);
    this.capture = createAudioCapture('browser');
    this.analyzer = new FFTAnalyzer(48000, 1024, 0.5);
    
    this.setupCanvas();
  }

  private setupCanvas(): void {
    this.canvas.width = 800;
    this.canvas.height = 400;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      // Set up frame callback
      this.decoder.onFrame((frame: any) => {
        this.displayDecodedFrame(frame);
      });

      // Set up audio chunk processing
      this.capture.onChunk((chunk: any) => {
        const frames = this.decoder.decodeChunk(chunk.pcm);
        if (frames.length > 0) {
          console.log(`Decoded ${frames.length} frames`);
        }
        
        // Update spectrum display
        this.updateSpectrum(chunk.pcm);
      });

      await this.capture.start();
      this.isRunning = true;
      
      // Start animation loop
      this.animate();
      
      console.log('Audio demo started');
    } catch (error) {
      console.error('Failed to start audio demo:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    await this.capture.stop();
    console.log('Audio demo stopped');
  }

  private animate(): void {
    if (!this.isRunning) {
      return;
    }

    this.drawSpectrum();
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  private updateSpectrum(pcm: Float32Array): void {
    // Store the latest spectrum data for drawing
    const bins = this.analyzer.analyze(pcm);
    this.drawSpectrumBins(bins);
  }

  private drawSpectrum(): void {
    // Clear canvas
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw grid
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 1;
    
    // Vertical lines (frequency)
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * this.canvas.width;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    
    // Horizontal lines (magnitude)
    for (let i = 0; i <= 5; i++) {
      const y = (i / 5) * this.canvas.height;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  private drawSpectrumBins(bins: any[]): void {
    if (bins.length === 0) {
      return;
    }

    const binWidth = this.canvas.width / bins.length;
    const maxMagnitude = Math.max(...bins.map(bin => bin.magnitude));
    
    this.ctx.fillStyle = '#0f0';
    
    for (let i = 0; i < bins.length; i++) {
      const bin = bins[i];
      const height = (bin.magnitude / maxMagnitude) * this.canvas.height;
      const x = i * binWidth;
      const y = this.canvas.height - height;
      
      this.ctx.fillRect(x, y, binWidth - 1, height);
    }
  }

  private displayDecodedFrame(frame: any): void {
    const container = document.getElementById('decoded-frames');
    if (!container) {
      return;
    }

    const frameElement = document.createElement('div');
    frameElement.className = 'decoded-frame';
    frameElement.innerHTML = `
      <div class="frame-header">
        <span class="timestamp">${new Date(frame.timestamp).toLocaleTimeString()}</span>
        <span class="snr">SNR: ${frame.snrDb.toFixed(2)} dB</span>
        <span class="size">${frame.data.length} bytes</span>
      </div>
      <div class="frame-data">
        <pre>${JSON.stringify(frame.data, null, 2)}</pre>
      </div>
    `;

    container.insertBefore(frameElement, container.firstChild);
    
    // Keep only last 10 frames
    while (container.children.length > 10) {
      container.removeChild(container.lastChild!);
    }
  }

  async getDevices(): Promise<any[]> {
    try {
      return await this.capture.getDevices();
    } catch (error) {
      console.error('Failed to get devices:', error);
      return [];
    }
  }

  async setDevice(deviceId: string): Promise<void> {
    try {
      await this.capture.setDevice(deviceId);
    } catch (error) {
      console.error('Failed to set device:', error);
      throw error;
    }
  }

  getStats(): any {
    return this.decoder.getStats();
  }
}

// UI Helper functions
export function createAudioDemoUI(): void {
  const container = document.createElement('div');
  container.className = 'audio-demo-container';
  container.innerHTML = `
    <div class="audio-demo-header">
      <h2>🎤 Gibberlink Audio Decoder Demo</h2>
      <div class="controls">
        <button id="start-audio" class="btn btn-primary">Start Listening</button>
        <button id="stop-audio" class="btn btn-danger" disabled>Stop Listening</button>
        <select id="device-select" class="form-select">
          <option value="">Select Device...</option>
        </select>
      </div>
    </div>
    
    <div class="audio-demo-content">
      <div class="spectrum-container">
        <h3>📊 Real-time Spectrum</h3>
        <canvas id="spectrum-canvas" width="800" height="400"></canvas>
      </div>
      
      <div class="stats-container">
        <h3>📈 Statistics</h3>
        <div id="audio-stats" class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Chunks Processed:</span>
            <span id="chunks-processed" class="stat-value">0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Frames Decoded:</span>
            <span id="frames-decoded" class="stat-value">0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Average SNR:</span>
            <span id="avg-snr" class="stat-value">0 dB</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Error Rate:</span>
            <span id="error-rate" class="stat-value">0%</span>
          </div>
        </div>
      </div>
      
      <div class="decoded-container">
        <h3>📡 Decoded Frames</h3>
        <div id="decoded-frames" class="decoded-frames-list"></div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .audio-demo-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .audio-demo-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    
    .controls {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    }
    
    .btn-primary {
      background: #007bff;
      color: white;
    }
    
    .btn-danger {
      background: #dc3545;
      color: white;
    }
    
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .form-select {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
    }
    
    .audio-demo-content {
      display: grid;
      grid-template-columns: 1fr 300px;
      gap: 20px;
    }
    
    .spectrum-container {
      grid-column: 1 / -1;
    }
    
    #spectrum-canvas {
      border: 1px solid #ddd;
      border-radius: 4px;
      background: #000;
    }
    
    .stats-container {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
    }
    
    .stats-grid {
      display: grid;
      gap: 10px;
    }
    
    .stat-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    
    .stat-label {
      font-weight: 500;
      color: #666;
    }
    
    .stat-value {
      font-weight: 600;
      color: #333;
    }
    
    .decoded-container {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      max-height: 400px;
      overflow-y: auto;
    }
    
    .decoded-frames-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    .decoded-frame {
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 15px;
    }
    
    .frame-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 12px;
      color: #666;
    }
    
    .frame-data {
      background: #f8f9fa;
      padding: 10px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      overflow-x: auto;
    }
    
    .frame-data pre {
      margin: 0;
      white-space: pre-wrap;
    }
  `;

  document.head.appendChild(style);
}

// Initialize demo when DOM is loaded
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    createAudioDemoUI();
    
    const demo = new AudioDemo('spectrum-canvas');
    let isRunning = false;
    
    // Set up event listeners
    document.getElementById('start-audio')?.addEventListener('click', async () => {
      try {
        await demo.start();
        isRunning = true;
        
        (document.getElementById('start-audio') as HTMLButtonElement).disabled = true;
        (document.getElementById('stop-audio') as HTMLButtonElement).disabled = false;
        
        // Update stats periodically
        const statsInterval = setInterval(() => {
          if (!isRunning) {
            clearInterval(statsInterval);
            return;
          }
          
          const stats = demo.getStats();
          (document.getElementById('chunks-processed') as HTMLElement).textContent = stats.totalChunks.toString();
          (document.getElementById('frames-decoded') as HTMLElement).textContent = stats.totalFrames.toString();
          (document.getElementById('avg-snr') as HTMLElement).textContent = `${stats.averageSnr.toFixed(2)} dB`;
          (document.getElementById('error-rate') as HTMLElement).textContent = `${(stats.errorRate * 100).toFixed(2)}%`;
        }, 1000);
        
      } catch (error) {
        console.error('Failed to start audio demo:', error);
        alert('Failed to start audio demo. Please check microphone permissions.');
      }
    });
    
    document.getElementById('stop-audio')?.addEventListener('click', async () => {
      try {
        await demo.stop();
        isRunning = false;
        
        (document.getElementById('start-audio') as HTMLButtonElement).disabled = false;
        (document.getElementById('stop-audio') as HTMLButtonElement).disabled = true;
        
      } catch (error) {
        console.error('Failed to stop audio demo:', error);
      }
    });
    
    // Load devices
    demo.getDevices().then(devices => {
      const select = document.getElementById('device-select') as HTMLSelectElement;
      devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.id;
        option.textContent = device.name;
        select.appendChild(option);
      });
    });
    
    // Handle device selection
    document.getElementById('device-select')?.addEventListener('change', async (event) => {
      const deviceId = (event.target as HTMLSelectElement).value;
      if (deviceId && isRunning) {
        try {
          await demo.setDevice(deviceId);
        } catch (error) {
          console.error('Failed to set device:', error);
        }
      }
    });
  });
}
