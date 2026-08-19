// ============================================================
//  AULLAME AWARDS — Datos editables
//  Reemplazá estos valores de ejemplo por los reales.
//  Las fotos van en /public/img/ y se referencian como "/img/nombre.jpg"
// ============================================================

// ⭐ FECHA DE LA CEREMONIA — editá SOLO esta línea (año, mes 0-11, día, hora, min).
//    mes: 0=ene 1=feb 2=mar 3=abr 4=may 5=jun 6=jul 7=ago 8=sep 9=oct 10=nov 11=dic
export const CEREMONY_DATE = new Date(2026, 11, 19, 21, 0, 0); // 19 dic 2026, 21:00 (placeholder)

// El texto de la fecha se calcula solo a partir de CEREMONY_DATE (no lo edites a mano).
const _MESES = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
export const EVENT = {
  edicion: "II Edición",
  anio: CEREMONY_DATE.getFullYear(),
  fechaTexto: `${CEREMONY_DATE.getDate()} ${_MESES[CEREMONY_DATE.getMonth()]} ${CEREMONY_DATE.getFullYear()}`,
};

// --- Los 8 integrantes ---------------------------------------
export const MEMBERS = [
  { id: "m1", nombre: "Integrante 1", apodo: "El Alfa",        foto: "", desc: "Descripción del integrante. Editá esto en src/data.js." },
  { id: "m2", nombre: "Integrante 2", apodo: "El Estratega",   foto: "", desc: "Descripción del integrante. Editá esto en src/data.js." },
  { id: "m3", nombre: "Integrante 3", apodo: "El Payaso",      foto: "", desc: "Descripción del integrante. Editá esto en src/data.js." },
  { id: "m4", nombre: "Integrante 4", apodo: "El Fantasma",    foto: "", desc: "Descripción del integrante. Editá esto en src/data.js." },
  { id: "m5", nombre: "Integrante 5", apodo: "El Cerebrito",   foto: "", desc: "Descripción del integrante. Editá esto en src/data.js." },
  { id: "m6", nombre: "Integrante 6", apodo: "El Tanque",      foto: "", desc: "Descripción del integrante. Editá esto en src/data.js." },
  { id: "m7", nombre: "Integrante 7", apodo: "El Bardero",     foto: "", desc: "Descripción del integrante. Editá esto en src/data.js." },
  { id: "m8", nombre: "Integrante 8", apodo: "El Novato",      foto: "", desc: "Descripción del integrante. Editá esto en src/data.js." },
];

// --- Categorías de premios -----------------------------------
export const CATEGORIES = [
  { id: "c1",  nombre: "Aullame del Año",       emoji: "🐺", desc: "El premio mayor. El amigo del año.", mayor: true },
  { id: "c2",  nombre: "Mejor Anécdota",        emoji: "🎬", desc: "La historia que se contó todo el año." },
  { id: "c3",  nombre: "Papelón del Año",       emoji: "🤡", desc: "El momento más vergonzoso." },
  { id: "c4",  nombre: "Frase del Año",         emoji: "💬", desc: "Lo que quedó grabado a fuego." },
  { id: "c5",  nombre: "Desaparecido del Año",  emoji: "👻", desc: "El que nunca aparece a las juntadas." },
  { id: "c6",  nombre: "Glow Up",               emoji: "✨", desc: "El que más cambió (para bien)." },
  { id: "c7",  nombre: "MVP Fiestas",           emoji: "🎉", desc: "El alma de cada joda." },
  { id: "c8",  nombre: "Mala Leche",            emoji: "😈", desc: "El más picante del grupo." },
];

// --- Timeline del año (recuerdos, cumpleaños, momentos) -------
export const TIMELINE = [
  { mes: "ENE", titulo: "Arranque de año",   desc: "El primer asado del 2025.",      foto: "" },
  { mes: "FEB", titulo: "Cumple de fulano",  desc: "Editá este momento en data.js.", foto: "" },
  { mes: "MAR", titulo: "Escapada",          desc: "Ese viaje que nadie olvida.",    foto: "" },
  { mes: "ABR", titulo: "Juntada épica",     desc: "Editá este momento en data.js.", foto: "" },
  { mes: "JUN", titulo: "Mitad de año",      desc: "Editá este momento en data.js.", foto: "" },
  { mes: "SEP", titulo: "Primavera",         desc: "Editá este momento en data.js.", foto: "" },
  { mes: "DIC", titulo: "Cierre de año",     desc: "La previa a los Aullame Awards.", foto: "" },
];

// --- Edición 2025 (ganadores del año pasado) -----------------
export const EDITION_2025 = {
  anio: 2025,
  aullameDelAnio: { ganador: "Ganador 2025", foto: "", frase: "El primer gran Aullame de la historia." },
  ganadores: [
    { categoria: "Mejor Anécdota",       ganador: "Nombre", foto: "" },
    { categoria: "Papelón del Año",      ganador: "Nombre", foto: "" },
    { categoria: "Frase del Año",        ganador: "Nombre", foto: "" },
    { categoria: "Desaparecido del Año", ganador: "Nombre", foto: "" },
    { categoria: "MVP Fiestas",          ganador: "Nombre", foto: "" },
    { categoria: "Mala Leche",           ganador: "Nombre", foto: "" },
  ],
};

// --- Datos de la CEREMONIA 2026 (de ejemplo hasta conectar votación) ---
// Orden en que se revelan. El "Aullame del Año" va último (mayor: true).
export const CEREMONY_2026 = [
  {
    categoria: "Mala Leche", emoji: "😈",
    nominados: ["Integrante 3", "Integrante 7", "Integrante 8"],
    segundo: "Integrante 8", primero: "Integrante 7",
  },
  {
    categoria: "MVP Fiestas", emoji: "🎉",
    nominados: ["Integrante 2", "Integrante 6", "Integrante 7"],
    segundo: "Integrante 2", primero: "Integrante 6",
  },
  {
    categoria: "Frase del Año", emoji: "💬",
    nominados: ["Integrante 1", "Integrante 3", "Integrante 5"],
    segundo: "Integrante 5", primero: "Integrante 3",
  },
  {
    categoria: "Papelón del Año", emoji: "🤡",
    nominados: ["Integrante 4", "Integrante 8", "Integrante 3"],
    segundo: "Integrante 3", primero: "Integrante 8",
  },
  {
    categoria: "Mejor Anécdota", emoji: "🎬",
    nominados: ["Integrante 1", "Integrante 2", "Integrante 6"],
    segundo: "Integrante 6", primero: "Integrante 1",
  },
  {
    categoria: "AULLAME DEL AÑO", emoji: "🐺", mayor: true,
    nominados: ["Integrante 1", "Integrante 2", "Integrante 6", "Integrante 7"],
    segundo: "Integrante 2", primero: "Integrante 6",
  },
];
