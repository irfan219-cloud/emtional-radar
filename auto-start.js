const { spawn, exec } = require('child_process');
const path = require('path');

console.log('🚀 FeedbackAI Auto-Start');
console.log('========================');

// Kill existing processes
console.log('🧹 Cleaning up existing processes...');
exec('taskkill /F /IM node.exe', () => {
  setTimeout(startServers, 2000);
});

function startServers() {
  console.log('📡 Starting Backend Server...');
  
  // Start backend
  const backend = spawn('node', ['clean-server.js'], {
    cwd: path.join(__dirname, 'backend'),
    stdio: 'inherit'
  });

  // Start frontend after delay
  setTimeout(() => {
    console.log('🌐 Starting Frontend Server...');
    
    const frontend = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, 'frontend'),
      stdio: 'inherit',
      shell: true
    });

    // Open browser after delay
    setTimeout(() => {
      console.log('🌍 Opening browser...');
      exec('start http://localhost:3000');
    }, 8000);

    frontend.on('close', (code) => {
      console.log(`Frontend exited with code ${code}`);
      backend.kill();
    });

  }, 3000);

  backend.on('close', (code) => {
    console.log(`Backend exited with code ${code}`);
  });
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  process.exit();
});