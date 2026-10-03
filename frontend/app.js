/* =====================================================
   ANÁLISIS DE TRANSFERENCIAS BANCARIAS - APP.JS
   Consumo de la API existente (FastAPI) y actualización
   del dashboard. No se modifica el backend ni el modelo.
   ===================================================== */

// ---------------------------------------------------------
// CONSTANTE DEL ENDPOINT (no repetir la URL en otro lugar)
// ---------------------------------------------------------
const API_URL = "http://127.0.0.1:8000/MSApiAnalisaCuenta/BancaDigital/consultar";

// Guarda en memoria la última respuesta del backend para que
// las burbujas de navegación no vuelvan a llamar a la API.
let datosCuentaActual = null;
let controladorConsulta = null;

// ---------------------------------------------------------
// REFERENCIAS DEL DOM
// ---------------------------------------------------------
const formConsulta = document.getElementById("formConsulta");
const inputCuenta = document.getElementById("inputCuenta");
const btnAnalizar = document.getElementById("btnAnalizar");
const btnAnalizarIcono = document.getElementById("btnAnalizarIcono");
const btnAnalizarTexto = document.getElementById("btnAnalizarTexto");
const btnAnalizarSpinner = document.getElementById("btnAnalizarSpinner");
const btnNuevaConsulta = document.getElementById("btnNuevaConsulta");

const estadoCarga = document.getElementById("estadoCarga");
const estadoExito = document.getElementById("estadoExito");
const estadoExitoTexto = document.getElementById("estadoExitoTexto");
const estadoError = document.getElementById("estadoError");
const estadoErrorTexto = document.getElementById("estadoErrorTexto");

const estadoInicial = document.getElementById("estadoInicial");
const dashboardContent = document.getElementById("dashboardContent");

const bubbleNav = document.getElementById("bubbleNav");

// ---------------------------------------------------------
// INICIO: registrar eventos
// ---------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  formConsulta.addEventListener("submit", (evento) => {
    evento.preventDefault();
    consultarCuenta();
  });

  inputCuenta.addEventListener("input", () => {
    if (inputCuenta.value.trim()) {
      inputCuenta.setAttribute("aria-invalid", "false");
      ocultarError();
    }
    ocultarExito();
  });

  // Nueva consulta (reset dinámico del dashboard)
  if (btnNuevaConsulta) {
    btnNuevaConsulta.addEventListener("click", () => {
      reiniciarDashboard();
    });
  }

  bubbleNav.addEventListener("click", (evento) => {
    const boton = evento.target.closest(".nav-bubble");
    if (!boton) return;
    mostrarVista(boton.dataset.vista);
  });
});

// ---------------------------------------------------------
// CONSULTAR CUENTA (fetch al backend)
// ---------------------------------------------------------
async function consultarCuenta() {
  const cuenta = inputCuenta.value.trim();

  ocultarError();
  ocultarExito();

  if (!cuenta) {
    mostrarError("Ingresa un número de cuenta antes de iniciar el análisis.", true);
    inputCuenta.focus();
    return;
  }

  inputCuenta.setAttribute("aria-invalid", "false");
  controladorConsulta?.abort();
  const controladorActual = new AbortController();
  controladorConsulta = controladorActual;
  mostrarCarga(true);

  try {
    const respuesta = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ cuenta: cuenta }),
      signal: controladorActual.signal
    });

    if (!respuesta.ok) {
      let mensaje = "No se pudo obtener la información de la cuenta.";
      try {
        const errorJson = await respuesta.json();
        if (errorJson && errorJson.detail) {
          mensaje = errorJson.detail;
        }
      } catch (errorParseo) {
        // El cuerpo del error no era JSON; se usa el mensaje por defecto.
      }
      const errorConsulta = new Error(mensaje);
      errorConsulta.status = respuesta.status;
      throw errorConsulta;
    }

    const datos = await respuesta.json();
    datosCuentaActual = datos;
    mostrarDatos(datos);
    mostrarExito(`Análisis completado para ${datos.cuenta}.`);

  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }

    // TypeError ocurre cuando fetch no logra conectarse (servidor apagado, CORS, red).
    if (error instanceof TypeError) {
      mostrarError(
        "No pudimos conectar con el servicio de análisis. Verifica que esté disponible e inténtalo nuevamente."
      );
    } else {
      mostrarError(error.message, error.status === 400 || error.status === 404);
    }
  } finally {
    if (controladorConsulta === controladorActual) {
      controladorConsulta = null;
      mostrarCarga(false);
    }
  }
}

