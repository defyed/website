console.log('Particles script started');

const canvas = document.getElementById('particle-canvas');
if (!canvas) {
    console.error('Canvas element not found!');
} else {
    console.log('Canvas found:', canvas);
}

const ctx = canvas ? canvas.getContext('2d') : null;
if (!ctx) {
    console.error('2D context not available!');
} else {
    console.log('2D context initialized');
}

function setCanvasSize() {
    if (canvas) {
        // Use clientWidth and clientHeight to get the actual viewport dimensions
        canvas.width = document.documentElement.clientWidth;
        canvas.height = document.documentElement.clientHeight;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.zIndex = '-1';
        console.log('Canvas dimensions set:', canvas.width, 'x', canvas.height);
    }
}

// Initial size setting
setCanvasSize();

// Update on resize
window.addEventListener('resize', () => {
    setCanvasSize();
    // Reset particle positions to ensure they span the new dimensions
    particles.forEach(particle => {
        particle.x = Math.random() * canvas.width;
        particle.y = Math.random() * canvas.height;
    });
    console.log('Canvas resized:', canvas.width, 'x', canvas.height);
});

const particles = [];
const particleCount = 100;
let mouse = { x: null, y: null };

class Particle {
    constructor() {
        this.x = Math.random() * (canvas ? canvas.width : document.documentElement.clientWidth);
        this.y = Math.random() * (canvas ? canvas.height : document.documentElement.clientHeight);
        this.size = Math.random() * 2 + 0.5;
        this.speedX = Math.random() * 0.03 - 0.025;
        this.speedY = Math.random() * 0.03 - 0.025;
    }
    
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        
        if (mouse.x !== null && mouse.y !== null && canvas) {
            const dx = mouse.x - this.x;
            const dy = mouse.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxDistance = 150;
            
            if (distance < maxDistance && distance > 0) {
                const force = 0.03;
                this.x += (dx / distance) * force;
                this.y += (dy / distance) * force;
            }
        }
        
        if (canvas) {
            // Clamp particles to canvas boundaries
            if (this.x < 0) this.x = 0;
            if (this.x > canvas.width) this.x = canvas.width;
            if (this.y < 0) this.y = 0;
            if (this.y > canvas.height) this.y = canvas.height;
            // Reverse direction at boundaries
            if (this.x <= 0 || this.x >= canvas.width) this.speedX *= -1;
            if (this.y <= 0 || this.y >= canvas.height) this.speedY *= -1;
        }
    }
    
    draw() {
        if (ctx) {
            // Reset any transformations to prevent stretching
            ctx.resetTransform();
            // Explicitly set a 1:1 scale to maintain aspect ratio
            const scaleX = canvas.width / canvas.clientWidth;
            const scaleY = canvas.height / canvas.clientHeight;
            ctx.scale(scaleX, scaleY);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            // Adjust for scaled coordinates
            const adjustedX = this.x / scaleX;
            const adjustedY = this.y / scaleY;
            ctx.arc(adjustedX, adjustedY, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
}

document.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouse.x = (e.clientX - rect.left) * scaleX;
    mouse.y = (e.clientY - rect.top) * scaleY;
});

document.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
});

function animate() {
    if (ctx && canvas) {
        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Apply scaling for drawing
        const scaleX = canvas.width / canvas.clientWidth;
        const scaleY = canvas.height / canvas.clientHeight;
        ctx.scale(scaleX, scaleY);
        
        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });
        requestAnimationFrame(animate);
    }
}

if (canvas && ctx) {
    animate();
}