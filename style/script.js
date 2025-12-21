const PARTICLE_COUNT = 8000;
let expansionFactor = 0;
let currentShape = 'star';
let lastHandX = 0.5;
let rotationVelocity = 0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 12;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.BufferGeometry();
let targets = [];
let dirs = [];

function initParticles() {
    targets = [];
    dirs = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        let x, y, z;
        if (currentShape === 'star') {
            const numPoints = 5;
            const innerRadius = 2.0;
            const outerRadius = 5.0;
            
            const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
            const section = (angle * numPoints) / (Math.PI * 2);
            const t = Math.abs((section % 1) - 0.5) * 2;
            const radius = outerRadius * (1 - t) + innerRadius * t;

            x = radius * Math.cos(angle - Math.PI/2);
            y = radius * Math.sin(angle - Math.PI/2);
            z = (Math.random() - 0.5) * 1;
        } else if (currentShape === 'heart') {
            const t = Math.random() * Math.PI * 2;
            x = 0.22 * (16 * Math.pow(Math.sin(t), 3));
            y = 0.22 * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
            z = (Math.random() - 0.5) * 3;
        } else {
            if (i < PARTICLE_COUNT * 0.6) {
                const phi = Math.acos(-1 + (2 * i) / (PARTICLE_COUNT * 0.6));
                const theta = Math.sqrt(PARTICLE_COUNT * 0.6 * Math.PI) * phi;
                x = 3 * Math.cos(theta) * Math.sin(phi);
                y = 3 * Math.sin(theta) * Math.sin(phi);
                z = 3 * Math.cos(phi);
            } else {
                const r = 5 + Math.random() * 2;
                const a = Math.random() * Math.PI * 2;
                x = Math.cos(a) * r; z = Math.sin(a) * r;
                y = (Math.random() - 0.5) * 0.3;
            }
        }
        targets.push(new THREE.Vector3(x, y, z));
        dirs.push(new THREE.Vector3(x, y, z).normalize().multiplyScalar(Math.random() * 8 + 2));
    }
}

const material = new THREE.PointsMaterial({
    size: 0.06, color: 0xffff00, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8
});

const particleSystem = new THREE.Points(geometry, material);
scene.add(particleSystem);
initParticles();

function onResults(results) {
    const canvasCtx = canvasElement.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        const currentX = landmarks[9].x;
        const dx = currentX - lastHandX;
        rotationVelocity += dx * 0.8;
        lastHandX = currentX;

        const isFingerOpen = (tipIdx) => landmarks[tipIdx].y < landmarks[tipIdx-2].y;
        const thumbOpen = Math.abs(landmarks[4].x - landmarks[9].x) > 0.15;
        const indexOpen = isFingerOpen(8);
        const middleOpen = isFingerOpen(12);
        const pinkyOpen = isFingerOpen(20);

        let newShape = currentShape;

        if (thumbOpen && pinkyOpen && !indexOpen && !middleOpen) {
            newShape = 'star';
        } else if (thumbOpen && indexOpen && !middleOpen && !pinkyOpen) {
            newShape = 'heart';
        } else if (thumbOpen && indexOpen && middleOpen && !pinkyOpen) {
            newShape = 'planet';
        }

        if (newShape !== currentShape) {
            currentShape = newShape;
            const nameTag = document.getElementById('current-shape-name');
            if(currentShape === 'star') { nameTag.innerText = "Ngôi sao"; material.color.set(0xffff00); }
            if(currentShape === 'heart') { nameTag.innerText = "Trái tim"; material.color.set(0xff3366); }
            if(currentShape === 'planet') { nameTag.innerText = "Hành tinh"; material.color.set(0x00ffff); }
            initParticles();
        }

        const d = Math.sqrt(Math.pow(landmarks[4].x - landmarks[8].x, 2) + Math.pow(landmarks[4].y - landmarks[8].y, 2));
        expansionFactor = Math.pow(Math.min(1, Math.max(0, (d - 0.08) / 0.25)), 2); 
    }
    canvasCtx.restore();
}

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.8, minTrackingConfidence: 0.8 });
hands.onResults(onResults);

const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('preview-video');
const cameraMedia = new Camera(videoElement, {
    onFrame: async () => await hands.send({image: videoElement}),
    width: 640, height: 480
});
cameraMedia.start();

let smoothExp = 0;
function animate() {
    requestAnimationFrame(animate);
    smoothExp += (expansionFactor - smoothExp) * 0.05; 
    
    particleSystem.rotation.y += rotationVelocity;
    rotationVelocity *= 0.92;
    particleSystem.rotation.y += 0.002;

    const posAttr = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const t = targets[i];
        const d = dirs[i];
        posAttr[i*3] = t.x + d.x * smoothExp;
        posAttr[i*3+1] = t.y + d.y * smoothExp;
        posAttr[i*3+2] = t.z + d.z * smoothExp;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(posAttr, 3));
    renderer.render(scene, camera);
}
animate();

window.onresize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};