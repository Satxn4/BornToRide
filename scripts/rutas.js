import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBAnNUsoaOp4hlAmRz3o15nvV73I9RsFUs",
  authDomain: "born-to-ride-b3378.firebaseapp.com",
  projectId: "born-to-ride-b3378",
  storageBucket: "born-to-ride-b3378.appspot.com",
  messagingSenderId: "308812342103",
  appId: "1:308812342103:web:f6371c5b74fcce6fc19412"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const rutasDiv = document.getElementById("rutas");
const ubicacionBase = "Manuel Montt 367, Providencia, Santiago, Chile";

// Google Maps
let map, directionsService, directionsRenderer;

function initMap() {
  map = new google.maps.Map(document.getElementById("mapa-ruta"), {
    center: { lat: -33.4372, lng: -70.6506 },
    zoom: 12
  });
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({ map });
}
window.initMap = initMap;

function mostrarRutaEnMapa(direcciones) {
  if (!directionsService || !directionsRenderer) {
    alert("El mapa aún no se ha cargado.");
    return;
  }

  if (!direcciones || direcciones.length === 0) {
    alert("No hay direcciones para mostrar.");
    return;
  }

  const waypoints = direcciones.map(dir => ({
    location: dir,
    stopover: true
  }));

  directionsService.route(
    {
      origin: ubicacionBase,
      destination: ubicacionBase,
      waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: false
    },
    (result, status) => {
      if (status === "OK") {
        directionsRenderer.setDirections(result);
      } else {
        alert("No se pudo generar la ruta: " + status);
      }
    }
  );
}

async function obtenerDistancias(ubicacionBase, direcciones) {
  const apiKey = "AIzaSyClneoLfhXNZgjOuMUhP-L2h0Jpg3lOlE4";
  const destinos = direcciones.map(d => encodeURIComponent(d)).join("|");
  const origen = encodeURIComponent(ubicacionBase);
  const url = `https://cors-anywhere.herokuapp.com/https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origen}&destinations=${destinos}&key=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "OK") throw new Error("Error al obtener distancias");

  return data.rows[0].elements.map((el, i) => {
    if (el.status !== "OK") {
      return {
        direccion: direcciones[i],
        distancia: Infinity,
        texto: "Distancia no disponible"
      };
    }
    return {
      direccion: direcciones[i],
      distancia: el.distance.value,
      texto: el.distance.text
    };
  });
}

async function eliminarTrabajador(id) {
  if (confirm("¿Estás seguro de que deseas eliminar este trabajador?")) {
    await deleteDoc(doc(db, "trabajadores", id));
    cargarTrabajadores();
  }
}
window.eliminar = eliminarTrabajador;

function mostrarFormularioEdicion(trabajador) {
  const nombre = prompt("Editar nombre:", trabajador.nombre);
  const direccion = prompt("Editar dirección:", trabajador.direccion);
  const telefono = prompt("Editar teléfono:", trabajador.telefono);
  const dia = prompt("Editar día (lunes a domingo):", trabajador.dia);

  if (nombre && direccion && telefono && dia) {
    actualizarTrabajador(trabajador.id, { nombre, direccion, telefono, dia });
  }
}

async function actualizarTrabajador(id, nuevosDatos) {
  const ref = doc(db, "trabajadores", id);
  await updateDoc(ref, nuevosDatos);
  cargarTrabajadores();
}

window.editar = async (id) => {
  const trabajadoresRef = collection(db, "trabajadores");
  const snapshot = await getDocs(trabajadoresRef);
  const trabajador = snapshot.docs.find(doc => doc.id === id)?.data();
  if (trabajador) {
    mostrarFormularioEdicion({ id, ...trabajador });
  }
};

window.verRuta = function (dia) {
  const trabajadores = window.datosPorDia?.[dia];
  if (!trabajadores || trabajadores.length === 0) {
    alert("No hay trabajadores para ese día.");
    return;
  }
  const direcciones = trabajadores.map(t => t.direccion);
  mostrarRutaEnMapa(direcciones);
};

window.descargarPDF = function (dia) {
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) {
    alert("No se pudo cargar jsPDF.");
    return;
  }

  const doc = new jsPDF();

  const fecha = new Date().toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  doc.setFontSize(16);
  doc.text(`RutaSmart - Lista de trabajadores`, 10, 20);
  doc.setFontSize(12);
  doc.text(`Día: ${dia.charAt(0).toUpperCase() + dia.slice(1)} - Fecha: ${fecha}`, 10, 28);

  const trabajadores = window.datosPorDia[dia];
  let y = 40;

  trabajadores.forEach((t, i) => {
    const direccionURL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.direccion)}`;
    doc.text(`${i + 1}. ${t.nombre}`, 10, y);
    doc.textWithLink(t.direccion, 10, y + 6, { url: direccionURL });
    doc.text(`Teléfono: ${t.telefono}`, 10, y + 12);
    doc.text(`Distancia: ${t.distanciaTexto}`, 10, y + 18);
    y += 28;
  });

  doc.save(`ruta_${dia}.pdf`);
};

async function cargarTrabajadores() {
  rutasDiv.innerHTML = "";

  const trabajadoresRef = collection(db, "trabajadores");
  const snapshot = await getDocs(trabajadoresRef);

  let trabajadores = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    trabajadores.push({ id: doc.id, ...data });
  });

  const dias = {};
  trabajadores.forEach(t => {
    if (!dias[t.dia]) dias[t.dia] = [];
    dias[t.dia].push(t);
  });

  for (const dia in dias) {
    const direcciones = dias[dia].map(t => t.direccion);
    try {
      const distancias = await obtenerDistancias(ubicacionBase, direcciones);

      dias[dia] = dias[dia].map((t, i) => ({
        ...t,
        distancia: distancias[i].distancia,
        distanciaTexto: distancias[i].texto
      })).sort((a, b) => a.distancia - b.distancia);
    } catch (error) {
      console.error(`Error al obtener distancias para ${dia}:`, error);
    }
  }

  const diasOrdenados = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  diasOrdenados.forEach(dia => {
    if (dias[dia]) {
      const diaDiv = document.createElement("div");
      diaDiv.innerHTML = `
        <h3>${dia.charAt(0).toUpperCase() + dia.slice(1)}</h3>
        <button class="boton-accion boton-editar" onclick="descargarPDF('${dia}')">📄 Descargar PDF</button>
        <button class="boton-accion boton-editar" onclick="verRuta('${dia}')">🗺️ Ver ruta circular</button>
        <ul></ul>
      `;
      const ul = diaDiv.querySelector("ul");

      dias[dia].forEach(t => {
        const li = document.createElement("li");
        li.innerHTML = `
          <strong>${t.nombre}</strong> - 
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.direccion)}" target="_blank">
            ${t.direccion}
          </a> - ${t.telefono}<br/>
          <em>${t.distanciaTexto}</em><br/>
          <button class="boton-accion boton-editar" onclick="editar('${t.id}')">✏️ Editar</button>
          <button class="boton-accion boton-eliminar" onclick="eliminar('${t.id}')">🗑️ Eliminar</button>
        `;
        ul.appendChild(li);
      });

      const regreso = document.createElement("li");
      regreso.innerHTML = `
        <strong>Regreso a base:</strong> 
        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ubicacionBase)}" target="_blank">
          ${ubicacionBase}
        </a>
      `;
      ul.appendChild(regreso);

      rutasDiv.appendChild(diaDiv);
    }
  });

  // Guardar datos para funciones globales
  window.datosPorDia = dias;
}
export { initMap };

// Iniciar la carga
cargarTrabajadores();