// ---------------------------------------------------------
// REINICIAR DASHBOARD (limpia estado sin recargar la página)
// ---------------------------------------------------------
function reiniciarDashboard() {
  controladorConsulta?.abort();
  controladorConsulta = null;

  // limpiar referencia a datos
  datosCuentaActual = null;

  // ocultar secciones de resultado y mostrar estado inicial
  estadoInicial.classList.remove("d-none");
  dashboardContent.classList.add("d-none");

  // limpiar campo de entrada y foco
  inputCuenta.value = "";
  inputCuenta.setAttribute("aria-invalid", "false");
  inputCuenta.focus();

  // limpiar errores y carga
  ocultarError();
  ocultarExito();
  mostrarCarga(false);

  // KPIs
  const safeEmpty = "—";
  const idsToClear = [
    "valorSegmento", "valorComportamiento", "valorTransferencias",
    "valorMontoTotal", "valorMontoPromedio", "valorDestinos"
  ];
  idsToClear.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = safeEmpty;
  });

  // Badges (mantener icono, limpiar texto y clases)
  const badgeIds = ["badgeCluster", "badgeClasificacion", "comportamientoBadgeCluster"];
  badgeIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === 'badgeCluster' || id === 'comportamientoBadgeCluster') {
        el.textContent = `Cluster —`;
      } else {
        el.textContent = safeEmpty;
      }
      el.classList.remove("badge-atipico", "badge-habitual", "badge-cluster-0", "badge-cluster-1", "badge-cluster-2", "badge-cluster-3");
    }
  });
  document.querySelectorAll(".status-badge").forEach((badge) => {
    badge.classList.remove("is-green-status");
  });

  // Resumen
  const resumenIds = [
    "resumenCuenta", "resumenSegmentoNombre", "resumenDescripcion",
    "resumenTransferencias", "resumenMontoTotal", "resumenMontoPromedio", "resumenDestinos", "resumenAdvertencia"
  ];
  resumenIds.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = safeEmpty; });

  // Actividad
  const actividadIds = ["actividadTransferencias", "actividadMontoTotal", "actividadMontoPromedio", "actividadMontoMaximo", "actividadDestinos", "actividadDias", "comparativaMontoPromedio", "comparativaMontoMaximo"];
  actividadIds.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = safeEmpty; });
  const barraProm = document.getElementById("barraMontoPromedio"); if (barraProm) barraProm.style.width = '0%';
  const barraMax = document.getElementById("barraMontoMaximo"); if (barraMax) barraMax.style.width = '0%';

  // Comportamiento
  const compIds = ["comportamientoSegmentoNombre", "comportamientoDescripcion", "comportamientoClasificacionTexto", "comportamientoFinSemana", "comportamientoNocturnas", "comportamientoCanalMovil", "comportamientoMontosAtipicos"];
  compIds.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = safeEmpty; });
  const cajaClas = document.getElementById("comportamientoClasificacionBox"); if (cajaClas) cajaClas.classList.remove("es-atipico", "es-habitual");

  // Indicadores (barras)
  const indicadorVals = ["indFinSemanaValor", "indNocturnasValor", "indCanalMovilValor", "indMontosAtipicosValor"];
  indicadorVals.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = safeEmpty; });
  const indicadorBars = ["indFinSemanaBarra", "indNocturnasBarra", "indCanalMovilBarra", "indMontosAtipicosBarra"];
  indicadorBars.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.width = "0%";
    el.setAttribute("aria-valuenow", "0");
    el.parentElement?.setAttribute("aria-valuenow", "0");
  });

  // Técnico
  const tecnicoIds = ["tecnicoCluster", "tecnicoPuntaje", "tecnicoModelo", "tecnicoFraude", "tecnicoCredito", "tecnicoAdvertencia"];
  tecnicoIds.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = safeEmpty; });

  // Asegurar que el menú deje a 'resumen' activo
  mostrarVista("resumen");
}

