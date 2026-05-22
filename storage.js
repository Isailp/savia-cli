const fs = require("fs");
const path = require("path");

const BORRADORES_PATH = path.join(__dirname, "posts/borradores.json");
const APROBADOS_PATH = path.join(__dirname, "posts/aprobados.json");

function leerArchivo(ruta) {
  if (!fs.existsSync(ruta)) return [];
  return JSON.parse(fs.readFileSync(ruta, "utf-8"));
}

function guardarArchivo(ruta, datos) {
  fs.writeFileSync(ruta, JSON.stringify(datos, null, 2), "utf-8");
}

function guardarBorrador({ pilar, tema, contenido }) {
  const borradores = leerArchivo(BORRADORES_PATH);
  const id = `B${String(borradores.length + 1).padStart(3, "0")}`;
  const nuevo = {
    id,
    pilar,
    tema: tema || null,
    contenido,
    creadoEn: new Date().toISOString(),
    estado: "borrador",
  };
  borradores.push(nuevo);
  guardarArchivo(BORRADORES_PATH, borradores);
  return id;
}

function listarBorradores() {
  return leerArchivo(BORRADORES_PATH);
}

function obtenerBorrador(id) {
  const borradores = leerArchivo(BORRADORES_PATH);
  return borradores.find((b) => b.id === id) || null;
}

function actualizarBorrador(id, contenidoNuevo) {
  const borradores = leerArchivo(BORRADORES_PATH);
  const index = borradores.findIndex((b) => b.id === id);
  if (index === -1) throw new Error(`Borrador ${id} no encontrado.`);
  borradores[index].contenido = contenidoNuevo;
  borradores[index].actualizadoEn = new Date().toISOString();
  guardarArchivo(BORRADORES_PATH, borradores);
  return borradores[index];
}

function aprobarPost(id) {
  const borradores = leerArchivo(BORRADORES_PATH);
  const index = borradores.findIndex((b) => b.id === id);
  if (index === -1) throw new Error(`Borrador ${id} no encontrado.`);

  const post = { ...borradores[index], estado: "aprobado", aprobadoEn: new Date().toISOString() };
  const aprobados = leerArchivo(APROBADOS_PATH);
  aprobados.push(post);
  guardarArchivo(APROBADOS_PATH, aprobados);

  borradores.splice(index, 1);
  guardarArchivo(BORRADORES_PATH, borradores);

  return post;
}

function listarAprobados() {
  return leerArchivo(APROBADOS_PATH);
}

module.exports = {
  guardarBorrador,
  listarBorradores,
  obtenerBorrador,
  actualizarBorrador,
  aprobarPost,
  listarAprobados,
};
