import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

const MODELS = [
  { id: "standard", name: "Баня Стандарт", length: 2, rooms: ["Парная"], price: 220000, note: "Компактная парная" },
  { id: "premium-2", name: "Премиум 2 м", length: 2, rooms: ["Парная"], price: 240000, note: "Парная повышенной комплектации" },
  { id: "premium-3", name: "Премиум 3 м", length: 3, rooms: ["Парная", "Предбанник"], price: 308000, note: "Парная + предбанник" },
  { id: "premium-4", name: "Премиум 4 м", length: 4, rooms: ["Парная", "Комната"], price: 338000, note: "Парная + комната отдыха" },
  { id: "premium-5", name: "Премиум 5 м", length: 5, rooms: ["Парная", "Комната"], price: 358000, note: "Просторная комната отдыха" },
  { id: "premium-6", name: "Премиум 6 м", length: 6, rooms: ["Парная", "Комната"], price: 379000, note: "Максимум пространства" },
  { id: "premium-6-3", name: "Премиум 6 м · 3 отделения", length: 6, rooms: ["Парная", "Помывочная", "Комната"], price: 404000, note: "Парная + помывочная + комната" }
];

const state = {
  model: MODELS[6],
  entrance: "end",
  cutaway: true,
  doors: false,
  labels: true,
  view: "iso",
  room: 0
};

const money = value => new Intl.NumberFormat("ru-RU").format(value) + " ₽";

function bathThumbnail(model) {
  const ratio = 0.68 + model.length * 0.045;
  return `
    <div class="product-visual">
      <span class="length-tag">${model.length} м · ${model.rooms.length} ${model.rooms.length === 1 ? "отделение" : "отделения"}</span>
      <span class="view-tag">3D</span>
      <div class="card-bath" style="width:${Math.min(88, ratio * 100)}%">
        <div class="card-bath-roof"></div><div class="card-bath-body"></div><div class="card-bath-door"></div>
      </div>
    </div>`;
}

function renderCatalog() {
  const grid = document.querySelector("#catalogGrid");
  grid.innerHTML = MODELS.map(model => `
    <article class="product-card" data-id="${model.id}" data-rooms="${model.rooms.length}" tabindex="0">
      ${bathThumbnail(model)}
      <div class="product-copy">
        <small>Квадро · ${model.length} метров</small>
        <h3>${model.name}</h3>
        <p>${model.note}</p>
        <div class="product-bottom"><strong>от ${money(model.price)}</strong><span>Смотреть в 3D →</span></div>
      </div>
    </article>`).join("");
  grid.querySelectorAll(".product-card").forEach(card => {
    const open = () => {
      selectModel(card.dataset.id);
      document.querySelector("#viewer").scrollIntoView({ behavior: "smooth" });
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", event => event.key === "Enter" && open());
  });
}

document.querySelectorAll(".filter").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    document.querySelectorAll(".product-card").forEach(card => {
      card.classList.toggle("is-hidden", button.dataset.filter !== "all" && card.dataset.rooms !== button.dataset.filter);
    });
  });
});

const select = document.querySelector("#modelSelect");
select.innerHTML = MODELS.map(model => `<option value="${model.id}">${model.name}</option>`).join("");
select.value = state.model.id;
select.addEventListener("change", () => selectModel(select.value));

function selectModel(id) {
  state.model = MODELS.find(model => model.id === id) || MODELS[6];
  state.room = 0;
  select.value = state.model.id;
  updateUI();
  buildBath();
  setCamera(state.view);
  updateUrl();
}