// ---------------------------------------------------------
// MOSTRAR DATOS: punto de entrada tras una respuesta exitosa
// ---------------------------------------------------------
function mostrarDatos(datos) {
  estadoInicial.classList.add("d-none");
  dashboardContent.classList.remove("d-none");

  actualizarKPIs(datos);
  actualizarResumen(datos);
  actualizarActividad(datos);
  actualizarComportamiento(datos);
  actualizarIndicadores(datos);
  actualizarDetallesTecnicos(datos);

  mostrarVista("resumen");
}

// ---------------------------------------------------------
// TARJETAS KPI SUPERIORES
// ---------------------------------------------------------
function actualizarKPIs(datos) {
  const modelo = datos.resultado_modelo;
  const actividad = datos.actividad;

  document.getElementById("valorSegmento").textContent = modelo.segmento_cuenta;

  const badgeCluster = document.getElementById("badgeCluster");
  badgeCluster.textContent = `Cluster ${modelo.cluster_tecnico}`;
  aplicarColorCluster(badgeCluster, modelo.cluster_tecnico);

  const valorComportamiento = document.getElementById("valorComportamiento");
  valorComportamiento.textContent = datos.evaluacion.comportamiento.toUpperCase();

  const badgeClasificacion = document.getElementById("badgeClasificacion");
  badgeClasificacion.textContent = modelo.clasificacion;
  badgeClasificacion.classList.remove("badge-atipico", "badge-habitual");
  badgeClasificacion.classList.add(modelo.es_atipica ? "badge-atipico" : "badge-habitual");
  badgeClasificacion
    .closest(".profile-badge")
    ?.classList.add("is-green-status");

  document.getElementById("valorTransferencias").textContent =
    formatearNumero(actividad.numero_transferencias);
  document.getElementById("valorMontoTotal").textContent =
    formatearMoneda(actividad.monto_total);
  document.getElementById("valorMontoPromedio").textContent =
    formatearMoneda(actividad.monto_promedio);
  document.getElementById("valorDestinos").textContent =
    formatearNumero(actividad.destinos_distintos);
}

// ---------------------------------------------------------
// VISTA: RESUMEN
// ---------------------------------------------------------
function actualizarResumen(datos) {
  const modelo = datos.resultado_modelo;
  const actividad = datos.actividad;

  document.getElementById("resumenCuenta").textContent = datos.cuenta;
  document.getElementById("resumenSegmentoNombre").textContent = modelo.segmento_cuenta;
  document.getElementById("resumenDescripcion").textContent = modelo.descripcion;

  document.getElementById("resumenTransferencias").textContent =
    formatearNumero(actividad.numero_transferencias);
  document.getElementById("resumenMontoTotal").textContent =
    formatearMoneda(actividad.monto_total);
  document.getElementById("resumenMontoPromedio").textContent =
    formatearMoneda(actividad.monto_promedio);
  document.getElementById("resumenDestinos").textContent =
    formatearNumero(actividad.destinos_distintos);

  // Se prioriza la advertencia devuelta por el backend.
  document.getElementById("resumenAdvertencia").textContent =
    datos.advertencia || "Un perfil atípico no confirma fraude.";
}

