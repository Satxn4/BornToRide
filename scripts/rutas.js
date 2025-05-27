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

function mostrarRutaEnMapaCircular(lista) {
  if (!directionsService || !directionsRenderer) {
    alert("El mapa aún no se ha cargado.");
    return;
  }

  const waypoints = [];
  let actual = lista.primero;
  do {
    waypoints.push({ location: actual.direccion, stopover: true });
    actual = actual.siguiente;
  } while (actual !== lista.primero);

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

class Nodo {
  constructor(trabajador) {
    this.trabajador = trabajador;
    this.direccion = trabajador.direccion;
    this.siguiente = null;
    this.anterior = null;
  }
}

class ListaCircular {
  constructor() {
    this.primero = null;
  }

  insertarOrdenado(nuevoTrabajador) {
    const nuevoNodo = new Nodo(nuevoTrabajador);

    if (!this.primero) {
      nuevoNodo.siguiente = nuevoNodo;
      nuevoNodo.anterior = nuevoNodo;
      this.primero = nuevoNodo;
    } else {
      let actual = this.primero;
      do {
        if (nuevoTrabajador.distancia < actual.trabajador.distancia) break;
        actual = actual.siguiente;
      } while (actual !== this.primero);

      nuevoNodo.anterior = actual.anterior;
      nuevoNodo.siguiente = actual;
      actual.anterior.siguiente = nuevoNodo;
      actual.anterior = nuevoNodo;

      if (actual === this.primero && nuevoTrabajador.distancia < actual.trabajador.distancia) {
        this.primero = nuevoNodo;
      }
    }
  }

  recorrer(callback) {
    if (!this.primero) return;
    let actual = this.primero;
    do {
      callback(actual);
      actual = actual.siguiente;
    } while (actual !== this.primero);
  }
}

async function obtenerDistancias(origen, direcciones) {
  const service = new google.maps.DistanceMatrixService();
  return new Promise((resolve, reject) => {
    service.getDistanceMatrix(
      {
        origins: [origen],
        destinations: direcciones,
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
      },
      (response, status) => {
        if (status !== "OK") {
          reject("Error al obtener distancias: " + status);
        } else {
          const results = response.rows[0].elements.map((el, i) => {
            return {
              distancia: el.distance?.value || Infinity,
              texto: el.distance?.text || "N/A"
            };
          });
          resolve(results);
        }
      }
    );
  });
}

async function cargarTrabajadores() {
  rutasDiv.innerHTML = "";
  const snapshot = await getDocs(collection(db, "trabajadores"));

  const trabajadoresPorDia = {};
  snapshot.forEach(docSnap => {
    const t = { id: docSnap.id, ...docSnap.data() };
    if (!trabajadoresPorDia[t.dia]) trabajadoresPorDia[t.dia] = [];
    trabajadoresPorDia[t.dia].push(t);
  });

  for (const dia in trabajadoresPorDia) {
    const trabajadores = trabajadoresPorDia[dia];
    const direcciones = trabajadores.map(t => t.direccion);
    try {
      const distancias = await obtenerDistancias(ubicacionBase, direcciones);
      trabajadores.forEach((t, i) => {
        t.distancia = distancias[i].distancia;
        t.distanciaTexto = distancias[i].texto;
      });

      const lista = new ListaCircular();
      trabajadores.sort((a, b) => a.distancia - b.distancia).forEach(t => lista.insertarOrdenado(t));

      const contenedor = document.createElement("div");
      contenedor.innerHTML = `
        <h3>${dia}</h3>
        <button class="boton-accion boton-editar" onclick="descargarPDF('${dia}')">📄 Descargar PDF</button>
        <button class="boton-accion boton-editar" onclick="verRuta('${dia}')">🗺️ Ver ruta circular</button>
        <ul></ul>
      `;

      const ul = contenedor.querySelector("ul");
      let contador = 1;
      lista.recorrer(nodo => {
        const t = nodo.trabajador;
        const direccionURL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.direccion)}`;
        const li = document.createElement("li");
        li.innerHTML = `
          <strong>${contador}. ${t.nombre}</strong> - 
             <a href="${direccionURL}" target="_blank">${t.direccion}</a> - ${t.telefono || "Sin teléfono"}<br/>
             <em>${t.distanciaTexto}</em><br/>
            <button class="boton-accion boton-editar" onclick="editar('${t.id}')">✏️ Editar</button>
            <button class="boton-accion boton-eliminar" onclick="eliminar('${t.id}')">🗑️ Eliminar</button>
        `;
        ul.appendChild(li);
        contador++;
});



      rutasDiv.appendChild(contenedor);
      window["listaCircular_" + dia] = lista;
    } catch (err) {
      console.error("Error cargando distancias: ", err);
    }
  }
}

window.verRuta = function(dia) {
  const lista = window["listaCircular_" + dia];
  if (lista) mostrarRutaEnMapaCircular(lista);
};

window.eliminar = async function(id) {
  if (confirm("¿Eliminar este trabajador?")) {
    await deleteDoc(doc(db, "trabajadores", id));
    cargarTrabajadores();
  }
};

window.editar = async function(id) {
  const docSnap = await getDocs(collection(db, "trabajadores"));
  const trabajadorDoc = docSnap.docs.find(d => d.id === id);
  if (!trabajadorDoc) return;
  const t = trabajadorDoc.data();
  const nombre = prompt("Editar nombre:", t.nombre);
  const direccion = prompt("Editar dirección:", t.direccion);
  const telefono = prompt("Editar teléfono:", t.telefono);
  const dia = prompt("Editar día:", t.dia);
  if (nombre && direccion && telefono && dia) {
    await updateDoc(doc(db, "trabajadores", id), { nombre, direccion, telefono, dia });
    cargarTrabajadores();
  }
};
window.descargarPDF = async function(dia) {
  const lista = window["listaCircular_" + dia];
  if (!lista) {
    alert("No hay datos para ese día.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 20;
  doc.setFontSize(16);
  doc.text(`Ruta Circular - Día: ${dia}`, 10, y);
  y += 10;

  let contador = 1;
  lista.recorrer(nodo => {
    const t = nodo.trabajador;
    const texto = `${contador}. ${t.nombre} - ${t.direccion} - ${t.telefono || "Sin teléfono"} - ${t.distanciaTexto}`;
    
    // Dividir si el texto es muy largo
    const lineas = doc.splitTextToSize(texto, 180);
    if (y + lineas.length * 7 > 280) {
      doc.addPage();
      y = 20;
    }

    doc.text(lineas, 10, y);
    y += lineas.length * 7;
    contador++;
  });

  doc.save(`Ruta-${dia}.pdf`);
};

cargarTrabajadores();
export { initMap };