function updateUI() {
  const model = state.model;
  document.querySelector("#summaryLength").textContent = `${model.length} м`;
  document.querySelector("#summaryRooms").textContent = model.rooms.length;
  document.querySelector("#summaryArea").textContent = `${(model.length * 2.2).toFixed(1).replace(".", ",")} м²`;
  document.querySelector("#viewerPrice").textContent = `от ${money(model.price)}`;
  document.querySelector("#dialogModel").textContent = `${model.name} · ${model.rooms.length} ${model.rooms.length === 1 ? "отделение" : "отделения"} · вход ${state.entrance === "end" ? "с торца" : "сбоку"}`;
  const nav = document.querySelector("#roomNav");
  nav.innerHTML = model.rooms.map((room, index) => `<button class="room-button ${index === state.room ? "active" : ""}" data-room="${index}">${index + 1}. ${room}</button>`).join("");
  nav.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
    state.room = Number(button.dataset.room);
    document.querySelectorAll(".room-button").forEach(item => item.classList.toggle("active", item === button));
    setCamera("inside");
  }));
}

document.querySelectorAll("[data-entrance]").forEach(button => button.addEventListener("click", () => {
  state.entrance = button.dataset.entrance;
  document.querySelectorAll("[data-entrance]").forEach(item => item.classList.toggle("active", item === button));
  buildBath();
  updateUI();
  updateUrl();
}));

["cutaway", "doors", "labels"].forEach(key => {
  const input = document.querySelector(`#${key}Toggle`);
  input.addEventListener("change", () => {
    state[key] = input.checked;
    if (key === "doors") animateDoors();
    else if (key === "labels") labelRenderer.domElement.style.display = state.labels ? "" : "none";
    else buildBath();
    updateUrl();
  });
});

document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => setCamera(button.dataset.view)));

document.querySelector("#shareButton").addEventListener("click", async event => {
  try {
    await navigator.clipboard.writeText(location.href);
    event.currentTarget.textContent = "✓";
    setTimeout(() => event.currentTarget.textContent = "↗", 1400);
  } catch {
    event.currentTarget.textContent = "!";
  }
});
document.querySelector("#requestButton").addEventListener("click", () => document.querySelector("#requestDialog").showModal());
document.querySelector(".dialog-close").addEventListener("click", () => document.querySelector("#requestDialog").close());

const stage = document.querySelector("#stage");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc9c8c0);
scene.fog = new THREE.Fog(0xc9c8c0, 13, 26);
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
stage.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.inset = "0";
labelRenderer.domElement.style.pointerEvents = "none";
stage.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI * .49;
controls.minDistance = 2.2;
controls.maxDistance = 16;
controls.target.set(0, 1, 0);

scene.add(new THREE.HemisphereLight(0xfff7e4, 0x39483f, 2.1));
const sun = new THREE.DirectionalLight(0xfff1d4, 3.2);
sun.position.set(5, 8, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -9; sun.shadow.camera.right = 9; sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xbad7cb, 1.3);
fill.position.set(-4, 4, -6);
scene.add(fill);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(14, 64),
  new THREE.MeshStandardMaterial({ color: 0xb8b6ad, roughness: .86 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(22, 22, 0xa6a69e, 0xb1b0a8);
grid.position.y = .004;
grid.material.transparent = true;
grid.material.opacity = .26;
scene.add(grid);

let bathGroup = new THREE.Group();
let doorGroups = [];
scene.add(bathGroup);

const woodTexture = (() => {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#bf8658"; ctx.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 140; i++) {
    ctx.strokeStyle = `rgba(${95 + Math.random() * 30},${54 + Math.random() * 18},31,${.05 + Math.random() * .12})`;
    ctx.lineWidth = .5 + Math.random() * 1.4;
    ctx.beginPath();
    const y = Math.random() * 128;
    ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 24) ctx.lineTo(x, y + Math.sin(x / 30 + i) * (1 + Math.random() * 2));
    ctx.stroke();
  }
  for (let x = 0; x < 512; x += 40) {
    ctx.strokeStyle = "rgba(75,43,26,.16)"; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
})();

const mats = {
  wood: new THREE.MeshStandardMaterial({ color: 0xc88e5d, map: woodTexture, roughness: .68 }),
  lightWood: new THREE.MeshStandardMaterial({ color: 0xe0b881, roughness: .74 }),
  floor: new THREE.MeshStandardMaterial({ color: 0x9c653e, map: woodTexture, roughness: .72 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x29332e, roughness: .88 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x202622, roughness: .55, metalness: .25 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x8eb8b2, transmission: .35, opacity: .62, transparent: true, roughness: .17 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x252a27, roughness: .33, metalness: .75 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x5c5c55, roughness: 1 })
};

function box(w, h, d, material, x, y, z, group = bathGroup) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addDoor(x, z, rotation = 0, width = .66, isEntrance = false) {
  const pivot = new THREE.Group();
  pivot.position.set(x, .08, z);
  pivot.rotation.y = rotation;
  bathGroup.add(pivot);
  const door = box(width, 1.82, .065, mats.wood, width / 2, .91, 0, pivot);
  box(width - .16, .72, .075, mats.glass, width / 2, 1.27, -.01, pivot);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.035, 14, 10), mats.metal);
  knob.position.set(width - .1, .94, -.06);
  pivot.add(knob);
  pivot.userData.closed = rotation;
  pivot.userData.open = rotation + (isEntrance ? -1.23 : 1.18);
  doorGroups.push(pivot);
}

