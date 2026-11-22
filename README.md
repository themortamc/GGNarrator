# GGNarrator

Estudio de locución comercial en español rioplatense para el guion de [mortups](https://mortups.com.ar). Escribís el texto, elegís voz y dirección actoral, y genera el audio con **Gemini 3.8 Flash TTS**. También se puede usar desde Claude vía **MCP**.

## Qué hace

- Editor de guion con desglose por bloques y duración estimada.
- Elección de voz (Puck, Fenrir y más) y dirección actoral editable, con prosodia automática opcional.
- Reproductor con forma de onda; descarga en **WAV** y subtítulos en **SRT**.
- Servidor MCP (`/mcp`) con dos herramientas: `obtener_guion_mortups` y `generar_locucion`.
- API REST para usarlo desde scripts (por ejemplo, el pipeline de reels [mortline](https://github.com/themortamc/mortline)).

## Uso local

```bash
npm install
cp .env.example .env     # completá GEMINI_API_KEY
npm run dev              # http://localhost:3000 (PORT para cambiarlo)
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor + interfaz con Vite |
| `npm run build` | Compila el frontend |
| `npm run lint` | Chequeo de tipos (`tsc --noEmit`) |

## Variables de entorno

| Variable | Para qué |
|---|---|
| `GEMINI_API_KEY` | Obligatoria. Clave de la API de Gemini. |
| `APP_URL` | URL pública, para armar los links de descarga. |
| `MCP_AUTH_TOKEN` | Opcional. Si la desplegás públicamente, protege `/mcp` y `/api/tts/wav` con `Authorization: Bearer`. |

## API

```bash
curl -X POST http://localhost:3000/api/tts/wav \
  -H "Content-Type: application/json" \
  -d '{"text":"Hola, esto es una prueba","voiceName":"Puck"}' -o prueba.wav
```

Otros endpoints: `GET /api/health`, `POST /api/tts/generate` (devuelve metadatos y link de descarga) y `GET /api/tts/files/:fileName`. El servidor guarda en memoria los últimos 50 audios.

## Conectar con Claude

```bash
claude mcp add --transport http mortups-tts http://localhost:3000/mcp
```

Si tiene `MCP_AUTH_TOKEN`, agregá el header `Authorization: Bearer <token>` según tu cliente MCP.

## Estructura

```
server.ts            Express: API REST, MCP y Vite en desarrollo
server/              TTS (Gemini), prosodia y handler MCP
src/                 Interfaz React: editor, panel de dirección, reproductor
```

## Límites

Depende de la cuota de Gemini TTS: si se agota, la API devuelve el error de límite de solicitudes y conviene esperar unos segundos.
