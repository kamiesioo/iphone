// Datos iniciales. Solo se usan la PRIMERA vez que arranca el servidor con un volumen vacío;
// después todo se edita desde /admin y vive en la base de datos.
// Elegí el perfil con la variable de entorno TIENDA (demo | mundoapple | iphonevm).

const ACENTO = "#659E9B";

export const TIENDAS = {
  demo: {
    nombre: "KorionPhones",
    eslogan: "Tu próximo iPhone, con garantía y financiación.",
    ciudad: "Argentina",
    whatsapp: "",
    instagram: "",
    horario: "Lun a Sáb · 9 a 13 y 17 a 21 hs",
    direccion: "",
    sobre: "Somos una tienda especializada en iPhone: equipos nuevos y usados, revisados uno por uno, con garantía y atención personalizada.",
    acento: ACENTO,
    moneda: "USD",
    servicios: { financiacion: true, usados: true, mayorista: false, accesorios: true },
  },
  mundoapple: {
    nombre: "Mundo Apple VM",
    eslogan: "Equipos Apple, JBL y accesorios. Venta minorista y mayorista.",
    ciudad: "Villa María",
    whatsapp: "",
    instagram: "mundoapple.vm",
    horario: "Consultar horarios por WhatsApp",
    direccion: "",
    sobre: "Somos una tienda de tecnología en Villa María: equipos Apple originales, atención cercana y garantía en cada compra.",
    acento: ACENTO,
    moneda: "USD",
    servicios: { financiacion: false, usados: false, mayorista: true, accesorios: true },
  },
  iphonevm: {
    nombre: "iPhone Villa María",
    eslogan: "Nuevos y usados con garantía. Financiación con tarjeta o DNI. Recibimos tu usado.",
    ciudad: "Villa María",
    whatsapp: "",
    instagram: "iphone.vm",
    horario: "Consultar horarios por WhatsApp",
    direccion: "",
    sobre: "Somos una tienda de tecnología en Villa María: equipos Apple originales, atención cercana y garantía en cada compra.",
    acento: ACENTO,
    moneda: "USD",
    servicios: { financiacion: true, usados: true, mayorista: false, accesorios: false },
  },
};

// Productos de ejemplo (precios y stock inventados). Se borran/editan desde /admin.
export const PRODUCTOS_DEMO = [
  { modelo: "iPhone 18 Pro", linea: "Pro", gb: 256, color: "Titanio", estado: "nuevo", precio: 1500, stock: 3, tono: "#c9a98a" },
  { modelo: "iPhone Duo", linea: "Duo", gb: 256, color: "Grafito", estado: "nuevo", precio: 1700, stock: 1, tono: "#5a4a72" },
  { modelo: "iPhone Air", linea: "Air", gb: 256, color: "Negro Espacial", estado: "nuevo", precio: 1200, stock: 2, tono: "#3c4452" },
  { modelo: "iPhone 17", linea: "Estándar", gb: 256, color: "Azul Niebla", estado: "nuevo", precio: 1100, stock: 4, tono: "#7a8cf0" },
  { modelo: "iPhone 17e", linea: "e", gb: 128, color: "Blanco", estado: "nuevo", precio: 800, stock: 5, tono: "#d9d4cb" },
  { modelo: "iPhone 16 Pro Max", linea: "Pro", gb: 256, color: "Titanio Desierto", estado: "nuevo", precio: 1350, stock: 3, tono: "#c9a98a", descuento: 10 },
  { modelo: "iPhone 16 Pro", linea: "Pro", gb: 128, color: "Titanio Natural", estado: "nuevo", precio: 1150, stock: 2, tono: "#b8b3a8", descuento: 12 },
  { modelo: "iPhone 16", linea: "Estándar", gb: 128, color: "Ultramarino", estado: "nuevo", precio: 900, stock: 5, tono: "#6a7be0", descuento: 15 },
  { modelo: "iPhone 15 Pro", linea: "Pro", gb: 256, color: "Titanio Azul", estado: "nuevo", precio: 1000, stock: 1, tono: "#4a5a72", descuento: 18 },
  { modelo: "iPhone 15", linea: "Estándar", gb: 128, color: "Rosa", estado: "nuevo", precio: 750, stock: 0, tono: "#e9b7c0", descuento: 20 },
  { modelo: "iPhone 14 Pro", linea: "Pro", gb: 128, color: "Morado Oscuro", estado: "usado", bateria: 91, precio: 650, stock: 2, tono: "#5a4a72", descuento: 10 },
  { modelo: "iPhone 14", linea: "Estándar", gb: 128, color: "Medianoche", estado: "usado", bateria: 88, precio: 480, stock: 3, tono: "#2b2f3a" },
  { modelo: "iPhone 13", linea: "Estándar", gb: 128, color: "Azul", estado: "usado", bateria: 86, precio: 380, stock: 4, tono: "#6d93b8", descuento: 12 },
  { modelo: "iPhone 13 mini", linea: "Mini", gb: 128, color: "Rojo", estado: "usado", bateria: 85, precio: 330, stock: 1, tono: "#c0392b" },
  { modelo: "iPhone 12", linea: "Estándar", gb: 64, color: "Blanco", estado: "usado", bateria: 84, precio: 270, stock: 2, tono: "#e8e8ea" },
  { modelo: "iPhone 11", linea: "Estándar", gb: 64, color: "Negro", estado: "usado", bateria: 82, precio: 210, stock: 3, tono: "#1e1e22", descuento: 15 },
  { modelo: "iPhone SE (3.ª gen)", linea: "SE", gb: 64, color: "Estelar", estado: "usado", bateria: 87, precio: 230, stock: 2, tono: "#d9d4cb" },
];
