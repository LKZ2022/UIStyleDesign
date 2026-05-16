/* ============================================================
   main.js — 超表面技术 × 光电创新
   Three.js 3D场景 + anime.js UI动画编排
   ============================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================================
// MetasurfaceScene — Three.js 3D场景管理
// ============================================================
class MetasurfaceScene {
  constructor(containerSelector) {
    this.container = document.querySelector(containerSelector);
    this.pillarData = [];
    this.hoveredPillarId = -1;
    this.previousHoveredId = -1;
    this.scatteredRays = [];
    this.isMobile = window.innerWidth < 768;
    this._pillarCountX = this.isMobile ? 16 : 24;
    this._pillarCountZ = this.isMobile ? 16 : 24;
    this._particleCount = this.isMobile ? 400 : 800;
  }

  init() {
    this._setupRenderer();
    this._setupScene();
    this._setupCamera();
    this._setupLights();
    this._createSubstrate();
    this._createNanopillarGrid();
    this._createLightBeams();
    this._createParticleCloud();
    this._setupOrbitControls();
    this._setupRaycaster();
    this._bindEvents();
    this._animate();
  }

  // ---- Renderer ----
  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
  }

  // ---- Scene ----
  _setupScene() {
    this.scene = new THREE.Scene();
  }

  // ---- Camera ----
  _setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      45, window.innerWidth / window.innerHeight, 0.1, 100
    );
    this.camera.position.set(0, 5, 13);
    this.camera.lookAt(0, -0.3, 0);
  }

  // ---- Lighting ----
  _setupLights() {
    // Key light — cool white directional
    this.keyLight = new THREE.DirectionalLight(0xe8f4fd, 3.5);
    this.keyLight.position.set(5, 10, 5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 50;
    this.keyLight.shadow.camera.left = -10;
    this.keyLight.shadow.camera.right = 10;
    this.keyLight.shadow.camera.top = 10;
    this.keyLight.shadow.camera.bottom = -10;
    this.keyLight.shadow.bias = -0.0001;
    this.scene.add(this.keyLight);

    // Fill light — deep blue
    const fillLight = new THREE.DirectionalLight(0x1a5276, 1.8);
    fillLight.position.set(-3, 2, -3);
    this.scene.add(fillLight);

    // Rim light — cyan point light behind
    this.rimLight = new THREE.PointLight(0x00d4ff, 12, 20);
    this.rimLight.position.set(0, 1.5, -6);
    this.scene.add(this.rimLight);

    // Ambient
    const ambient = new THREE.AmbientLight(0x1a3a5c, 1.2);
    this.scene.add(ambient);
  }

  // ---- Substrate ----
  _createSubstrate() {
    const geo = new THREE.BoxGeometry(9, 0.15, 9);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0d2137,
      roughness: 0.35,
      metalness: 0.6,
    });
    this.substrate = new THREE.Mesh(geo, mat);
    this.substrate.position.y = -0.7;
    this.substrate.receiveShadow = true;
    this.scene.add(this.substrate);

    // Polar grid on substrate surface
    const gridHelper = new THREE.PolarGridHelper(4.3, 40, 30, 64, 0x00d4ff, 0x00d4ff);
    gridHelper.position.y = -0.62;
    this.scene.add(gridHelper);

    // Subtle edge glow ring
    const ringGeo = new THREE.TorusGeometry(4.5, 0.02, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.62;
    this.scene.add(ring);
    this.edgeRing = ring;
  }

  // ---- Nanopillar Grid (InstancedMesh) ----
  _createNanopillarGrid() {
    const SPACING = this.isMobile ? 0.4 : 0.32;
    const BASE_RADIUS = 0.06;
    const BASE_HEIGHT = 1.0;
    const total = this._pillarCountX * this._pillarCountZ;

    const geo = new THREE.CylinderGeometry(BASE_RADIUS, BASE_RADIUS, BASE_HEIGHT, 12);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x4fc3f7,
      roughness: 0.15,
      metalness: 0.2,
    });

    this.pillarMesh = new THREE.InstancedMesh(geo, mat, total);
    this.pillarMesh.castShadow = true;
    this.pillarMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const offsetX = ((this._pillarCountX - 1) * SPACING) / 2;
    const offsetZ = ((this._pillarCountZ - 1) * SPACING) / 2;

    this.pillarData = [];

    for (let ix = 0; ix < this._pillarCountX; ix++) {
      for (let iz = 0; iz < this._pillarCountZ; iz++) {
        const idx = ix * this._pillarCountZ + iz;

        // Sinusoidal height variation — phase gradient metaphor
        const phase = (ix / this._pillarCountX) * Math.PI * 2;
        const heightScale = 0.7 + 0.3 * Math.sin(phase + (iz / this._pillarCountZ) * Math.PI * 2);

        const x = ix * SPACING - offsetX;
        const z = iz * SPACING - offsetZ;

        dummy.position.set(x, -0.7 + (BASE_HEIGHT * heightScale) / 2, z);
        dummy.scale.set(1, heightScale, 1);
        dummy.updateMatrix();
        this.pillarMesh.setMatrixAt(idx, dummy.matrix);

        // Color gradient: center bright, edges dimmer
        const distFromCenter = Math.sqrt(
          ((ix - this._pillarCountX / 2) / (this._pillarCountX / 2)) ** 2 +
          ((iz - this._pillarCountZ / 2) / (this._pillarCountZ / 2)) ** 2
        );
        const brightness = 0.5 + 0.5 * (1 - distFromCenter);
        color.setHSL(0.56, 0.8, 0.3 + brightness * 0.4);
        this.pillarMesh.setColorAt(idx, color);

        this.pillarData.push({
          ix, iz,
          baseHeightScale: heightScale,
          hoverScale: 1.0,
          baseColor: color.clone(),
          currentColor: color.clone(),
        });
      }
    }

    this.pillarMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.pillarMesh);
  }

  // ---- Light Beams ----
  _createLightBeams() {
    // Incident beam — hollow cylinder from upper-right
    const beamLength = 7;
    const beamRadius = 0.12;
    const beamGeo = new THREE.CylinderGeometry(beamRadius, beamRadius, beamLength, 8, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.incidentBeam = new THREE.Mesh(beamGeo, beamMat);
    this.incidentBeam.position.set(3.5, 2.8, -3.5);
    this.incidentBeam.rotation.z = -0.6;
    this.incidentBeam.rotation.x = 0.7;

    this.incidentBeamGroup = new THREE.Group();
    this.incidentBeamGroup.add(this.incidentBeam);
    this.scene.add(this.incidentBeamGroup);

    // Beam core — thinner brighter inner cylinder
    const coreGeo = new THREE.CylinderGeometry(beamRadius * 0.35, beamRadius * 0.35, beamLength, 8, 1, true);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x80eeff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.beamCore = new THREE.Mesh(coreGeo, coreMat);
    this.incidentBeamGroup.add(this.beamCore);

    // Impact glow cone
    const glowGeo = new THREE.ConeGeometry(1.4, 0.35, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x80deea,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.impactGlow = new THREE.Mesh(glowGeo, glowMat);
    this.impactGlow.position.set(0, -0.55, 0);
    this.scene.add(this.impactGlow);

    // Scattered rays
    const rayCount = 12;
    this.scatteredRays = [];
    this.rayGroup = new THREE.Group();

    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const rayGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.8, 6, 1);
      const rayMat = new THREE.MeshBasicMaterial({
        color: 0x4fc3f7,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const ray = new THREE.Mesh(rayGeo, rayMat);
      ray.position.set(
        Math.cos(angle) * 1.2,
        1.4,
        Math.sin(angle) * 1.2
      );
      ray.lookAt(new THREE.Vector3(0, -0.5, 0));
      ray.rotateX(Math.PI / 2);
      this.rayGroup.add(ray);
      this.scatteredRays.push({ mesh: ray, angle, material: rayMat });
    }
    this.scene.add(this.rayGroup);
  }

  // ---- Particle Cloud ----
  _createParticleCloud() {
    const count = this._particleCount;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const radius = 4 + Math.random() * 7;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.4;
      positions[i * 3 + 2] = radius * Math.cos(phi);

      sizes[i] = 0.02 + Math.random() * 0.06;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Generate circular sprite texture
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = 32;
    spriteCanvas.height = 32;
    const ctx = spriteCanvas.getContext('2d');
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(0, 212, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(0, 212, 255, 0.6)');
    gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    const spriteTexture = new THREE.CanvasTexture(spriteCanvas);

    const mat = new THREE.PointsMaterial({
      map: spriteTexture,
      color: 0x00d4ff,
      size: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0,
    });

    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  // ---- Orbit Controls ----
  _setupOrbitControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, -0.3, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 20;
    this.controls.maxPolarAngle = Math.PI * 0.65;
    this.controls.minPolarAngle = Math.PI * 0.15;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.3;
    this.controls.update();
  }

  // ---- Raycaster ----
  _setupRaycaster() {
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points.threshold = 0.1;
    this.raycaster.params.Mesh.threshold = 0.15;
    this.mouse = new THREE.Vector2();
  }

  // ---- Events ----
  _bindEvents() {
    window.addEventListener('resize', () => this._onResize());
    window.addEventListener('pointermove', (e) => this._onPointerMove(e));
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _onPointerMove(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.pillarMesh);

    if (intersects.length > 0) {
      this.hoveredPillarId = intersects[0].instanceId;
    } else {
      this.hoveredPillarId = -1;
    }

    if (this.hoveredPillarId !== this.previousHoveredId) {
      this._updatePillarHover(this.hoveredPillarId, this.previousHoveredId);
      this.previousHoveredId = this.hoveredPillarId;
    }
  }

  // ---- Hover Animation (called by UIAnimations bridge) ----
  _updatePillarHover(newId, oldId) {
    // Animate OUT old pillar
    if (oldId >= 0 && oldId < this.pillarData.length) {
      const pd = this.pillarData[oldId];
      anime({
        targets: pd,
        hoverScale: 1.0,
        duration: 300,
        easing: 'easeOutCubic',
        update: () => {
          pd.currentColor.copy(pd.baseColor);
          this.pillarMesh.setColorAt(oldId, pd.currentColor);
          this.pillarMesh.instanceColor.needsUpdate = true;
          this._applyPillarHoverScale(oldId, pd);
        },
      });
    }

    // Animate IN new pillar
    if (newId >= 0 && newId < this.pillarData.length) {
      const pd = this.pillarData[newId];
      const targetColor = new THREE.Color('#00e5ff');
      anime({
        targets: pd,
        hoverScale: 1.6,
        duration: 250,
        easing: 'easeOutBack',
        update: () => {
          pd.currentColor.copy(pd.baseColor).lerp(targetColor, (pd.hoverScale - 1) / 0.6);
          this.pillarMesh.setColorAt(newId, pd.currentColor);
          this.pillarMesh.instanceColor.needsUpdate = true;
          this._applyPillarHoverScale(newId, pd);
        },
      });
    }
  }

  _applyPillarHoverScale(id, pd) {
    const dummy = new THREE.Object3D();
    this.pillarMesh.getMatrixAt(id, dummy.matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
    dummy.scale.set(1, pd.baseHeightScale * pd.hoverScale, 1);
    dummy.updateMatrix();
    this.pillarMesh.setMatrixAt(id, dummy.matrix);
    this.pillarMesh.instanceMatrix.needsUpdate = true;
  }

  // ---- Animation Loop ----
  _animate() {
    requestAnimationFrame(() => this._animate());

    this.controls.update();

    // Rotate particle cloud slowly
    if (this.particles) {
      this.particles.rotation.y += 0.00025;
      this.particles.rotation.x += 0.00008;
    }

    // Rotate scattered rays
    if (this.rayGroup) {
      this.rayGroup.rotation.y += 0.0015;
    }

    // Pulse impact glow
    if (this.impactGlow && this.impactGlow.material.opacity > 0) {
      const t = performance.now() * 0.001;
      const pulse = 1 + 0.15 * Math.sin(t * 2);
      this.impactGlow.scale.setScalar(pulse);
      this.impactGlow.material.opacity = 0.3 + 0.12 * Math.sin(t * 3);
    }

    // Pulse rim light
    if (this.rimLight) {
      const t = performance.now() * 0.001;
      this.rimLight.intensity = 12 + 2 * Math.sin(t * 1.5);
    }

    // Pulse edge ring
    if (this.edgeRing && this.edgeRing.material.opacity > 0) {
      const t = performance.now() * 0.001;
      this.edgeRing.material.opacity = 0.25 + 0.1 * Math.sin(t * 2);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// ============================================================
// UIAnimations — anime.js 动画编排
// ============================================================
class UIAnimations {
  constructor(scene) {
    this.scene = scene;
  }

  // ---- Master Entrance Timeline ----
  pageLoadTimeline() {
    const tl = anime.timeline({
      easing: 'easeOutExpo',
    });

    // Phase 1: Navbar slides down
    tl.add({
      targets: '.navbar',
      translateY: [-80, 0],
      opacity: [0, 1],
      duration: 700,
      easing: 'easeOutCubic',
    }, 200);

    // Phase 2: Hero title
    tl.add({
      targets: '.hero__title',
      opacity: [0, 1],
      translateY: [40, 0],
      duration: 1000,
      easing: 'easeOutExpo',
    }, 500);

    // Phase 3: Subtitle
    tl.add({
      targets: '.hero__subtitle',
      opacity: [0, 1],
      translateY: [30, 0],
      duration: 800,
      easing: 'easeOutExpo',
    }, 800);

    // Phase 4: CTA buttons
    tl.add({
      targets: '.cta',
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 600,
      delay: anime.stagger(150),
      easing: 'easeOutCubic',
    }, 1100);

    // Phase 5: Scroll hint
    tl.add({
      targets: '.hero__scroll-hint',
      opacity: [0, 1],
      duration: 800,
      easing: 'easeOutSine',
    }, 1600);

    // Phase 6: Incident beam fades in
    tl.add({
      targets: this.scene.incidentBeam.material,
      opacity: [0, 0.22],
      duration: 1500,
      easing: 'easeInOutSine',
    }, 1400);

    tl.add({
      targets: this.scene.beamCore.material,
      opacity: [0, 0.45],
      duration: 1200,
      easing: 'easeInOutSine',
    }, 1600);

    // Phase 7: Scattered rays stagger in
    this.scene.scatteredRays.forEach((ray, i) => {
      tl.add({
        targets: ray.material,
        opacity: [0, 0.18],
        duration: 700,
        easing: 'easeOutSine',
      }, 1800 + i * 50);
    });

    // Phase 8: Impact glow
    tl.add({
      targets: this.scene.impactGlow.material,
      opacity: [0, 0.4],
      duration: 1000,
      easing: 'easeInOutSine',
    }, 2000);

    // Phase 9: Edge ring
    tl.add({
      targets: this.scene.edgeRing.material,
      opacity: [0, 0.3],
      duration: 1200,
      easing: 'easeInOutSine',
    }, 2200);

    // Phase 10: Particle cloud
    tl.add({
      targets: this.scene.particles.material,
      opacity: [0, 0.55],
      duration: 2000,
      easing: 'easeInOutSine',
    }, 1800);

    // Phase 11: Pillar rise (custom update)
    this._animatePillarRise(2200);

    return tl;
  }

  // ---- Pillar Rise Animation ----
  _animatePillarRise(startOffset) {
    const data = { progress: 0 };
    const totalPillars = this.scene.pillarData.length;
    const cx = this.scene._pillarCountX;
    const cz = this.scene._pillarCountZ;

    // Precompute per-pillar delay factor based on distance from center
    this.scene.pillarData.forEach((pd) => {
      const distFromCenter = Math.sqrt(
        ((pd.ix - cx / 2) / (cx / 2)) ** 2 +
        ((pd.iz - cz / 2) / (cz / 2)) ** 2
      );
      pd._riseDelay = distFromCenter * 0.6;
    });

    anime({
      targets: data,
      progress: [0, 1],
      duration: 2400,
      delay: startOffset,
      easing: 'easeOutBack',
      update: () => {
        const dummy = new THREE.Object3D();
        const SPACING = this.scene.isMobile ? 0.4 : 0.32;
        const BASE_HEIGHT = 1.0;

        this.scene.pillarData.forEach((pd, idx) => {
          const localProgress = Math.max(0, Math.min(1,
            (data.progress - pd._riseDelay) / (1 - pd._riseDelay)
          ));
          // Apply easing per pillar
          const s = localProgress < 1
            ? 1 - Math.pow(1 - localProgress, 3)
            : 1;

          pd.hoverScale = s;
          this.scene.pillarMesh.getMatrixAt(idx, dummy.matrix);
          dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
          dummy.scale.set(1, pd.baseHeightScale * s, 1);
          dummy.updateMatrix();
          this.scene.pillarMesh.setMatrixAt(idx, dummy.matrix);
        });
        this.scene.pillarMesh.instanceMatrix.needsUpdate = true;
      },
      complete: () => {
        // Reset all hoverScales to 1 after rise completes
        this.scene.pillarData.forEach(pd => { pd.hoverScale = 1.0; });
      },
    });
  }

  // ---- Scroll Observer for Feature Cards ----
  setupScrollObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const parentChildren = Array.from(el.parentNode.children);
            const index = parentChildren.indexOf(el);

            anime({
              targets: el,
              opacity: [0, 1],
              translateY: [60, 0],
              duration: 700,
              delay: index * 120,
              easing: 'easeOutCubic',
            });
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.feature-card').forEach(card => observer.observe(card));

    // Also observe application items
    const appObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const parentChildren = Array.from(el.parentNode.children);
            const index = parentChildren.indexOf(el);

            anime({
              targets: el,
              opacity: [0, 1],
              translateY: [30, 0],
              duration: 500,
              delay: index * 80,
              easing: 'easeOutCubic',
            });
            appObserver.unobserve(el);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
    );

    document.querySelectorAll('.app-item').forEach(item => appObserver.observe(item));
  }

  // ---- Button Hover Micro-interactions ----
  setupButtonHovers() {
    document.querySelectorAll('[data-hover]').forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        anime({
          targets: btn,
          scale: 1.03,
          duration: 300,
          easing: 'easeOutCubic',
        });
      });
      btn.addEventListener('mouseleave', () => {
        anime({
          targets: btn,
          scale: 1,
          duration: 300,
          easing: 'easeOutCubic',
        });
      });
    });
  }

  // ---- Card Hover Micro-interactions ----
  setupCardHovers() {
    document.querySelectorAll('.feature-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        anime({
          targets: card.querySelector('.feature-card__icon'),
          scale: 1.1,
          duration: 400,
          easing: 'easeOutBack',
        });
      });
      card.addEventListener('mouseleave', () => {
        anime({
          targets: card.querySelector('.feature-card__icon'),
          scale: 1,
          duration: 300,
          easing: 'easeOutCubic',
        });
      });
    });
  }
}

// ============================================================
// Bootstrap
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Initialize 3D scene
  const metasurfaceScene = new MetasurfaceScene('#three-container');
  metasurfaceScene.init();

  // Initialize UI animations
  const uiAnimations = new UIAnimations(metasurfaceScene);

  // Small delay to let Three.js setup complete before animating
  setTimeout(() => {
    uiAnimations.pageLoadTimeline();
  }, 300);

  // Setup scroll & hover interactions
  uiAnimations.setupScrollObserver();
  uiAnimations.setupButtonHovers();
  uiAnimations.setupCardHovers();
});
