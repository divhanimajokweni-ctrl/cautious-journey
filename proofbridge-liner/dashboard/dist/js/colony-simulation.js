/**
 * Ant Colony Simulation — Ubuntu-Bridge Dashboard
 * Visualizes Bayesian consensus as pheromone trails
 * Canvas-based, no external dependencies
 */

class AntColonySimulation {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.ants = [];
    this.pheromones = [];
    this.target = { x: 0, y: 0, radius: 30 };
    this.colonySize = 5;
    this.alphaStrength = 1.0;
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    this.init();
    this.animate();
  }
  
  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.repositionTarget();
  }
  
  init() {
    // Create ants (agents)
    this.ants = [];
    for (let i = 0; i < 15; i++) { // Max possible ants
      this.ants.push({
        x: Math.random() * this.canvas.width,
        y: this.canvas.height - 50, // Start from bottom (Ant-hony area)
        angle: -Math.PI/2 + (Math.random() - 0.5) * 0.5,
        speed: 1 + Math.random() * 2,
        alive: i < this.colonySize,
        id: i,
        path: [],
        state: 'searching', // searching, returning, idle
      });
    }
    
    // Target at top center
    this.repositionTarget();
    
    // Pheromone trail grid (heatmap)
    this.pheromoneGrid = [];
    this.gridSize = 10;
    this.cols = Math.ceil(this.canvas.width / this.gridSize);
    this.rows = Math.ceil(this.canvas.height / this.gridSize);
    
    for (let y = 0; y < this.rows; y++) {
      this.pheromoneGrid[y] = [];
      for (let x = 0; x < this.cols; x++) {
        this.pheromoneGrid[y][x] = 0; // 0 = no pheromone, 1 = max
      }
    }
  }
  
  repositionTarget() {
    this.target.x = this.canvas.width / 2 + (Math.random() - 0.5) * 50;
    this.target.y = 80 + Math.random() * 40;
  }
  
  updateParams(colonySize, alphaStrength) {
    this.colonySize = Math.min(colonySize, 15);
    this.alphaStrength = alphaStrength;
    
    // Update ant alive states
    this.ants.forEach((ant, i) => {
      ant.alive = i < this.colonySize;
      if (ant.alive && ant.state === 'idle') {
        ant.state = 'searching';
        ant.angle = -Math.PI/2 + (Math.random() - 0.5) * 0.5;
      }
    });
    
    // Update visuals
    document.getElementById('colony-count').textContent = this.colonySize;
    const barWidth = (this.colonySize / 15) * 100;
    document.getElementById('colony-bar').style.width = barWidth + '%';
  }
  
  update() {
    // Evaporate pheromones
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.pheromoneGrid[y][x] > 0) {
          this.pheromoneGrid[y][x] *= 0.995; // Slow evaporation
        }
      }
    }
    
    // Update ants
    this.ants.forEach(ant => {
      if (!ant.alive) return;
      
      // Brownian motion with gradient ascent towards pheromone + target
      const gridX = Math.floor(ant.x / this.gridSize);
      const gridY = Math.floor(ant.y / this.gridSize);
      
      // Sniff pheromone gradient
      let dx = 0, dy = 0;
      if (gridX >= 0 && gridX < this.cols && gridY >= 0 && gridY < this.rows) {
        const currentPheromone = this.pheromoneGrid[gridY][gridX];
        
        // Sample neighbors
        const neighbors = [
          {x: gridX+1, y: gridY, w: 1},
          {x: gridX-1, y: gridY, w: 1},
          {x: gridX, y: gridY+1, w: 1},
          {x: gridX, y: gridY-1, w: 2}, // bias upward to target
        ];
        
        let sumWeight = 0;
        let sumX = 0, sumY = 0;
        
        neighbors.forEach(n => {
          if (n.x >= 0 && n.x < this.cols && n.y >= 0 && n.y < this.rows) {
            const p = this.pheromoneGrid[n.y][n.x];
            const weight = Math.max(0.01, p) * n.w;
            sumWeight += weight;
            sumX += n.x * weight;
            sumY += n.y * weight;
          }
        });
        
        if (sumWeight > 0) {
          const targetGridX = sumX / sumWeight;
          const targetGridY = sumY / sumWeight;
          dx = (targetGridX - gridX) * 0.3;
          dy = (targetGridY - gridY) * 0.3;
        }
      }
      
      // Add some randomness (exploration)
      dx += (Math.random() - 0.5) * 0.5;
      dy += (Math.random() - 0.5) * 0.5;
      
      // Normalize and apply speed
      const mag = Math.sqrt(dx*dx + dy*dy) || 1;
      ant.x += (dx / mag) * ant.speed;
      ant.y += (dy / mag) * ant.speed;
      
      // Keep within bounds
      ant.x = Math.max(0, Math.min(this.canvas.width, ant.x));
      ant.y = Math.max(0, Math.min(this.canvas.height, ant.y));
      
      // Deposit pheromone along path
      const gx = Math.floor(ant.x / this.gridSize);
      const gy = Math.floor(ant.y / this.gridSize);
      if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
        this.pheromoneGrid[gy][gx] = Math.min(1, this.pheromoneGrid[gy][gx] + 0.1 * this.alphaStrength);
      }
      
      // Check if reached target
      const distToTarget = Math.hypot(ant.x - this.target.x, ant.y - this.target.y);
      if (distToTarget < this.target.radius) {
        // Ant reached food (target CID)!
        this.repositionTarget();
      }
    });
  }
  
  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw grid of pheromone trails (heatmap overlay)
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const p = this.pheromoneGrid[y][x];
        if (p > 0.01) {
          const intensity = Math.floor(p * 255);
          ctx.fillStyle = `rgba(226, 114, 91, ${p * 0.6})`; // terracotta with alpha
          ctx.fillRect(x * this.gridSize, y * this.gridSize, this.gridSize, this.gridSize);
        }
      }
    }
    
    // Draw pheromone trails connecting ants (golden threads)
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.15)';
    ctx.lineWidth = 2;
    this.ants.forEach(ant => {
      if (!ant.alive || ant.path.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(ant.path[0].x, ant.path[0].y);
      for (let i = 1; i < ant.path.length; i++) {
        ctx.lineTo(ant.path[i].x, ant.path[i].y);
      }
      ctx.stroke();
    });
    
    // Draw target (CID)
    const gradient = ctx.createRadialGradient(
      this.target.x, this.target.y, 0,
      this.target.x, this.target.y, this.target.radius * 2
    );
    gradient.addColorStop(0, 'rgba(237, 28, 36, 0.8)');
    gradient.addColorStop(0.5, 'rgba(237, 28, 36, 0.3)');
    gradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.target.x, this.target.y, this.target.radius * 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#ED1C24';
    ctx.beginPath();
    ctx.arc(this.target.x, this.target.y, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Target label
    ctx.fillStyle = '#FFD700';
    ctx.font = '10px "JetBrains Mono"';
    ctx.textAlign = 'center';
    ctx.fillText('TARGET CID', this.target.x, this.target.y - 15);
    
    // Draw ants
    this.ants.forEach(ant => {
      if (!ant.alive) return;
      
      // Ant body
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(ant.x, ant.y, 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Glow
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    
    // Draw Ant-hony in bottom-left (as holographic overlay on canvas)
    // Handled by CSS mascot, but we can draw a subtle indicator here
  }
  
  animate() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.animate());
  }
  
  // Call this to update colony size dynamically
  setColonySize(size) {
    this.updateParams(size, this.alphaStrength);
  }
  
  setAlphaStrength(strength) {
    this.updateParams(this.colonySize, strength);
  }
}

// Initialize simulation when DOM loads
let simulation;
document.addEventListener('DOMContentLoaded', () => {
  simulation = new AntColonySimulation('colony-canvas');
  
  // Expose for WebSocket updates
  window.colonySimulation = simulation;
});