function roomBounds(index, count, length) {
  const steamLength = count === 1 ? length : Math.min(2, length * .43);
  if (count === 1) return [-length / 2, length / 2];
  if (count === 2) return index === 0 ? [-length / 2, -length / 2 + steamLength] : [-length / 2 + steamLength, length / 2];
  const wash = Math.min(1.45, length * .25);
  if (index === 0) return [-length / 2, -length / 2 + steamLength];
  if (index === 1) return [-length / 2 + steamLength, -length / 2 + steamLength + wash];
  return [-length / 2 + steamLength + wash, length / 2];
}

function addBench(z1, z2, x = -.77) {
  const length = Math.max(.4, z2 - z1 - .22);
  box(.7, .09, length, mats.lightWood, x, .7, (z1 + z2) / 2);
  box(.6, .08, length, mats.lightWood, x - .05, 1.23, (z1 + z2) / 2);
  [-1, 1].forEach(side => {
    box(.07, .66, .07, mats.dark, x - .25, .36, (z1 + z2) / 2 + side * (length / 2 - .09));
    box(.07, 1.18, .07, mats.dark, x - .25, .6, (z1 + z2) / 2 + side * (length / 2 - .09));
  });
}

function addStove(z) {
  box(.42, .72, .48, mats.metal, .68, .38, z);
  box(.16, 1.85, .16, mats.metal, .68, 1.49, z);
  const stoneGeo = new THREE.DodecahedronGeometry(.08, 0);
  for (let i = 0; i < 12; i++) {
    const stone = new THREE.Mesh(stoneGeo, mats.stone);
    stone.position.set(.53 + Math.random() * .3, .79 + Math.random() * .17, z - .15 + Math.random() * .3);
    stone.scale.setScalar(.7 + Math.random() * .6);
    bathGroup.add(stone);
  }
  const guard = new THREE.Group();
  for (let i = 0; i < 5; i++) box(.035, .78, .035, mats.lightWood, .48 + i * .13, .42, z + .39, guard);
  box(.62, .04, .04, mats.lightWood, .74, .78, z + .39, guard);
  box(.62, .04, .04, mats.lightWood, .74, .15, z + .39, guard);
  bathGroup.add(guard);
}

function addFurniture(z1, z2) {
  const center = (z1 + z2) / 2;
  const table = new THREE.Group();
  box(.92, .07, .62, mats.lightWood, 0, .63, center, table);
  box(.08, .62, .08, mats.wood, -.35, .31, center - .22, table);
  box(.08, .62, .08, mats.wood, .35, .31, center + .22, table);
  bathGroup.add(table);
  box(.36, .08, Math.min(1.15, z2 - z1 - .2), mats.lightWood, -.8, .43, center);
}