// ---------------------------------------------------------
// VISTA: ACTIVIDAD
// ---------------------------------------------------------
function actualizarActividad(datos) {
  const actividad = datos.actividad;

  document.getElementById("actividadTransferencias").textContent =
    formatearNumero(actividad.numero_transferencias);
  document.getElementById("actividadMontoTotal").textContent =
    formatearMoneda(actividad.monto_total);
  document.getElementById("actividadMontoPromedio").textContent =
    formatearMoneda(actividad.monto_promedio);
  document.getElementById("actividadMontoMaximo").textContent =
    formatearMoneda(actividad.monto_maximo);
  document.getElementById("actividadDestinos").textContent =
    formatearNumero(actividad.destinos_distintos);
  document.getElementById("actividadDias").textContent =
    formatearNumero(actividad.dias_con_actividad);

  // Comparativa visual: promedio y máximo como proporción del monto máximo.
  const maximo = actividad.monto_maximo > 0 ? actividad.monto_maximo : 1;
  const porcentajePromedio = Math.min(100, (actividad.monto_promedio / maximo) * 100);

  document.getElementById("barraMontoPromedio").style.width = `${porcentajePromedio}%`;
  document.getElementById("barraMontoMaximo").style.width = "100%";

  document.getElementById("comparativaMontoPromedio").textContent =
    formatearMoneda(actividad.monto_promedio);
  document.getElementById("comparativaMontoMaximo").textContent =
    formatearMoneda(actividad.monto_maximo);
}

// ---------------------------------------------------------
// VISTA: COMPORTAMIENTO
// ---------------------------------------------------------
function actualizarComportamiento(datos) {
  const modelo = datos.resultado_modelo;
  const actividad = datos.actividad;

  document.getElementById("comportamientoSegmentoNombre").textContent = modelo.segmento_cuenta;
  document.getElementById("comportamientoDescripcion").textContent = modelo.descripcion;

  const badgeCluster = document.getElementById("comportamientoBadgeCluster");
  badgeCluster.textContent = `Cluster ${modelo.cluster_tecnico}`;
  aplicarColorCluster(badgeCluster, modelo.cluster_tecnico);

  const cajaClasificacion = document.getElementById("comportamientoClasificacionBox");
  const textoClasificacion = document.getElementById("comportamientoClasificacionTexto");
  textoClasificacion.textContent = `${modelo.clasificacion} · ${datos.evaluacion.comportamiento}`;
  cajaClasificacion.classList.remove("es-atipico", "es-habitual");
  cajaClasificacion.classList.add(modelo.es_atipica ? "es-atipico" : "es-habitual");

  document.getElementById("comportamientoFinSemana").textContent =
    formatearPorcentaje(actividad.porcentaje_fin_semana);
  document.getElementById("comportamientoNocturnas").textContent =
    formatearPorcentaje(actividad.porcentaje_nocturnas);
  document.getElementById("comportamientoCanalMovil").textContent =
    formatearPorcentaje(actividad.porcentaje_canal_movil);
  document.getElementById("comportamientoMontosAtipicos").textContent =
    formatearPorcentaje(actividad.porcentaje_montos_atipicos);
}

// ---------------------------------------------------------
// VISTA: INDICADORES (barras de progreso)
// ---------------------------------------------------------
function actualizarIndicadores(datos) {
  const actividad = datos.actividad;

  actualizarBarraIndicador(
    "indFinSemanaValor",
    "indFinSemanaBarra",
    actividad.porcentaje_fin_semana
  );
  actualizarBarraIndicador(
    "indNocturnasValor",
    "indNocturnasBarra",
    actividad.porcentaje_nocturnas
  );
  actualizarBarraIndicador(
    "indCanalMovilValor",
    "indCanalMovilBarra",
    actividad.porcentaje_canal_movil
  );
  actualizarBarraIndicador(
    "indMontosAtipicosValor",
    "indMontosAtipicosBarra",
    actividad.porcentaje_montos_atipicos
  );
}

function actualizarBarraIndicador(idValor, idBarra, porcentaje) {
  const porcentajeSeguro = Math.max(0, Math.min(100, porcentaje));
  document.getElementById(idValor).textContent = formatearPorcentaje(porcentaje);

  const barra = document.getElementById(idBarra);
  barra.style.width = `${porcentajeSeguro}%`;
  barra.setAttribute("aria-valuenow", porcentajeSeguro.toFixed(0));
  barra.parentElement?.setAttribute("aria-valuenow", porcentajeSeguro.toFixed(0));
}

