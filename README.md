# Análisis de Transferencias Bancarias

Proyecto de minería de datos para la segmentación de cuentas y la detección de perfiles atípicos a partir de un histórico de transferencias bancarias. Incluye el modelado (K-Means + Isolation Forest), una API que expone el modelo y una aplicación web que la consume.

> Trabajo experimental — Minería de Datos, Universidad Estatal Amazónica.

---

## Estructura del repositorio

```
.
├── backend/                 # API FastAPI que sirve el modelo
│   ├── app/
│   │   └── main.py          # Endpoints de la API
│   ├── artefactos/          # Modelos entrenados y configuración
│   │   ├── configuracion_modelo.json
│   │   ├── modelo_kmeans_final.joblib
│   │   ├── modelo_isolation_final.joblib
│   │   ├── scaler_final.joblib
│   │   └── perfiles_modelados.csv.gz
│   └── requirements.txt
├── frontend/                # Aplicación web (HTML/CSS/JS)
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── notebooks/
│   └── Proyecto_Mineria_Datos_Transferencias_Completo.ipynb
└── README.md
```

---

## Modelo

- **Segmentación**: K-Means con 4 grupos sobre 12 características del perfil de cada cuenta (número de transferencias, monto total, promedio, máximo, destinos distintos, días con actividad, % fin de semana, % nocturnas, % canal móvil, % montos atípicos, etc.).
- **Detección de perfiles atípicos**: Isolation Forest sobre las mismas 12 características escaladas con `StandardScaler`.
- **Perfiles pre-calculados**: `perfiles_modelados.csv.gz` contiene el perfil histórico por cuenta, listo para consulta.

---

## API — Endpoints

Base: `http://127.0.0.1:8000`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/` | Mensaje de bienvenida con metadatos del modelo. |
| `GET`  | `/MSApiAnalisaCuenta/salud` | Health check. |
| `POST` | `/MSApiAnalisaCuenta/BancaDigital/consultar` | Analiza una cuenta y devuelve el segmento, la clasificación y los indicadores históricos. |

### Ejemplo de petición

```http
POST /MSApiAnalisaCuenta/BancaDigital/consultar
Content-Type: application/json

{
  "cuenta": "cue_2080926275"
}
```

Se admite la cuenta con o sin el prefijo `cue_`.

### Documentación interactiva

- Swagger UI: `http://127.0.0.1:8000/docs`
- Redoc:      `http://127.0.0.1:8000/redoc`

---

## Cómo ejecutar el proyecto en local

### Requisitos

- Python 3.11 o superior
- `git`

### 1. Clonar el repositorio

```bash
git clone https://github.com/uea-jose/CPE_Mineria_de_Datos.git
cd CPE_Mineria_de_Datos
```

### 2. Levantar el backend (FastAPI)

En una terminal:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

> En Linux/macOS: `source .venv/bin/activate` en lugar del `Activate.ps1`.

Si levanta bien, verás `Uvicorn running on http://127.0.0.1:8000`.
Verifica con `http://127.0.0.1:8000/docs`.

### 3. Levantar el frontend (servidor estático)

El `frontend/app.js` llama a la API en `http://127.0.0.1:8000`, así que **no abras `index.html` con doble clic** (CORS en `file://` lo bloquea). Hay que servirlo:

En **otra** terminal:

```powershell
cd frontend
python -m http.server 5500
```

Abre: `http://127.0.0.1:5500/`

### 4. Probar la aplicación

Ingresa una cuenta válida, por ejemplo:

```
cue_2080926275
```

o simplemente `2080926275`, y pulsa **ANALIZAR**. El dashboard presenta cinco vistas: Resumen, Actividad, Comportamiento, Indicadores y Técnico.

---

## Notebook de modelado

`notebooks/Proyecto_Mineria_Datos_Transferencias_Completo.ipynb` contiene el pipeline completo: preprocesamiento, construcción de los perfiles, entrenamiento de K-Means y de Isolation Forest, y la generación de todos los artefactos de `backend/artefactos/`.

> El dataset original (`transfercsv.csv`, ~92 MB) **no se incluye en el repositorio** por tamaño.

---

## Stack técnico

- **Backend**: Python, FastAPI, Uvicorn, Pydantic
- **Modelado**: scikit-learn (K-Means, Isolation Forest, StandardScaler), pandas, numpy, joblib
- **Frontend**: HTML5, CSS3, JavaScript (vanilla), Bootstrap 5, Bootstrap Icons

---

## Autor

**Jose Vicente Ávila Romero** — Universidad Estatal Amazónica
Minería de Datos — 6to semestre