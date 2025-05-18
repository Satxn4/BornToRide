// Importar desde el CDN la versión modular de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// Configuración de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBAnNUsoaOp4hlAmRz3o15nvV73I9RsFUs",
  authDomain: "born-to-ride-b3378.firebaseapp.com",
  projectId: "born-to-ride-b3378",
  storageBucket: "born-to-ride-b3378.appspot.com",
  messagingSenderId: "308812342103",
  appId: "1:308812342103:web:f6371c5b74fcce6fc19412"
};

// Inicializar Firebase y Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Capturar el formulario y escuchar el evento submit
document.getElementById("form-trabajador").addEventListener("submit", async (e) => {
  e.preventDefault();

  const nombre = e.target.nombre.value.trim();
  const direccion = e.target.direccion.value.trim();
  const telefono = e.target.telefono.value.trim();
  const dia = e.target.dia.value;

  try {
    // Guardar los datos en la colección "trabajadores"
    await addDoc(collection(db, "trabajadores"), {
      nombre,
      direccion,
      telefono,
      dia,
      timestamp: new Date()
    });

    alert("Datos guardados correctamente.");
    e.target.reset();
  } catch (error) {
    console.error("Error al guardar:", error);
    alert("Hubo un error al guardar los datos.");
  }
});
