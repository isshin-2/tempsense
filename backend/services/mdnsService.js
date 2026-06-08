const mdns = require('multicast-dns')();
const os = require('os');

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    // Skip virtual/internal interfaces
    if (name.toLowerCase().includes('veth') || name.toLowerCase().includes('virtual') || name.toLowerCase().includes('wsl')) continue;
    
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function startMDNS() {
  const ip = getLocalIp();
  
  mdns.on('query', (query) => {
    // Look for A record queries for tempsense.local
    const isTempsense = query.questions.some(q => 
      q.name.toLowerCase() === 'tempsense.local' && (q.type === 'A' || q.type === 'ANY')
    );
    
    if (isTempsense) {
      mdns.respond({
        answers: [{
          name: 'tempsense.local',
          type: 'A',
          ttl: 300,
          data: ip
        }]
      });
    }
  });
  
  console.log(`[mDNS] Broadcasting tempsense.local -> ${ip}`);
}

module.exports = { startMDNS };
