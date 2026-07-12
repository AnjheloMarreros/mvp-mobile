import { Platform } from "react-native";

// ====================== PRODUCCIÓN (Cloud Run) ======================

 const CLOUD_RUN_BASE_URL =
   "https://argumentation-ai-388037247851.us-central1.run.app";

 const DEFAULT_BASE_URL =
   Platform.OS === "web"
     ? "/api"
     : process.env.EXPO_PUBLIC_API_URL || CLOUD_RUN_BASE_URL;

 export const BASE_URL = DEFAULT_BASE_URL;
// ====================================================================


// ====================== DESARROLLO LOCAL ======================
//

//const LOCAL_BASE_URL = "http://192.168.X.X:8000"; //se ve con ipconfig en cmd

//const DEFAULT_BASE_URL =
//Platform.OS === "web"
//? "/api"
//: LOCAL_BASE_URL;

//export const BASE_URL = DEFAULT_BASE_URL;
// ===============================================================

export type CaseItem = {
  id: string;
  titulo: string;
  curso?: string;
  enunciado?: string;
  texto_caso?: string;
  contexto?: string[];
  instrucciones?: string[];
  criterios_evaluacion?: string[];
};

export type EvaluationResponse = {
  caso_id?: string;
  benchmark_id?: string;
  sample_id?: string;
  modo?: string;
  pipeline?: string;
  tipo_entrada?: string;
  texto_procesado?: string;
  caso?: CaseItem | any;
  entrada?: string;
  entrada_estudiante?: string;
  texto_caso?: string;
  contexto_recuperado?: any[];
  evaluacion?: any;
  evaluacion_visible?: any;
  evaluacion_semantica?: any;
  evaluacion_rubrica?: any;
  retroalimentacion?: any;
  retroalimentacion_visible?: any;
  resultado_final?: any;
  benchmark?: any;
  langgraph?: any;
  langchain?: any;
};

const REQUEST_TIMEOUT_MS = 200000; //Margen de respuestas largas
const REQUEST_RETRIES = 1;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function doFetch(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= REQUEST_RETRIES; attempt += 1) {
    try {
      const response = await doFetch(path, init);

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Error en ${path} (${response.status}): ${detail}`);
      }

      return (await response.json()) as T;
    } catch (error: any) {
      lastError = error;

      const isLastAttempt = attempt >= REQUEST_RETRIES;
      const isAbort = error?.name === "AbortError";

      if (isLastAttempt) {
        if (isAbort) {
          throw new Error(
            `La solicitud a ${path} tardó demasiado en responder. Intenta nuevamente.`
          );
        }
        throw error;
      }

      await sleep(1200);
    }
  }

  throw lastError ?? new Error(`Error desconocido al llamar ${path}`);
}

export async function getCases(): Promise<CaseItem[]> {
  const data = await requestJson<CaseItem[]>("/casos");
  return Array.isArray(data) ? data : [];
}

export async function getCaseById(caseId: string): Promise<CaseItem> {
  return requestJson<CaseItem>(`/caso/${encodeURIComponent(caseId)}`);
}

export function getCaseDisplayText(item: CaseItem): string {
  const candidate = item.enunciado?.trim() || item.texto_caso?.trim() || "";
  return candidate || "Toca para ver el enunciado completo.";
}

export function getCaseTitle(item: CaseItem): string {
  const title = item.titulo?.trim();
  if (title) return title;
  return `Caso ${item.id}`;
}

export async function startBenchmark(casoId: string): Promise<{
  ok: boolean;
  caso_id: string;
  benchmark_id: string;
  sample_id: string;
  mensaje?: string;
}> {
  return requestJson(`/benchmark/start?caso_id=${encodeURIComponent(casoId)}`, {
    method: "POST",
  });
}

export async function evaluateBenchmark(payload: {
  caso_id: string;
  tipo_entrada: "texto" | "audio";
  texto?: string;
  benchmark_id?: string;
  sample_id?: string;
}): Promise<EvaluationResponse> {
  const form = new FormData();
  form.append("caso_id", payload.caso_id);
  form.append("tipo_entrada", payload.tipo_entrada);
  form.append("texto", payload.texto ?? "");

  if (payload.benchmark_id) form.append("benchmark_id", payload.benchmark_id);
  if (payload.sample_id) form.append("sample_id", payload.sample_id);

  return requestJson<EvaluationResponse>("/benchmark/evaluar", {
    method: "POST",
    body: form,
  });
}

export async function evaluateLanggraph(payload: {
  caso_id: string;
  tipo_entrada: "texto" | "audio";
  texto?: string;
  benchmark_id?: string;
  sample_id?: string;
}): Promise<EvaluationResponse> {
  const form = new FormData();
  form.append("caso_id", payload.caso_id);
  form.append("tipo_entrada", payload.tipo_entrada);
  form.append("texto", payload.texto ?? "");

  if (payload.benchmark_id) form.append("benchmark_id", payload.benchmark_id);
  if (payload.sample_id) form.append("sample_id", payload.sample_id);

  return requestJson<EvaluationResponse>("/evaluar-langgraph", {
    method: "POST",
    body: form,
  });
}

export async function evaluateLangchain(payload: {
  caso_id: string;
  tipo_entrada: "texto" | "audio";
  texto?: string;
  benchmark_id?: string;
  sample_id?: string;
}): Promise<EvaluationResponse> {
  const form = new FormData();
  form.append("caso_id", payload.caso_id);
  form.append("tipo_entrada", payload.tipo_entrada);
  form.append("texto", payload.texto ?? "");

  if (payload.benchmark_id) form.append("benchmark_id", payload.benchmark_id);
  if (payload.sample_id) form.append("sample_id", payload.sample_id);

  return requestJson<EvaluationResponse>("/evaluar-langchain", {
    method: "POST",
    body: form,
  });
}

export async function evaluateBenchmarkVoice(payload: {
  caso_id: string;
  benchmark_id?: string;
  sample_id?: string;
  audioUri: string;
  audioName?: string;
  audioType?: string;
}): Promise<EvaluationResponse> {
  const form = new FormData();

  form.append("caso_id", payload.caso_id);
  form.append("tipo_entrada", "audio");

  if (payload.benchmark_id) form.append("benchmark_id", payload.benchmark_id);
  if (payload.sample_id) form.append("sample_id", payload.sample_id);

  form.append(
    "archivo_audio",
    {
      uri: payload.audioUri,
      name: payload.audioName ?? "respuesta.m4a",
      type: payload.audioType ?? "audio/m4a",
    } as any
  );

  return requestJson<EvaluationResponse>("/benchmark/evaluar", {
    method: "POST",
    body: form,
  });
}

export function getApiBaseUrl(): string {
  return BASE_URL;
}

export async function evaluateVoiceFeedback(payload: {
  caso_id: string;
  benchmark_id?: string;
  sample_id?: string;
  audioUri: string;
  audioName?: string;
  audioType?: string;
}): Promise<EvaluationResponse> {
  const form = new FormData();

  form.append("caso_id", payload.caso_id);
  form.append("tipo_entrada", "audio");

  if (payload.benchmark_id) form.append("benchmark_id", payload.benchmark_id);
  if (payload.sample_id) form.append("sample_id", payload.sample_id);

  form.append(
    "archivo_audio",
    {
      uri: payload.audioUri,
      name: payload.audioName ?? "respuesta.m4a",
      type: payload.audioType ?? "audio/m4a",
    } as any
  );

  return requestJson<EvaluationResponse>("/evaluar-entrada", {
    method: "POST",
    body: form,
  });
}