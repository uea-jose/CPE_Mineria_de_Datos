from pathlib import Path
import json

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# ---------------------------------------------------------
# RUTAS
# ---------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
ARTEFACTOS_DIR = BASE_DIR / "artefactos"


# ---------------------------------------------------------
# CARGAR CONFIGURACIÓN
# ---------------------------------------------------------

with open(
    ARTEFACTOS_DIR / "configuracion_modelo.json",
    "r",
    encoding="utf-8"
) as archivo:
    configuracion = json.load(archivo)


# ---------------------------------------------------------
# CARGAR MODELOS
# ---------------------------------------------------------

scaler = joblib.load(
    ARTEFACTOS_DIR / "scaler_final.joblib"
)

modelo_kmeans = joblib.load(
    ARTEFACTOS_DIR / "modelo_kmeans_final.joblib"
)

modelo_isolation = joblib.load(
    ARTEFACTOS_DIR / "modelo_isolation_final.joblib"
)


# ---------------------------------------------------------
# CARGAR PERFILES DE CUENTAS
# ---------------------------------------------------------

perfiles = pd.read_csv(
    ARTEFACTOS_DIR / "perfiles_modelados.csv.gz",
    dtype={"CtaOrigen": str}
)


# ---------------------------------------------------------
# DATOS QUE RECIBE EL FRONTEND
# ---------------------------------------------------------

class ConsultaCuenta(BaseModel):
    cuenta: str


# ---------------------------------------------------------
# FASTAPI
# ---------------------------------------------------------

app = FastAPI(
    title="MSApiAnalisaCuenta",
    description=(
        "API para segmentación de cuentas y detección "
        "de comportamientos atípicos mediante "
        "K-Means e Isolation Forest."
    ),
    version="1.0.0",
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# INICIO
# ---------------------------------------------------------

@app.get("/")
def inicio():
    return {
        "aplicacion": "MSApiAnalisaCuenta",
        "modelo": configuracion["nombre_modelo"],
        "cuentas_disponibles": len(perfiles),
        "estado": "API funcionando"
    }


# ---------------------------------------------------------
# SALUD
# ---------------------------------------------------------

@app.get("/MSApiAnalisaCuenta/salud")
def comprobar_salud():
    return {
        "estado": "correcto",
        "modelo": configuracion["nombre_modelo"],
        "numero_grupos": configuracion["numero_grupos"],
        "cuentas_cargadas": len(perfiles)
    }


# ---------------------------------------------------------
# CONSULTAR CUENTA
# ---------------------------------------------------------

@app.post("/MSApiAnalisaCuenta/BancaDigital/consultar")
def consultar_cuenta(datos: ConsultaCuenta):

    try:

        # -------------------------------------------------
        # NORMALIZAR CUENTA
        # -------------------------------------------------

        cuenta = datos.cuenta.strip()

        if not cuenta:
            raise HTTPException(
                status_code=400,
                detail="Debe ingresar una cuenta."
            )

        if not cuenta.lower().startswith("cue_"):
            cuenta = f"cue_{cuenta}"

        # -------------------------------------------------
        # BUSCAR CUENTA
        # -------------------------------------------------

        resultado = perfiles[
            perfiles["CtaOrigen"].str.lower() == cuenta.lower()
        ]

        if resultado.empty:
            raise HTTPException(
                status_code=404,
                detail=f"La cuenta {cuenta} no fue encontrada."
            )

        perfil = resultado.iloc[0]

        # -------------------------------------------------
        # OBTENER LAS 12 CARACTERÍSTICAS
        # -------------------------------------------------

        features = configuracion["features"]

        valores = {
            feature: float(perfil[feature])
            for feature in features
        }

        X = pd.DataFrame(
            [valores],
            columns=features
        )

        # -------------------------------------------------
        # ESCALAR
        # -------------------------------------------------

        X_escalado = scaler.transform(X)

        # -------------------------------------------------
        # K-MEANS
        # -------------------------------------------------

        cluster = int(
            modelo_kmeans.predict(X_escalado)[0]
        )

        grupo = configuracion["grupos"][str(cluster)]

        # -------------------------------------------------
        # ISOLATION FOREST
        # -------------------------------------------------

        prediccion_isolation = int(
            modelo_isolation.predict(X_escalado)[0]
        )

        puntaje_atipicidad = float(
            modelo_isolation.decision_function(
                X_escalado
            )[0]
        )

        es_atipica = prediccion_isolation == -1

        if es_atipica:
            clasificacion = "Perfil atípico"
        else:
            clasificacion = "Perfil habitual"

        # -------------------------------------------------
        # RESPUESTA
        # -------------------------------------------------

        return {

            "cuenta": cuenta,

            "resultado_modelo": {

                "segmento_cuenta": grupo["nombre"],

                "cluster_tecnico": cluster,

                "cluster_descripcion": (
                    f"Cluster {cluster}: {grupo['nombre']}"
                ),

                "descripcion": grupo["descripcion"],

                "es_atipica": es_atipica,

                "clasificacion": clasificacion,

                "puntaje_atipicidad": round(
                    puntaje_atipicidad,
                    6
                )
            },

            "actividad": {

                "numero_transferencias": int(
                    perfil["num_transferencias"]
                ),

                "monto_total": round(
                    float(perfil["monto_total"]),
                    2
                ),

                "monto_promedio": round(
                    float(perfil["monto_promedio"]),
                    2
                ),

                "monto_maximo": round(
                    float(perfil["monto_maximo"]),
                    2
                ),

                "destinos_distintos": int(
                    perfil["destinos_distintos"]
                ),

                "dias_con_actividad": int(
                    perfil["dias_con_actividad"]
                ),

                "porcentaje_fin_semana": round(
                    float(perfil["pct_fin_semana"]),
                    2
                ),

                "porcentaje_nocturnas": round(
                    float(perfil["pct_nocturnas"]),
                    2
                ),

                "porcentaje_canal_movil": round(
                    float(perfil["pct_canal_movil"]),
                    2
                ),

                "porcentaje_montos_atipicos": round(
                    float(perfil["pct_montos_atipicos"]),
                    2
                )
            },

            "evaluacion": {

                "comportamiento": (
                    "Atípico"
                    if es_atipica
                    else "Habitual"
                ),

                "fraude": "No determinado por este modelo",

                "credito": "No determinado por este modelo"
            },

            "modelo": configuracion["nombre_modelo"],

            "advertencia": (
                "El análisis describe el comportamiento "
                "histórico de la cuenta. Un perfil atípico "
                "no confirma fraude y este modelo no determina "
                "aprobación o rechazo de créditos."
            )
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=(
                "Error al analizar la cuenta: "
                f"{str(error)}"
            )
        )