function addLabel(text, x, z, color) {
  const element = document.createElement("div");
  element.className = "viewer-label";
  element.textContent = text;
  element.style.borderColor = color;
  const label = new CSS2DObject(element);
  label.position.set(x, 1.35, z);
  bathGroup.add(label);
}

function buildBath() {
  scene.remove(bathGroup);
  bathGroup = new THREE.Group();
  scene.add(bathGroup);
  doorGroups = [];
  const { length, rooms } = state.model;
  const W = 2.2, H = 2.25;

  box(W + .18, .13, length + .18, mats.dark, 0, .08, 0);
  box(W, .11, length, mats.floor, 0, .18, 0);

  box(.11, 1.82, length, mats.wood, -W / 2, 1.08, 0);
  if (!state.cutaway) box(.11, 1.82, length, mats.wood, W / 2, 1.08, 0);

  const roofSegments = [
    { w: .84, angle: -.55, x: -.78, y: 1.98 },
    { w: .98, angle: 0, x: 0, y: 2.22 },
    { w: .84, angle: .55, x: .78, y: 1.98 }
  ];
  roofSegments.forEach((segment, index) => {
    if (state.cutaway && index === 2) return;
    const roof = box(segment.w, .11, length + .12, mats.roof, segment.x, segment.y, 0);
    roof.rotation.z = segment.angle;
  });
  for (let z = -length / 2; z <= length / 2 + .01; z += .52) {
    box(.05, .1, .05, mats.lightWood, -1.02, 1.89, z);
    if (!state.cutaway) box(.05, .1, .05, mats.lightWood, 1.02, 1.89, z);
  }

  const entranceAtEnd = state.entrance === "end";
  const endZ = length / 2;
  if (entranceAtEnd) {
    box(.64, 1.85, .1, mats.wood, -(.75 + .32), 1.07, endZ);
    box(.64, 1.85, .1, mats.wood, .75 + .32, 1.07, endZ);
    box(1.5, .22, .1, mats.wood, 0, 1.88, endZ);
    addDoor(-.37, endZ + .055, 0, .74, true);
  } else {
    box(W, 1.85, .1, mats.wood, 0, 1.07, endZ);
    const sideZ = Math.min(length / 2 - .55, roomBounds(rooms.length - 1, rooms.length, length)[0] + .6);
    box(.11, .24, .85, mats.wood, W / 2, 1.94, sideZ);
    addDoor(W / 2 + .04, sideZ - .37, Math.PI / 2, .74, true);
  }
  box(W, 1.85, .1, mats.wood, 0, 1.07, -length / 2);

  for (let i = 0; i < rooms.length - 1; i++) {
    const boundary = roomBounds(i, rooms.length, length)[1];
    box(.67, 1.82, .09, mats.lightWood, -.77, 1.08, boundary);
    box(.67, 1.82, .09, mats.lightWood, .77, 1.08, boundary);
    box(.66, .22, .09, mats.lightWood, 0, 1.87, boundary);
    addDoor(-.34, boundary + .05, 0, .68);
  }

  const steam = roomBounds(0, rooms.length, length);
  addBench(steam[0], steam[1]);
  addStove(Math.min(steam[1] - .35, steam[0] + .65));

  rooms.forEach((room, index) => {
    const [z1, z2] = roomBounds(index, rooms.length, length);
    if (room === "Помывочная") {
      box(.55, .07, .5, mats.lightWood, -.65, .46, (z1 + z2) / 2);
      const bucket = new THREE.Mesh(new THREE.CylinderGeometry(.15, .12, .26, 18), mats.metal);
      bucket.position.set(-.65, .63, (z1 + z2) / 2);
      bathGroup.add(bucket);
    }
    if (room === "Комната" || room === "Предбанник") addFurniture(z1, z2);
    const colors = ["#d8ed74", "#8bd1c0", "#efbf79"];
    addLabel(room, 0, (z1 + z2) / 2, colors[index]);
  });

  for (let x = -1.0; x <= 1.01; x += .25) {
    box(.2, .09, .58, mats.wood, x, .08, length / 2 + .48);
  }
  box(2.35, .12, .13, mats.dark, 0, .02, length / 2 + .19);
  box(2.35, .12, .13, mats.dark, 0, .02, length / 2 + .77);

  labelRenderer.domElement.style.display = state.labels ? "" : "none";
  animateDoors(true);
}

