(() => {
  const canvas = document.getElementById("scene");
  const heartsEl = document.getElementById("hearts");
  const shardsEl = document.getElementById("shards");
  const announceEl = document.getElementById("announcement");
  const companionEl = document.getElementById("companion-banner");
  const hintEl = document.getElementById("hint");
  const chargeBar = document.getElementById("charge-bar");
  const chargeFill = document.getElementById("charge-fill");
  const slashPad = document.getElementById("slash-pad");
  const lookStick = document.getElementById("look-stick");
  const stickKnob = lookStick.querySelector(".stick-knob");

  const MAX_HP = 5;
  const RAIL_DURATION = 95;

  const state = {
    mode: "title",
    role: "sword",
    weapon: "sword",
    hp: MAX_HP,
    shards: 0,
    progress: 0,
    railSpeed: 0.011,
    yaw: 0,
    pitch: -0.08,
    slashCooldown: 0,
    invuln: 0,
    bowHold: 0,
    bowDrawing: false,
    bowSource: null,
    encounter: null,
    encounterIndex: 0,
    enemies: [],
    arrows: [],
    slashes: [],
    sparks: [],
    companion: null,
    clock: 0,
    win: false,
    pointerLocked: false,
  };

  const audio = createAudio();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b7c9);
  scene.fog = new THREE.Fog(0x87b7c9, 28, 160);

  const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 240);
  scene.add(camera);

  const sun = new THREE.DirectionalLight(0xffe0a8, 1.35);
  sun.position.set(30, 50, 20);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x6ea37a, 0.7));
  scene.add(new THREE.HemisphereLight(0x9ad0ea, 0x3d5a2f, 0.55));

  const rail = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 3.2, 8),
    new THREE.Vector3(2, 3.4, -24),
    new THREE.Vector3(18, 4.0, -62),
    new THREE.Vector3(6, 3.8, -108),
    new THREE.Vector3(-22, 4.6, -152),
    new THREE.Vector3(-8, 5.2, -198),
    new THREE.Vector3(16, 5.0, -248),
    new THREE.Vector3(4, 6.4, -310),
    new THREE.Vector3(0, 7.2, -372),
    new THREE.Vector3(0, 8.0, -430),
  ], false, "catmullrom", 0.2);

  const encounters = [
    {
      at: 0.12,
      title: "Wolves in the ferns",
      hint: "Swipe or click to slash.",
      foes: [
        { kind: "wolf", offset: [-5, 0, -10] },
        { kind: "wolf", offset: [5, 0, -12] },
        { kind: "wolf", offset: [0, 0, -16] },
      ],
    },
    {
      at: 0.28,
      title: "Horned brutes",
      hint: "Wait for the glow, then cut.",
      foes: [
        { kind: "brute", offset: [-4, 0, -11] },
        { kind: "brute", offset: [5, 0, -14] },
        { kind: "wolf", offset: [0, 0, -8] },
      ],
    },
    {
      at: 0.46,
      title: "Sky wraiths",
      hint: "Draw the bow — hold, then release.",
      foes: [
        { kind: "wraith", offset: [-7, 5, -16] },
        { kind: "wraith", offset: [6, 6, -18] },
        { kind: "wraith", offset: [0, 7, -22] },
        { kind: "wolf", offset: [3, 0, -9] },
      ],
    },
    {
      at: 0.66,
      title: "Ambush at the ruin gate",
      hint: "Swap weapons if you picked Champion.",
      foes: [
        { kind: "brute", offset: [-6, 0, -12] },
        { kind: "brute", offset: [6, 0, -13] },
        { kind: "wraith", offset: [-3, 6, -18] },
        { kind: "wraith", offset: [4, 5, -20] },
        { kind: "wolf", offset: [0, 0, -8] },
      ],
    },
    {
      at: 0.9,
      title: "Gate Guardian",
      hint: "Slash the core. Shoot the orbs.",
      foes: [{ kind: "boss", offset: [0, 2, -18] }],
    },
  ];

  buildWorld();
  const weapons = buildWeapons();
  const companion = buildCompanion();
  state.companion = companion;

  const keys = {};
  const look = { lx: 0, ly: 0, dragging: false, id: null };
  const swipe = { active: false, x: 0, y: 0, id: null };
  let last = performance.now();

  window.addEventListener("resize", onResize);
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (e.code === "KeyQ" || e.code === "KeyE") swapWeapon();
    if (e.code === "Escape") togglePause();
    if (e.code === "Space") e.preventDefault();
  });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  document.getElementById("btn-play").onclick = () => show("role");
  document.querySelectorAll("[data-role]").forEach((btn) => {
    btn.onclick = () => startRun(btn.dataset.role);
  });
  document.getElementById("btn-pause").onclick = togglePause;
  document.getElementById("btn-resume").onclick = () => {
    if (state.mode === "pause") setMode("play");
  };
  document.getElementById("btn-restart").onclick = () => location.reload();
  document.getElementById("btn-again").onclick = () => location.reload();
  document.getElementById("btn-swap").onclick = swapWeapon;
  document.getElementById("btn-bow").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    state.bowSource = "button";
    beginBow();
  });
  document.getElementById("btn-bow").addEventListener("pointerup", () => endBow());
  document.getElementById("btn-bow").addEventListener("pointercancel", () => endBow());

  slashPad.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    slashPad.setPointerCapture(e.pointerId);
    swipe.active = true;
    swipe.x = e.clientX;
    swipe.y = e.clientY;
    swipe.id = e.pointerId;
  });

  lookStick.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    lookStick.setPointerCapture(e.pointerId);
    look.dragging = true;
    look.id = e.pointerId;
    moveStick(e);
  });

  requestAnimationFrame(tick);

  function show(which) {
    ["title", "role", "pause", "end"].forEach((name) => {
      document.getElementById(`screen-${name}`).classList.toggle("hidden", name !== which);
    });
  }

  function setMode(mode) {
    state.mode = mode;
    document.getElementById("hud").classList.toggle("hidden", mode !== "play");
    document.getElementById("screen-pause").classList.toggle("hidden", mode !== "pause");
    if (mode === "play") {
      document.getElementById("screen-title").classList.add("hidden");
      document.getElementById("screen-role").classList.add("hidden");
      document.getElementById("screen-end").classList.add("hidden");
    }
  }

  function startRun(role) {
    audio.unlock();
    state.role = role;
    state.weapon = role === "bow" ? "bow" : "sword";
    document.getElementById("btn-swap").classList.toggle("hidden", role !== "dual");
    companionEl.textContent = companionLabel();
    renderHearts();
    setMode("play");
    flash("The rail carries you forward.");
    hint("Drag to look. Sword swipe · bow hold.");
  }

  function companionLabel() {
    if (state.role === "sword") return "Ranger Mira rides with you — arrows nocked.";
    if (state.role === "bow") return "Knight Toren rides with you — blade ready.";
    return "Mira and Toren share the rail. Swap when the fight asks for it.";
  }

  function swapWeapon() {
    if (state.role !== "dual" || state.mode !== "play") return;
    state.weapon = state.weapon === "sword" ? "bow" : "sword";
    flash(state.weapon === "sword" ? "Blade drawn." : "Bow drawn.");
    audio.blip(state.weapon === "sword" ? 220 : 440);
  }

  function togglePause() {
    if (state.mode === "play") setMode("pause");
    else if (state.mode === "pause") setMode("play");
  }

  function tick(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (state.mode === "play") update(dt);
    renderWeapons();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  function update(dt) {
    state.clock += dt;
    state.slashCooldown = Math.max(0, state.slashCooldown - dt);
    state.invuln = Math.max(0, state.invuln - dt);

    applyLook(dt);
    advanceRail(dt);
    updateEncounter();
    updateEnemies(dt);
    updateCompanion(dt);
    updateArrows(dt);
    updateSlashes(dt);
    updateSparks(dt);
    updateBow(dt);
    meleeIfClicked(dt);
    weapons.bob(state.clock, state.weapon);
  }

  function applyLook(dt) {
    let mx = 0;
    let my = 0;
    if (keys.ArrowLeft || keys.KeyA) mx -= 1;
    if (keys.ArrowRight || keys.KeyD) mx += 1;
    if (keys.ArrowUp || keys.KeyW) my += 1;
    if (keys.ArrowDown || keys.KeyS) my -= 1;
    mx += look.lx;
    my += look.ly;
    state.yaw = THREE.MathUtils.clamp(state.yaw - mx * dt * 1.8, -0.95, 0.95);
    state.pitch = THREE.MathUtils.clamp(state.pitch + my * dt * 1.3, -0.55, 0.45);
    state.yaw *= 0.992;
    state.pitch = THREE.MathUtils.lerp(state.pitch, -0.06, dt * 0.35);
  }

  function advanceRail(dt) {
    const blocked = state.encounter && state.enemies.length > 0;
    const speed = blocked ? 0.0012 : state.railSpeed;
    state.progress = Math.min(1, state.progress + speed * dt * (60 / RAIL_DURATION) * 8.2);

    const pos = rail.getPointAt(state.progress);
    const tan = rail.getTangentAt(state.progress);
    const lookAt = pos.clone().add(tan);
    camera.position.copy(pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(lookAt);
    camera.rotateY(state.yaw);
    camera.rotateX(state.pitch);

    companion.group.position.copy(pos).add(new THREE.Vector3(-1.6, -0.35, -2.2).applyQuaternion(camera.quaternion));
    companion.group.quaternion.copy(camera.quaternion);
    companion.group.rotateY(0.35);
  }

  function updateEncounter() {
    if (state.encounterIndex >= encounters.length) {
      if (state.progress > 0.97 && !state.win && state.enemies.length === 0) victory();
      return;
    }
    const next = encounters[state.encounterIndex];
    if (!state.encounter && state.progress >= next.at) {
      state.encounter = next;
      flash(next.title);
      hint(next.hint);
      audio.sting();
      const origin = rail.getPointAt(state.progress);
      const tan = rail.getTangentAt(state.progress);
      const basis = new THREE.Matrix4();
      basis.lookAt(origin, origin.clone().add(tan), new THREE.Vector3(0, 1, 0));
      next.foes.forEach((spec) => spawnEnemy(spec, origin, basis));
    }
    if (state.encounter && state.enemies.length === 0) {
      state.shards += 12;
      shardsEl.textContent = String(state.shards);
      flash("Path cleared!");
      audio.fanfare();
      state.encounter = null;
      state.encounterIndex += 1;
    }
  }

  function spawnEnemy(spec, origin, basis) {
    const local = new THREE.Vector3(...spec.offset);
    local.applyMatrix4(basis);
    const enemy = makeEnemy(spec.kind);
    enemy.mesh.position.copy(origin).add(local);
    enemy.home = enemy.mesh.position.clone();
    scene.add(enemy.mesh);
    state.enemies.push(enemy);
  }

  function makeEnemy(kind) {
    const group = new THREE.Group();
    const mats = {
      wolf: 0x5c4033,
      brute: 0x6b3f2a,
      wraith: 0x7aa7c7,
      boss: 0x4a3b58,
    };
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(kind === "boss" ? 1.4 : kind === "brute" ? 0.7 : 0.42, kind === "boss" ? 2.4 : 1.1, 4, 8),
      new THREE.MeshLambertMaterial({ color: mats[kind], flatShading: true })
    );
    body.position.y = kind === "wraith" ? 0 : kind === "boss" ? 1.6 : 0.9;
    group.add(body);
    if (kind === "wolf") {
      const snout = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 6), new THREE.MeshLambertMaterial({ color: 0x3a2a22, flatShading: true }));
      snout.rotation.x = Math.PI / 2;
      snout.position.set(0, 1.05, 0.55);
      group.add(snout);
    }
    if (kind === "brute") {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 5), new THREE.MeshLambertMaterial({ color: 0xeee6c9, flatShading: true }));
      horn.position.set(0.25, 1.8, 0);
      group.add(horn);
    }
    if (kind === "wraith") {
      body.material.transparent = true;
      body.material.opacity = 0.82;
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 3), new THREE.MeshLambertMaterial({ color: 0xcde7f5, flatShading: true, transparent: true, opacity: 0.7 }));
      wing.rotation.z = Math.PI / 2;
      wing.position.y = 0.4;
      group.add(wing);
    }
    if (kind === "boss") {
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe8c547, emissive: 0x8a5a10 }));
      core.position.y = 1.8;
      core.name = "core";
      group.add(core);
    }
    const hp = { wolf: 2, brute: 5, wraith: 3, boss: 28 }[kind];
    return { kind, mesh: group, hp, max: hp, t: Math.random() * 10, windup: 0, attack: 0 };
  }

  function updateEnemies(dt) {
    const player = camera.position;
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      e.t += dt;
      const dist = e.mesh.position.distanceTo(player);
      const desired = e.kind === "wraith" ? 9 : e.kind === "boss" ? 11 : 5.2;
      const toward = player.clone().sub(e.mesh.position);
      toward.y = 0;
      if (toward.lengthSq() > 0.01) {
        toward.normalize();
        e.mesh.lookAt(player.x, e.mesh.position.y, player.z);
        const speed = e.kind === "wraith" ? 3.2 : e.kind === "boss" ? 1.4 : 2.4;
        if (dist > desired) e.mesh.position.addScaledVector(toward, speed * dt);
        if (e.kind === "wraith") e.mesh.position.y = e.home.y + Math.sin(e.t * 2.2) * 0.9;
      }
      e.attack -= dt;
      if (dist < desired + 1.4 && e.attack <= 0) {
        e.windup += dt;
        pulseTint(e.mesh, e.windup > 0.45);
        if (e.windup > 0.7) {
          e.windup = 0;
          e.attack = e.kind === "boss" ? 1.6 : 1.15;
          if (dist < desired + 0.8) hurt(e.kind === "boss" ? 2 : 1);
          if (e.kind === "boss" && Math.random() < 0.55) spitOrb(e);
        }
      } else {
        e.windup = 0;
        pulseTint(e.mesh, false);
      }
    }
  }

  function pulseTint(mesh, on) {
    mesh.traverse((c) => {
      if (c.material && c.material.emissive) c.material.emissive.setHex(on ? 0x661111 : 0x000000);
    });
  }

  function spitOrb(boss) {
    const orb = {
      mesh: new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshLambertMaterial({ color: 0xff8844, emissive: 0x662200 })),
      vel: camera.position.clone().sub(boss.mesh.position).normalize().multiplyScalar(11),
      life: 3.2,
      damage: 1,
    };
    orb.mesh.position.copy(boss.mesh.position).add(new THREE.Vector3(0, 1.8, 0));
    scene.add(orb.mesh);
    state.arrows.push(orb);
  }

  function updateCompanion(dt) {
    companion.cool -= dt;
    if (companion.cool > 0 || state.enemies.length === 0) return;
    const target = nearestEnemy();
    if (!target) return;
    const useBow = state.role === "sword" || (state.role === "dual" && state.weapon === "sword");
    if (useBow) {
      fireArrow(companion.group.position.clone().add(new THREE.Vector3(0, 1.1, 0)), target.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 0.9, true);
      companion.cool = 1.25;
    } else {
      doSlash(true);
      companion.cool = 1.05;
    }
  }

  function nearestEnemy() {
    let best = null;
    let d = 1e9;
    state.enemies.forEach((e) => {
      const n = e.mesh.position.distanceTo(camera.position);
      if (n < d) { d = n; best = e; }
    });
    return best;
  }

  function meleeIfClicked() {
    if (keys.Space && state.weapon === "sword") {
      keys.Space = false;
      doSlash(false);
    }
  }

  function doSlash(fromCompanion) {
    if (!fromCompanion) {
      if (state.weapon !== "sword" || state.slashCooldown > 0) return;
      state.slashCooldown = 0.32;
      audio.slash();
    }
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = camera.position.clone().add(dir.clone().multiplyScalar(1.2));
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(1.7, 0.07, 6, 18, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.85 })
    );
    arc.position.copy(fromCompanion ? companion.group.position.clone().add(new THREE.Vector3(0, 1, -1)) : origin);
    arc.quaternion.copy(camera.quaternion);
    arc.rotateX(-Math.PI / 2);
    scene.add(arc);
    state.slashes.push({ mesh: arc, life: 0.22 });
    weapons.slashKick = 1;

    state.enemies.slice().forEach((e) => {
      const to = e.mesh.position.clone().sub(camera.position);
      const dist = to.length();
      const ang = dir.angleTo(to);
      const reach = fromCompanion ? 9 : 7.2;
      if (dist < reach && ang < 0.72) hitEnemy(e, fromCompanion ? 1 : 2);
    });
  }

  function beginBow() {
    if (state.mode !== "play") return;
    if (state.weapon !== "bow") {
      if (state.role === "dual") {
        state.weapon = "bow";
      } else return;
    }
    state.bowDrawing = true;
    state.bowSource = state.bowSource || "mouse";
    state.bowHold = 0.05;
    chargeBar.classList.add("show");
  }

  function endBow() {
    if (!state.bowDrawing) return;
    state.bowSource = null;
    const power = THREE.MathUtils.clamp(state.bowHold, 0.2, 1);
    state.bowDrawing = false;
    state.bowHold = 0;
    chargeBar.classList.remove("show");
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    origin.copy(camera.position).add(dir.clone().multiplyScalar(1.4)).add(new THREE.Vector3(0.2, -0.12, 0).applyQuaternion(camera.quaternion));
    const aim = camera.position.clone().add(dir.multiplyScalar(40));
    fireArrow(origin, aim, power, false);
    audio.bow();
    weapons.bowKick = 1;
  }

  function updateBow(dt) {
    if (keys.MouseRight || keys.KeyF) {
      if (!state.bowDrawing) {
        state.bowSource = "mouse";
        beginBow();
      }
    } else if (state.bowDrawing && state.bowSource !== "button") {
      endBow();
    }
    if (state.bowDrawing) {
      state.bowHold = Math.min(1, state.bowHold + dt * 1.4);
      chargeFill.style.width = `${state.bowHold * 100}%`;
    }
  }

  function fireArrow(from, to, power, ally) {
    const vel = to.clone().sub(from).normalize().multiplyScalar(28 * (0.65 + power));
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5),
      new THREE.MeshLambertMaterial({ color: ally ? 0x9be7ff : 0x5c3d12 })
    );
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vel.clone().normalize());
    mesh.position.copy(from);
    scene.add(mesh);
    state.arrows.push({ mesh, vel, life: 2.4, damage: ally ? 1 : 2, ally });
  }

  function updateArrows(dt) {
    for (let i = state.arrows.length - 1; i >= 0; i--) {
      const a = state.arrows[i];
      a.life -= dt;
      a.vel.y -= (a.ally || a.damage === 1 && !a.vel._orb ? 6 : 10) * dt * (a.mesh.geometry.type === "SphereGeometry" ? 0.2 : 1);
      a.mesh.position.addScaledVector(a.vel, dt);
      if (a.mesh.geometry.type !== "SphereGeometry") {
        a.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.vel.clone().normalize());
      }
      if (!a.ally && a.mesh.geometry.type === "SphereGeometry") {
        if (a.mesh.position.distanceTo(camera.position) < 1.35) {
          hurt(1);
          scene.remove(a.mesh);
          state.arrows.splice(i, 1);
          continue;
        }
      }
      let consumed = false;
      if (a.ally || a.mesh.geometry.type !== "SphereGeometry") {
        for (const e of state.enemies) {
          if (a.mesh.position.distanceTo(e.mesh.position.clone().add(new THREE.Vector3(0, 1, 0))) < (e.kind === "boss" ? 2.2 : 1.15)) {
            hitEnemy(e, a.damage);
            consumed = true;
            break;
          }
        }
      }
      if (consumed || a.life <= 0 || a.mesh.position.y < -2) {
        scene.remove(a.mesh);
        state.arrows.splice(i, 1);
      }
    }
  }

  function updateSlashes(dt) {
    for (let i = state.slashes.length - 1; i >= 0; i--) {
      const s = state.slashes[i];
      s.life -= dt;
      s.mesh.material.opacity = Math.max(0, s.life * 4);
      s.mesh.scale.multiplyScalar(1 + dt * 4);
      if (s.life <= 0) {
        scene.remove(s.mesh);
        state.slashes.splice(i, 1);
      }
    }
  }

  function updateSparks(dt) {
    for (let i = state.sparks.length - 1; i >= 0; i--) {
      const p = state.sparks[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = Math.max(0, p.life * 3);
      if (p.life <= 0) {
        scene.remove(p.mesh);
        state.sparks.splice(i, 1);
      }
    }
  }

  function hitEnemy(e, dmg) {
    e.hp -= dmg;
    burst(e.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), e.kind === "wraith" ? 0x9ad8ff : 0xffd27a);
    audio.hit();
    if (e.hp <= 0) {
      scene.remove(e.mesh);
      state.enemies = state.enemies.filter((x) => x !== e);
      state.shards += e.kind === "boss" ? 40 : 4;
      shardsEl.textContent = String(state.shards);
    }
  }

  function burst(pos, color) {
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.12),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
      );
      mesh.position.copy(pos);
      const vel = new THREE.Vector3(Math.random() - 0.5, Math.random(), Math.random() - 0.5).multiplyScalar(6);
      scene.add(mesh);
      state.sparks.push({ mesh, vel, life: 0.4 });
    }
  }

  function hurt(n) {
    if (state.invuln > 0) return;
    state.hp = Math.max(0, state.hp - n);
    state.invuln = 1.05;
    renderHearts();
    audio.hurt();
    flash("A hit!");
    if (state.hp <= 0) defeat();
  }

  function renderHearts() {
    heartsEl.innerHTML = "";
    for (let i = 0; i < MAX_HP; i++) {
      const h = document.createElement("div");
      h.className = "heart" + (i < state.hp ? "" : " empty");
      heartsEl.appendChild(h);
    }
  }

  function flash(text) {
    announceEl.textContent = text;
    clearTimeout(flash._t);
    flash._t = setTimeout(() => { announceEl.textContent = ""; }, 2200);
  }

  function hint(text) {
    hintEl.textContent = text;
    clearTimeout(hint._t);
    hint._t = setTimeout(() => { hintEl.textContent = ""; }, 3400);
  }

  function victory() {
    state.win = true;
    setMode("end");
    show("end");
    document.getElementById("hud").classList.add("hidden");
    document.getElementById("end-title").textContent = "The gate falls";
    document.getElementById("end-copy").textContent = `You and your companion cleared the Forest of Echoes. Spirit shards: ${state.shards}.`;
    audio.fanfare();
  }

  function defeat() {
    setMode("end");
    show("end");
    document.getElementById("hud").classList.add("hidden");
    document.getElementById("end-title").textContent = "The rail goes dark";
    document.getElementById("end-copy").textContent = "The woods close in. Try another weapon, or watch the companion's cues.";
  }

  function onPointerDown(e) {
    if (state.mode !== "play") return;
    if (e.button === 2) {
      keys.MouseRight = true;
      beginBow();
      return;
    }
    if (e.pointerType === "mouse" && e.button === 0) {
      if (state.weapon === "bow") beginBow();
      else doSlash(false);
      canvas.requestPointerLock?.();
      look.dragging = true;
      look.id = e.pointerId;
    } else if (e.pointerType !== "mouse") {
      look.dragging = true;
      look.id = e.pointerId;
      look._lx = e.clientX;
      look._ly = e.clientY;
    }
  }

  function onPointerMove(e) {
    if (swipe.active && e.pointerId === swipe.id) {
      const dx = e.clientX - swipe.x;
      const dy = e.clientY - swipe.y;
      if (Math.hypot(dx, dy) > 38) {
        doSlash(false);
        swipe.active = false;
      }
      return;
    }
    if (look.dragging && e.pointerId === look.id && lookStick.hasPointerCapture?.(e.pointerId)) {
      moveStick(e);
      return;
    }
    if (document.pointerLockElement === canvas) {
      state.yaw -= (e.movementX || 0) * 0.0022;
      state.pitch -= (e.movementY || 0) * 0.002;
      state.yaw = THREE.MathUtils.clamp(state.yaw, -0.95, 0.95);
      state.pitch = THREE.MathUtils.clamp(state.pitch, -0.55, 0.45);
      return;
    }
    if (look.dragging && e.pointerId === look.id && look._lx != null) {
      state.yaw -= (e.clientX - look._lx) * 0.004;
      state.pitch -= (e.clientY - look._ly) * 0.0035;
      look._lx = e.clientX;
      look._ly = e.clientY;
    }
  }

  function onPointerUp(e) {
    if (e.button === 2) {
      keys.MouseRight = false;
      endBow();
    }
    if (e.pointerType === "mouse" && e.button === 0 && state.weapon === "bow") endBow();
    if (e.pointerId === swipe.id) swipe.active = false;
    if (e.pointerId === look.id) {
      look.dragging = false;
      look.lx = 0;
      look.ly = 0;
      look.id = null;
      stickKnob.style.transform = "translate(-50%, -50%)";
    }
  }

  function moveStick(e) {
    const r = lookStick.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2);
    let dy = (e.clientY - cy) / (r.height / 2);
    const m = Math.hypot(dx, dy) || 1;
    if (m > 1) { dx /= m; dy /= m; }
    look.lx = dx;
    look.ly = -dy;
    stickKnob.style.transform = `translate(calc(-50% + ${dx * 28}px), calc(-50% + ${dy * 28}px))`;
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function buildWorld() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 900, 20, 40),
      new THREE.MeshLambertMaterial({ color: 0x4c7a3c, flatShading: true })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -220);
    scene.add(ground);

    const pathGeom = new THREE.TubeGeometry(rail, 180, 1.25, 6, false);
    const path = new THREE.Mesh(pathGeom, new THREE.MeshLambertMaterial({ color: 0xc2a36b, flatShading: true }));
    scene.add(path);

    const treeGeo = new THREE.ConeGeometry(2.2, 7.5, 6);
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 2.2, 5);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f6d3a, flatShading: true });
    const leafMat2 = new THREE.MeshLambertMaterial({ color: 0x1f4d2c, flatShading: true });
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3a22, flatShading: true });

    for (let i = 0; i < 90; i++) {
      const t = i / 90;
      const p = rail.getPointAt(Math.min(0.98, t));
      const tan = rail.getTangentAt(Math.min(0.98, t));
      const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      [-1, 1].forEach((sign, k) => {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.1;
        const cone = new THREE.Mesh(treeGeo, (i + k) % 2 ? leafMat : leafMat2);
        cone.position.y = 5.2;
        tree.add(trunk, cone);
        const dist = 8 + ((i * 17 + k * 13) % 18);
        tree.position.copy(p).addScaledVector(side, sign * dist);
        tree.position.y = 0;
        tree.rotation.y = i * 0.4;
        scene.add(tree);
      });
    }

    for (let i = 0; i < 12; i++) {
      const t = 0.08 + i * 0.07;
      const p = rail.getPointAt(Math.min(0.96, t));
      const ruin = new THREE.Mesh(
        new THREE.BoxGeometry(2.2 + (i % 3), 3 + (i % 4), 1.4),
        new THREE.MeshLambertMaterial({ color: 0x8d8674, flatShading: true })
      );
      const side = i % 2 === 0 ? 7 : -8;
      ruin.position.set(p.x + side, 1.6, p.z - 2);
      ruin.rotation.y = i * 0.5;
      scene.add(ruin);
    }

    const bossGate = new THREE.Group();
    const col = new THREE.Mesh(new THREE.BoxGeometry(2, 14, 2), new THREE.MeshLambertMaterial({ color: 0x6d6458, flatShading: true }));
    const col2 = col.clone();
    col.position.set(-6, 7, 0);
    col2.position.set(6, 7, 0);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 2.2), new THREE.MeshLambertMaterial({ color: 0x8a7a4b, flatShading: true }));
    lintel.position.y = 14;
    bossGate.add(col, col2, lintel);
    const end = rail.getPointAt(0.94);
    bossGate.position.copy(end);
    bossGate.position.y = 0;
    scene.add(bossGate);

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(200, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x8ecae6, side: THREE.BackSide })
    );
    scene.add(sky);
  }

  function buildWeapons() {
    const sword = new THREE.Group();
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1.35, 0.18),
      new THREE.MeshLambertMaterial({ color: 0xe8eef5, flatShading: true })
    );
    blade.position.set(0.55, -0.35, -1.15);
    blade.rotation.z = -0.35;
    blade.rotation.x = 0.2;
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.12), new THREE.MeshLambertMaterial({ color: 0x6b3f12 }));
    hilt.position.copy(blade.position).add(new THREE.Vector3(-0.02, -0.7, 0.05));
    sword.add(blade, hilt);
    camera.add(sword);

    const bow = new THREE.Group();
    const limb = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.04, 6, 12, Math.PI),
      new THREE.MeshLambertMaterial({ color: 0x8b5a2b, flatShading: true })
    );
    limb.position.set(0.42, -0.2, -1.05);
    limb.rotation.y = Math.PI / 2;
    bow.add(limb);
    camera.add(bow);

    const api = {
      slashKick: 0,
      bowKick: 0,
      bob(t, weapon) {
        sword.visible = weapon === "sword";
        bow.visible = weapon === "bow";
        api.slashKick *= 0.86;
        api.bowKick *= 0.88;
        sword.rotation.z = Math.sin(t * 3) * 0.04 - api.slashKick * 1.1;
        sword.rotation.x = -api.slashKick * 0.8;
        bow.position.z = api.bowKick * 0.12;
      },
    };
    return api;
  }

  function buildCompanion() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.7, 4, 6),
      new THREE.MeshLambertMaterial({ color: 0x3d6ea8, flatShading: true })
    );
    body.position.y = 0.7;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshLambertMaterial({ color: 0xf0d0b0, flatShading: true }));
    head.position.y = 1.28;
    group.add(body, head);
    scene.add(group);
    return { group, cool: 1 };
  }

  function createAudio() {
    let ctx;
    function ensure() {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }
    function beep(freq, dur, type, gain) {
      const c = ensure();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g).connect(c.destination);
      o.start();
      o.stop(c.currentTime + dur);
    }
    return {
      unlock: ensure,
      slash() { beep(180, 0.12, "sawtooth", 0.06); beep(420, 0.08, "triangle", 0.04); },
      bow() { beep(520, 0.09, "square", 0.04); beep(140, 0.16, "sine", 0.05); },
      hit() { beep(90, 0.1, "square", 0.07); },
      hurt() { beep(110, 0.22, "sawtooth", 0.08); },
      sting() { beep(392, 0.18, "triangle", 0.05); beep(523, 0.22, "triangle", 0.04); },
      fanfare() { beep(523, 0.18, "triangle", 0.05); setTimeout(() => beep(659, 0.2, "triangle", 0.05), 120); setTimeout(() => beep(784, 0.28, "triangle", 0.05), 240); },
      blip(f) { beep(f, 0.08, "square", 0.04); },
    };
  }
})();
