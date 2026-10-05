import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const stage = document.querySelector("#furnitureStage");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd6cec1);
scene.fog = new THREE.Fog(0xd6cec1, 4.5, 10);
const camera = new THREE.PerspectiveCamera(35, 1, .01, 50);
camera.position.set(2.15, 1.55, 2.7);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
stage.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, .48, -.08);
controls.enableDamping = true;
controls.minDistance = 1.5;
controls.maxDistance = 5.5;
controls.maxPolarAngle = Math.PI * .53;

scene.add(new THREE.HemisphereLight(0xfff6df, 0x4a4f45, 2.6));
const sun = new THREE.DirectionalLight(0xffe8c7, 3.8);
sun.position.set(3, 5, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const W = 1.29, H = .9, D_BOTTOM = .22, D_TOP = .30, T = .018, PLINTH = .06;
const state = { variant: "cells", doors: false, room: true };
let furniture = new THREE.Group();
let room = new THREE.Group();
let doors = [];
scene.add(furniture, room);

function grainTexture(base = "#d5aa72") {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 110; i++) {
    const y = Math.random() * 128;
    ctx.strokeStyle = `rgba(91,53,28,${.035 + Math.random() * .09})`;
    ctx.lineWidth = .4 + Math.random() * 1.2;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x < 513; x += 25) ctx.lineTo(x, y + Math.sin(x / 35 + i) * 2);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
const wood = new THREE.MeshStandardMaterial({ color: 0xdfb57d, map: grainTexture(), roughness: .64 });
const edge = new THREE.MeshStandardMaterial({ color: 0xbd8654, map: grainTexture("#bc8656"), roughness: .72 });
const wallMat = new THREE.MeshStandardMaterial({ color: 0xb27648, map: grainTexture("#ae7448"), roughness: .82 });
const dark = new THREE.MeshStandardMaterial({ color: 0x4e3223, roughness: .7 });

function box(w, h, d, material, x, y, z, parent = furniture) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
const depthAt = y => D_BOTTOM + (D_TOP - D_BOTTOM) * (y / H);

function sidePanel(x) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(D_BOTTOM, 0); shape.lineTo(D_TOP, H); shape.lineTo(0, H); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
  geometry.rotateY(Math.PI / 2);
  geometry.translate(x - T / 2, 0, 0);
  const mesh = new THREE.Mesh(geometry, wood);
  mesh.castShadow = mesh.receiveShadow = true;
  furniture.add(mesh);
}

function shelf(y) {
  const depth = depthAt(y);
  box(W - T * 2, T, depth, wood, 0, y, depth / 2);
}

function divider(x, y1 = PLINTH, y2 = H - T) {
  const mid = (y1 + y2) / 2;
  const depth = depthAt(mid) - .01;
  box(T, y2 - y1, depth, edge, x, mid, depth / 2);
}

function doorLeaf(x, y, width, height, hingeLeft) {
  const pivot = new THREE.Group();
  const hingeX = x + (hingeLeft ? -width / 2 : width / 2);
  pivot.position.set(hingeX, y - height / 2, -.018);
  const leaf = box(width - .012, height - .012, .026, wood, hingeLeft ? width / 2 : -width / 2, height / 2, 0, pivot);
  const inset = box(width - .075, height - .08, .012, edge, hingeLeft ? width / 2 : -width / 2, height / 2, -.02, pivot);
  inset.scale.set(.94, .94, 1);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .038, 14), dark);
  knob.rotation.x = Math.PI / 2;
  knob.position.set(hingeLeft ? width - .07 : -width + .07, height / 2, -.05);
  pivot.add(knob);
  // Обе створки должны уходить к зрителю, а не внутрь корпуса.
  pivot.userData.open = hingeLeft ? 1.45 : -1.45;
  furniture.add(pivot);
  doors.push(pivot);
}

