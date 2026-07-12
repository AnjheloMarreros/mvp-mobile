import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import {
  getCaseById,
  startBenchmark,
  evaluateVoiceFeedback,
  type CaseItem,
  type EvaluationResponse,
} from "../../src/api/client";

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstObject(...values: unknown[]): Record<string, any> | null {
  for (const value of values) {
    if (isPlainObject(value)) {
      return value;
    }
  }
  return null;
}

function firstArray(...values: unknown[]): any[] {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "Sin transcripción disponible.";
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function deriveGlobalLevel(score: number | null): string {
  if (score === null) return "N/D";
  if (score >= 80) return "Excelente";
  if (score >= 70) return "Alto";
  if (score >= 55) return "Medio";
  return "Bajo";
}

function resolveStudentPayload(result: EvaluationResponse | null): Record<string, any> {
  if (!result) return {};

  return (
    firstObject(
      result?.langgraph?.resultado_final,
      result?.langchain?.resultado_final,
      result?.benchmark?.resultado_final,
      result?.resultado_final,
      result
    ) ?? {}
  );
}

function resolveRubricEvaluation(studentPayload: Record<string, any>): Record<string, any> {
  return (
    firstObject(
      studentPayload?.evaluacion_rubrica,
      studentPayload?.evaluacion_visible?.evaluacion_rubrica,
      studentPayload?.evaluacion_visible,
      studentPayload?.evaluacion,
      studentPayload?.rubrica
    ) ?? {}
  );
}

function resolveVisibleScore(
  studentPayload: Record<string, any>,
  rubricEvaluation: Record<string, any>
): number | null {
  return firstNumber(
    studentPayload?.score_rubric,
    studentPayload?.puntaje_rubrica,
    studentPayload?.evaluacion_rubrica?.puntaje_total,
    studentPayload?.evaluacion_visible?.puntaje_total,
    rubricEvaluation?.puntaje_total,
    rubricEvaluation?.puntaje,
    studentPayload?.puntaje_total
  );
}

export default function CaseDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const caseId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loadingCase, setLoadingCase] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [preparing, setPreparing] = React.useState(false);
  const [caseData, setCaseData] = React.useState<CaseItem | null>(null);
  const [result, setResult] = React.useState<EvaluationResponse | null>(null);
  const [benchmarkId, setBenchmarkId] = React.useState<string>("");
  const [sampleId, setSampleId] = React.useState<string>("");

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  React.useEffect(() => {
    const loadCase = async () => {
      if (!caseId) return;

      try {
        setLoadingCase(true);
        const data = await getCaseById(caseId);
        setCaseData(data);
      } catch (error: any) {
        Alert.alert("Error", error?.message ?? "No se pudo cargar el caso.");
      } finally {
        setLoadingCase(false);
      }
    };

    loadCase();
  }, [caseId]);

  React.useEffect(() => {
    const prepareAudio = async () => {
      try {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            "Permiso requerido",
            "Necesitas permitir el acceso al micrófono para dictar tu respuesta."
          );
          return;
        }

        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });
      } catch (error: any) {
        Alert.alert("Error", error?.message ?? "No se pudo preparar el micrófono.");
      }
    };

    prepareAudio();
  }, []);

  const ensureBenchmarkIds = React.useCallback(async () => {
    if (!caseId || benchmarkId) return;

    try {
      const started = await startBenchmark(caseId);
      setBenchmarkId(started.benchmark_id ?? "");
      setSampleId(started.sample_id ?? "");
    } catch {
      // Si falla, el backend generará los IDs igualmente.
    }
  }, [benchmarkId, caseId]);

  const startRecording = async () => {
    if (!caseId || sending || preparing) return;

    try {
      setPreparing(true);

      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permiso requerido",
          "Necesitas permitir el acceso al micrófono para dictar tu respuesta."
        );
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      await ensureBenchmarkIds();

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "No se pudo iniciar la grabación.");
    } finally {
      setPreparing(false);
    }
  };

  const stopAndEvaluate = async () => {
    if (!caseId || sending) return;

    try {
      setSending(true);

      await audioRecorder.stop();
      await new Promise((resolve) => setTimeout(resolve, 300));

      const uri = audioRecorder.uri;
      if (!uri) {
        throw new Error("No se encontró el archivo de audio grabado.");
      }

      setResult(null);

      const data = await evaluateVoiceFeedback({
        caso_id: caseId,
        benchmark_id: benchmarkId || undefined,
        sample_id: sampleId || undefined,
        audioUri: uri,
        audioName: `respuesta-${caseId}.m4a`,
        audioType: "audio/m4a",
      });

      setResult(data);
      setBenchmarkId(data?.benchmark_id ?? benchmarkId);
      setSampleId(data?.sample_id ?? sampleId);
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "No se pudo evaluar la respuesta.");
    } finally {
      setSending(false);
    }
  };

  const handleToggleRecording = async () => {
    if (recorderState.isRecording) {
      await stopAndEvaluate();
      return;
    }

    await startRecording();
  };

  if (loadingCase || !caseData) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Cargando caso...</Text>
      </SafeAreaView>
    );
  }

  const studentPayload = resolveStudentPayload(result);
  const rubricEvaluation = resolveRubricEvaluation(studentPayload);
  const visibleScore = resolveVisibleScore(studentPayload, rubricEvaluation);
  const visibleLevel = deriveGlobalLevel(visibleScore);

  const feedback =
    firstObject(
      studentPayload?.retroalimentacion_visible,
      studentPayload?.retroalimentacion,
      rubricEvaluation?.retroalimentacion
    ) ?? {};

  const rubricCriteria = firstArray(
    rubricEvaluation?.criterios,
    studentPayload?.criterios_rubrica,
    studentPayload?.criterios
  ).filter(
    (criterio: any) =>
      criterio?.clave !== "relevancia_caso" &&
      criterio?.nombre !== "Relevancia con el caso"
  );

  const transcripcion = firstText(
    studentPayload?.entrada,
    studentPayload?.texto_procesado,
    result?.texto_procesado,
    result?.entrada
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.heroCard}>
          <Text style={styles.title}>{caseData.titulo}</Text>
          <Text style={styles.meta}>{caseData.curso ?? "Curso no indicado"}</Text>
          <Text style={styles.heroText}>
            {caseData.enunciado ?? "Sin enunciado disponible."}
          </Text>
        </View>

        {Array.isArray(caseData.contexto) && caseData.contexto.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Contexto</Text>
            {caseData.contexto.map((item, index) => (
              <Text key={`ctx-${index}`} style={styles.bullet}>
                • {item}
              </Text>
            ))}
          </View>
        )}

        {Array.isArray(caseData.instrucciones) && caseData.instrucciones.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Instrucciones</Text>
            {caseData.instrucciones.map((item, index) => (
              <Text key={`ins-${index}`} style={styles.bullet}>
                • {item}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Dictado por voz</Text>
          <Text style={styles.bodyText}>
            Toca el botón, dicta tu respuesta y vuelve a tocar para detener y evaluar.
          </Text>

          <Pressable
            onPress={handleToggleRecording}
            disabled={sending || preparing}
            style={({ pressed }) => [
              styles.voiceButton,
              recorderState.isRecording && styles.voiceButtonActive,
              (pressed || sending || preparing) && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.voiceButtonText}>
              {recorderState.isRecording
                ? "Detener y evaluar"
                : preparing
                  ? "Preparando micrófono..."
                  : sending
                    ? "Evaluando..."
                    : "Grabar respuesta"}
            </Text>
          </Pressable>

          <Text style={styles.mutedStatus}>
            {recorderState.isRecording
              ? "Grabando..."
              : "La respuesta se transcribe al detener la grabación."}
          </Text>
        </View>

        {result && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Retroalimentación</Text>

            <View style={styles.scoreGrid}>
              <View style={styles.scoreBox}>
                <Text style={styles.scoreLabel}>Puntaje total</Text>
                <Text style={styles.scoreValue}>
                  {visibleScore !== null ? `${visibleScore}%` : "N/D"}
                </Text>
              </View>

              <View style={styles.scoreBox}>
                <Text style={styles.scoreLabel}>Nivel global</Text>
                <Text style={styles.scoreValue}>{visibleLevel}</Text>
              </View>
            </View>

            <View style={styles.feedbackBlock}>
              <Text style={styles.subheading}>Transcripción</Text>
              <Text style={styles.bodyText}>{transcripcion}</Text>
            </View>

            <View style={styles.feedbackBlock}>
              <Text style={styles.subheading}>Observaciones</Text>
              {(feedback?.observaciones || []).length > 0 ? (
                (feedback.observaciones as string[]).map((item, index) => (
                  <Text key={`obs-${index}`} style={styles.bullet}>
                    • {item}
                  </Text>
                ))
              ) : (
                <Text style={styles.bodyText}>Sin observaciones.</Text>
              )}
            </View>

            <View style={styles.feedbackBlock}>
              <Text style={styles.subheading}>Recomendaciones</Text>
              {(feedback?.recomendaciones || []).length > 0 ? (
                (feedback.recomendaciones as string[]).map((item, index) => (
                  <Text key={`rec-${index}`} style={styles.bullet}>
                    • {item}
                  </Text>
                ))
              ) : (
                <Text style={styles.bodyText}>Sin recomendaciones.</Text>
              )}
            </View>

            <View style={styles.feedbackBlock}>
              <Text style={styles.subheading}>Rúbrica de evaluación</Text>

              {rubricCriteria.length > 0 ? (
                rubricCriteria.map((criterio: any, index: number) => (
                  <View key={`rubric-${index}`} style={styles.rubricItem}>
                    <Text style={styles.rubricTitle}>
                      {index + 1}. {criterio.nombre ?? criterio.clave ?? "Criterio"}
                    </Text>
                    <Text style={styles.bodyText}>
                      Peso: {criterio.peso ?? "N/D"} · Puntaje: {criterio.puntaje ?? "N/D"} · Nivel:{" "}
                      {criterio.nivel ?? "N/D"}
                    </Text>
                    {criterio.observacion ? (
                      <Text style={styles.bodyText}>
                        Observación: {criterio.observacion}
                      </Text>
                    ) : null}
                    {criterio.recomendacion ? (
                      <Text style={styles.bodyText}>
                        Recomendación: {criterio.recomendacion}
                      </Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.bodyText}>No hay rúbrica disponible.</Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#fafafa",
  },
  sectionCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#fafafa",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  meta: {
    marginTop: 6,
    marginBottom: 10,
    color: "#6b7280",
    fontSize: 14,
  },
  heroText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#374151",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },
  subheading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#374151",
  },
  bullet: {
    fontSize: 15,
    lineHeight: 22,
    color: "#374151",
    marginBottom: 6,
  },
  voiceButton: {
    marginTop: 16,
    backgroundColor: "#111827",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  voiceButtonActive: {
    backgroundColor: "#b91c1c",
  },
  voiceButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  mutedStatus: {
    marginTop: 10,
    color: "#6b7280",
    fontSize: 14,
  },
  scoreGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  scoreBox: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  scoreLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 6,
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  feedbackBlock: {
    marginTop: 12,
  },
  rubricItem: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  rubricTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
});