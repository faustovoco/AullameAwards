import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Escena 3D del trofeo Aullame: lobo dorado girando con luces teal.
export function initTrophy(canvas, onLoaded) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05090a, 0.12);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0.1, 6.2);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  // === Luces ===
  // base cálida tenue para que el oro nunca quede totalmente negro
  scene.add(new THREE.HemisphereLight(0x6fb8b2, 0x241a0c, 0.45));
  scene.add(new THREE.AmbientLight(0x3a2f18, 0.35));

  // luz cenital dorada fuerte (el rayo de arriba)
  const key = new THREE.SpotLight(0xffe9c2, 180, 24, Math.PI / 4.5, 0.55, 1.1);
  key.position.set(1.5, 6, 6);
  scene.add(key);
  scene.add(key.target);

  // relleno dorado frontal (modela el frente sin lavar el color)
  const fill = new THREE.PointLight(0xffcf82, 55, 20);
  fill.position.set(0, 0.5, 6);
  scene.add(fill);

  // rim teal desde atrás/izquierda (recorte de color)
  const rimA = new THREE.PointLight(0x2fd0c4, 95, 18);
  rimA.position.set(-4.5, 1.5, -2.5);
  scene.add(rimA);

  // rim teal desde la derecha
  const rimB = new THREE.PointLight(0x38b0a8, 60, 18);
  rimB.position.set(4.5, -0.5, -2);
  scene.add(rimB);

  // === Material oro pulido ===
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xcaa63f,
    metalness: 0.98,
    roughness: 0.28,
    emissive: 0x140d02,
    emissiveIntensity: 0.25,
  });

  // Entorno para reflejos metálicos creíbles (brillante y cálido)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = buildEnv();
  const envTex = pmrem.fromScene(envScene, 0.04).texture;
  scene.environment = envTex;
  goldMat.envMap = envTex;
  goldMat.envMapIntensity = 1.25;

  const pivot = new THREE.Group();
  scene.add(pivot);

  let model = null;
  const loader = new GLTFLoader();
  loader.load(
    "/models/trophy.glb",
    (gltf) => {
      model = gltf.scene;
      model.traverse((o) => {
        if (o.isMesh) {
          // recalcular normales suaves (el STL esculpido venía con normales invertidas)
          o.geometry.deleteAttribute("normal");
          o.geometry.computeVertexNormals();
          o.material = goldMat;
          o.castShadow = o.receiveShadow = false;
        }
      });
      // recentrar por si acaso
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);
      const size = box.getSize(new THREE.Vector3());
      const s = 3.2 / Math.max(size.x, size.y, size.z);
      model.scale.setScalar(s);
      key.target.position.set(0, 0, 0);
      pivot.add(model);
      onLoaded && onLoaded();
    },
    undefined,
    (err) => {
      console.error("Error cargando trofeo:", err);
      onLoaded && onLoaded(err);
    }
  );

  // partículas de polvo/luz flotando
  const dust = makeDust();
  scene.add(dust);

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  // ResizeObserver: reajusta aunque el canvas empiece con 0px (pane oculto, etc.)
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);
  }
  resize();

  let spin = 0;
  const clock = new THREE.Clock();
  let running = true;
  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
    spin += 0.0032;
    if (model) {
      pivot.rotation.y = spin; // gira solo, sin seguir el mouse
      pivot.position.y = Math.sin(t * 0.8) * 0.06; // flotar
    }
    dust.rotation.y = t * 0.02;
    rimA.intensity = 55 + Math.sin(t * 1.3) * 12;
    renderer.render(scene, camera);
  }
  loop();

  return {
    stop() { running = false; },
    start() { if (!running) { running = true; loop(); } },
  };
}

// Un entorno simple (gradiente teal->negro) para reflejos
function buildEnv() {
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(50, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {},
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec3 vP; void main(){
      vec3 n = normalize(vP);
      float h = n.y*0.5+0.5;
      // cielo teal arriba, penumbra abajo
      vec3 top = vec3(0.28,0.85,0.80);
      vec3 bot = vec3(0.04,0.06,0.06);
      vec3 c = mix(bot, top, pow(h,1.2));
      // gran foco dorado al frente (z+) para que el oro brille
      float front = max(0.0, n.z) * max(0.0, n.y*0.4+0.7);
      c += vec3(1.4,0.95,0.42) * pow(front, 2.2) * 0.85;
      // toque cálido lateral
      c += vec3(0.9,0.6,0.25) * pow(max(0.0,-n.x),3.0)*0.4;
      gl_FragColor = vec4(c,1.0);
    }`,
  });
  s.add(new THREE.Mesh(geo, mat));
  return s;
}

function makeDust() {
  const N = 260;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 12;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2;
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({
    color: 0x9fe6df,
    size: 0.035,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(g, m);
}