function buildFurniture() {
  scene.remove(furniture);
  furniture = new THREE.Group();
  furniture.position.set(0, .03, 0);
  scene.add(furniture);
  doors = [];
  sidePanel(-W / 2);
  sidePanel(W / 2);
  shelf(PLINTH);
  shelf(H - T);
  box(W, PLINTH, D_BOTTOM, edge, 0, PLINTH / 2, D_BOTTOM / 2);

  if (state.variant === "shelves") {
    shelf(.34); shelf(.62);
  } else {
    const col = (W - T * 2) / 3;
    divider(-col / 2); divider(col / 2);
    shelf(.48);
    if (state.variant === "commode") {
      for (let c = 0; c < 3; c++) {
        const x = -W / 2 + T + col * (c + .5);
        doorLeaf(x, H - .025, col, H - PLINTH - .04, true);
      }
    }
  }
  updateCaption();
}

function buildRoom() {
  scene.remove(room);
  room = new THREE.Group();
  scene.add(room);
  if (!state.room) return;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), new THREE.MeshStandardMaterial({ color: 0x8b5938, roughness: .9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0; floor.receiveShadow = true; room.add(floor);
  for (let i = 0; i < 23; i++) box(.12, 2.6, .045, wallMat, -1.35 + i * .12, 1.3, .34 + Math.abs(i - 11) * .012, room);
  // Обрамление оставляет вокруг изделия заметный монтажный зазор при любом ракурсе.
  box(.08, 2.35, .11, dark, -.88, 1.15, .25, room);
  box(.08, 2.35, .11, dark, .88, 1.15, .25, room);
  box(1.84, .08, .11, dark, 0, 1.05, .25, room);
  const switchPlate = box(.09, .13, .018, new THREE.MeshStandardMaterial({ color: 0xe9e5da }), .81, 1.13, .16, room);
  switchPlate.rotation.y = .02;
}

function updateCaption() {
  const names = {
    cells: ["Шесть ячеек", "Открытое хранение · 3 × 2"],
    shelves: ["Открытые полки", "Три широких яруса"],
    commode: ["Комод с дверцами", "Три секции · внутренние полки"]
  };
  document.querySelector("#furnitureTitle").textContent = names[state.variant][0];
  document.querySelector("#furnitureSubtitle").textContent = names[state.variant][1];
  document.querySelector("#furnitureDoors").style.display = state.variant === "commode" ? "" : "none";
}

document.querySelectorAll("[data-variant]").forEach(button => button.addEventListener("click", () => {
  state.variant = button.dataset.variant;
  state.doors = false;
  document.querySelectorAll("[data-variant]").forEach(item => item.classList.toggle("active", item === button));
  document.querySelector("#furnitureDoors").classList.remove("active");
  document.querySelector("#furnitureDoors").textContent = "Открыть дверцы";
  buildFurniture();
}));

document.querySelector("#furnitureDoors").addEventListener("click", event => {
  state.doors = !state.doors;
  event.currentTarget.classList.toggle("active", state.doors);
  event.currentTarget.textContent = state.doors ? "Закрыть дверцы" : "Открыть дверцы";
});
document.querySelector("#furnitureSide").addEventListener("click", event => {
  camera.position.set(2.25, 1.18, .18);
  controls.target.set(0, .48, .12);
  controls.update();
  event.currentTarget.classList.add("active");
  setTimeout(() => event.currentTarget.classList.remove("active"), 1200);
});
document.querySelector("#furnitureRoom").addEventListener("click", event => {
  state.room = !state.room;
  event.currentTarget.classList.toggle("active", state.room);
  event.currentTarget.textContent = state.room ? "В интерьере" : "Без интерьера";
  buildRoom();
});

let doorT = 0;
function resize() {
  const width = stage.clientWidth, height = stage.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
function render() {
  requestAnimationFrame(render);
  doorT += ((state.doors ? 1 : 0) - doorT) * .08;
  const smooth = doorT * doorT * (3 - 2 * doorT);
  doors.forEach(door => door.rotation.y = door.userData.open * smooth);
  controls.update();
  renderer.render(scene, camera);
}

buildFurniture();
buildRoom();
resize();
render();