// ---------------------------------------------------------
// VISTA: DETALLES TÉCNICOS
// ---------------------------------------------------------
function actualizarDetallesTecnicos(datos) {
  const modelo = datos.resultado_modelo;

  document.getElementById("tecnicoCluster").textContent =
    `${modelo.cluster_tecnico} — ${modelo.cluster_descripcion}`;
  document.getElementById("tecnicoPuntaje").textContent =
    modelo.puntaje_atipicidad.toFixed(5);
  document.getElementById("tecnicoModelo").textContent = datos.modelo;

  // El backend indica explícitamente que estos aspectos no son
  // determinados por el modelo; se muestran solo como información técnica.
  document.getElementById("tecnicoFraude").textContent =
    `Evaluación de fraude: ${datos.evaluacion.fraude}`;
  document.getElementById("tecnicoCredito").textContent =
    `Evaluación crediticia: ${datos.evaluacion.credito}`;

  document.getElementById("tecnicoAdvertencia").textContent =
    datos.advertencia || "Este modelo no determina fraude ni aprobación o rechazo de créditos.";
}

// ---------------------------------------------------------
// NAVEGACIÓN POR BURBUJAS (cambia de vista sin recargar)
// ---------------------------------------------------------
function mostrarVista(nombreVista) {
  document.querySelectorAll(".vista-panel").forEach((panel) => {
    panel.classList.toggle("d-none", panel.dataset.vistaPanel !== nombreVista);
  });

  document.querySelectorAll(".nav-bubble").forEach((boton) => {
    const estaActivo = boton.dataset.vista === nombreVista;
    boton.classList.toggle("active", estaActivo);
    if (estaActivo) {
      boton.setAttribute("aria-current", "page");
    } else {
      boton.removeAttribute("aria-current");
    }
  });
}

// ---------------------------------------------------------
// UTILIDADES DE FORMATO
// ---------------------------------------------------------
function formatearMoneda(valor) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
}

function formatearNumero(valor) {
  return new Intl.NumberFormat("es-EC").format(valor);
}

function formatearPorcentaje(valor) {
  const numero = new Intl.NumberFormat("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
  return `${numero} %`;
}

// ---------------------------------------------------------
// COLOR DISTINTIVO POR CLUSTER (solo como acento visual)
// ---------------------------------------------------------
function aplicarColorCluster(elemento, cluster) {
  elemento.classList.remove(
    "badge-cluster-0",
    "badge-cluster-1",
    "badge-cluster-2",
    "badge-cluster-3"
  );
  elemento.classList.add(`badge-cluster-${cluster}`);
  elemento
    .closest(".cluster-badge")
    ?.classList.add("is-green-status");
}

// ---------------------------------------------------------
// ESTADOS DE CARGA Y ERROR
// ---------------------------------------------------------
function mostrarCarga(activo) {
  estadoCarga.classList.toggle("d-none", !activo);
  btnAnalizar.disabled = activo;
  btnAnalizarIcono.classList.toggle("d-none", activo);
  btnAnalizarTexto.textContent = activo ? "ANALIZANDO..." : "ANALIZAR";
  btnAnalizarSpinner.classList.toggle("d-none", !activo);
  formConsulta.setAttribute("aria-busy", String(activo));
  dashboardContent.setAttribute("aria-busy", String(activo));
}

function mostrarError(mensaje, marcarCampo = false) {
  ocultarExito();
  estadoErrorTexto.textContent = mensaje;
  estadoError.classList.remove("d-none");
  inputCuenta.setAttribute("aria-invalid", String(marcarCampo));
}

function ocultarError() {
  estadoError.classList.add("d-none");
  estadoErrorTexto.textContent = "";
}

function mostrarExito(mensaje) {
  ocultarError();
  estadoExitoTexto.textContent = mensaje;
  estadoExito.classList.remove("d-none");
}

function ocultarExito() {
  estadoExito.classList.add("d-none");
  estadoExitoTexto.textContent = "";
}
