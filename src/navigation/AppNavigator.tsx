import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert } from "react-native";
import { getCases, getCaseById, evaluateLanggraph, CaseItem, EvaluationResponse } from "../api/client";

type RootStackParamList = {
  CaseList: undefined;
  CaseDetail: { caseId: string };
  Feedback: { result: EvaluationResponse };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function CaseListScreen({ navigation }: any) {
  const [cases, setCases] = React.useState<CaseItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    getCases()
      .then(setCases)
      .catch((err) => Alert.alert("Error", err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = cases.filter((c) =>
    `${c.id} ${c.titulo} ${c.enunciado ?? ""}`.toLowerCase().includes(query.toLowerCase())
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: "#fff" }}>
      <Text style={{ fontSize: 28, fontWeight: "700", marginBottom: 12 }}>
        Casos
      </Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar caso..."
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 10,
          padding: 12,
          marginBottom: 12
        }}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate("CaseDetail", { caseId: item.id })}
            style={{
              padding: 16,
              borderWidth: 1,
              borderColor: "#e5e5e5",
              borderRadius: 12,
              marginBottom: 12,
              backgroundColor: "#fafafa"
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "600" }}>{item.titulo}</Text>
            <Text style={{ marginTop: 6, color: "#444" }} numberOfLines={3}>
              {item.enunciado}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function CaseDetailScreen({ route, navigation }: any) {
  const { caseId } = route.params;
  const [caseData, setCaseData] = React.useState<CaseItem | null>(null);
  const [answer, setAnswer] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    getCaseById(caseId)
      .then(setCaseData)
      .catch((err) => Alert.alert("Error", err.message))
      .finally(() => setLoading(false));
  }, [caseId]);

  const handleSend = async () => {
    if (!answer.trim()) {
      Alert.alert("Aviso", "Escribe una respuesta primero.");
      return;
    }

    try {
      setSending(true);
      const result = await evaluateLanggraph({
        caso_id: caseId,
        tipo_entrada: "texto",
        texto: answer
      });
      navigation.navigate("Feedback", { result });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading || !caseData) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: "#fff" }}>
      <Text style={{ fontSize: 26, fontWeight: "700" }}>{caseData.titulo}</Text>
      <Text style={{ marginTop: 8, color: "#555" }}>{caseData.curso}</Text>

      <Text style={{ marginTop: 20, fontSize: 18, fontWeight: "600" }}>
        Enunciado
      </Text>
      <Text style={{ marginTop: 8, lineHeight: 22 }}>{caseData.enunciado}</Text>

      <Text style={{ marginTop: 20, fontSize: 18, fontWeight: "600" }}>
        Respuesta
      </Text>

      <TextInput
        value={answer}
        onChangeText={setAnswer}
        placeholder="Escribe tu respuesta aquí..."
        multiline
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 12,
          padding: 12,
          minHeight: 180,
          textAlignVertical: "top",
          marginTop: 8
        }}
      />

      <TouchableOpacity
        onPress={handleSend}
        disabled={sending}
        style={{
          marginTop: 16,
          backgroundColor: sending ? "#999" : "#111827",
          padding: 14,
          borderRadius: 12,
          alignItems: "center"
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>
          {sending ? "Evaluando..." : "Enviar y evaluar"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function FeedbackScreen({ route }: any) {
  const { result } = route.params;

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: "#fff" }}>
      <Text style={{ fontSize: 26, fontWeight: "700" }}>Retroalimentación</Text>

      <Text style={{ marginTop: 16, fontSize: 18, fontWeight: "600" }}>
        Resumen
      </Text>
      <Text style={{ marginTop: 8, lineHeight: 22 }}>
        {result?.evaluacion?.resumen ?? result?.retroalimentacion?.resumen ?? "Sin resumen."}
      </Text>

      <Text style={{ marginTop: 16, fontSize: 18, fontWeight: "600" }}>
        Puntaje total
      </Text>
      <Text style={{ marginTop: 8 }}>
        {result?.evaluacion?.puntaje_total ?? "N/D"}
      </Text>

      <Text style={{ marginTop: 16, fontSize: 18, fontWeight: "600" }}>
        Nivel global
      </Text>
      <Text style={{ marginTop: 8 }}>
        {result?.evaluacion?.nivel_global ?? "N/D"}
      </Text>

      <Text style={{ marginTop: 16, fontSize: 18, fontWeight: "600" }}>
        Recomendaciones
      </Text>
      <Text style={{ marginTop: 8, lineHeight: 22 }}>
        {(result?.retroalimentacion?.recomendaciones || [])
          .join("\n\n") || "Sin recomendaciones."}
      </Text>
    </View>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="CaseList">
        <Stack.Screen name="CaseList" component={CaseListScreen} options={{ title: "Casos" }} />
        <Stack.Screen name="CaseDetail" component={CaseDetailScreen} options={{ title: "Detalle del caso" }} />
        <Stack.Screen name="Feedback" component={FeedbackScreen} options={{ title: "Resultados" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}