let doorProgress = state.doors ? 1 : 0;
let targetDoorProgress = doorProgress;
function animateDoors(immediate = false) {
  targetDoorProgress = state.doors ? 1 : 0;
  if (immediate) doorProgress = targetDoorProgress;
}

function setCamera(view) {
  state.view = view;
  document.querySelectorAll(".view-button").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  const L = state.model.length;
  let pos, target;
  controls.minDistance = view === "inside" ? .12 : 2.2;
  camera.fov = view === "inside" ? 58 : 38;
  camera.updateProjectionMatrix();
  if (view === "front") { pos = [0, 1.35, L / 2 + 6]; target = [0, 1, 0]; }
  else if (view === "top") { pos = [.01, 8.5, .01]; target = [0, 0, 0]; }
  else if (view === "inside") {
    const [z1, z2] = roomBounds(state.room, state.model.rooms.length, L);
    const inset = Math.min(.32, (z2 - z1) * .2);
    // Продольный взгляд не упирается в боковую стену даже в короткой помывочной.
    pos = [.7, 1.34, z2 - inset];
    target = [-.62, 1.04, z1 + inset];
  } else { pos = [5.5, 3.6, L * .65 + 3.2]; target = [0, 1, 0]; }
  camera.position.set(...pos);
  controls.target.set(...target);
  controls.update();
  document.querySelector("#stageHelp").textContent = view === "inside" ? `Вы внутри: ${state.model.rooms[state.room]}` : "Зажмите и потяните, чтобы вращать";
  updateUrl();
}

function updateUrl() {
  const url = new URL(location.href);
  url.searchParams.set("model", state.model.id);
  url.searchParams.set("entrance", state.entrance);
  url.searchParams.set("view", state.view);
  if (state.view === "inside") url.searchParams.set("room", state.room);
  else url.searchParams.delete("room");
  state.doors ? url.searchParams.set("doors", "open") : url.searchParams.delete("doors");
  history.replaceState(null, "", url);
}

function loadUrl() {
  const params = new URLSearchParams(location.search);
  const model = MODELS.find(item => item.id === params.get("model"));
  if (model) state.model = model;
  if (["end", "side"].includes(params.get("entrance"))) state.entrance = params.get("entrance");
  if (["iso", "front", "top", "inside"].includes(params.get("view"))) state.view = params.get("view");
  const room = Number(params.get("room"));
  if (Number.isInteger(room) && room >= 0 && room < state.model.rooms.length) state.room = room;
  state.doors = params.get("doors") === "open";
  document.querySelector("#doorsToggle").checked = state.doors;
  document.querySelectorAll("[data-entrance]").forEach(button => button.classList.toggle("active", button.dataset.entrance === state.entrance));
}

function resize() {
  const width = stage.clientWidth, height = stage.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  labelRenderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);

const clock = new THREE.Clock();
function render() {
  requestAnimationFrame(render);
  const delta = Math.min(clock.getDelta(), .05);
  doorProgress += (targetDoorProgress - doorProgress) * Math.min(1, delta * 7);
  doorGroups.forEach(door => {
    const smooth = doorProgress * doorProgress * (3 - 2 * doorProgress);
    door.rotation.y = THREE.MathUtils.lerp(door.userData.closed, door.userData.open, smooth);
  });
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

loadUrl();
renderCatalog();
select.value = state.model.id;
updateUI();
buildBath();
setCamera(state.view);
resize();
render();
