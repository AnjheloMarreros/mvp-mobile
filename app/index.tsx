import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  Alert,
  View,
} from "react-native";
import { router } from "expo-router";

import {
  getCases,
  getCaseDisplayText,
  getCaseTitle,
  type CaseItem,
} from "../src/api/client";

export default function IndexScreen() {
  const [cases, setCases] = React.useState<CaseItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  const loadCases = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCases();
      setCases(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "No se pudieron cargar los casos.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCases();
  }, [loadCases]);

  const filtered = React.useMemo(() => {
    const query = search.toLowerCase().trim();
    return cases.filter((item) => {
      const text = `${item.id} ${item.titulo ?? ""} ${item.enunciado ?? ""} ${item.texto_caso ?? ""}`.toLowerCase();
      return text.includes(query);
    });
  }, [cases, search]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Cargando casos...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Casos jurídicos</Text>
      <Text style={styles.subtitle}>
        Selecciona un caso para leerlo y responderlo.
      </Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar caso..."
        style={styles.searchBox}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/caso/${item.id}`)}
            style={({ pressed }) => [
              styles.card,
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{getCaseTitle(item)}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.id}</Text>
              </View>
            </View>

            <Text style={styles.cardText} numberOfLines={4}>
              {getCaseDisplayText(item)}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No se encontraron casos con ese criterio.
          </Text>
        }
      />
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
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 16,
    color: "#4b5563",
    fontSize: 15,
    lineHeight: 22,
  },
  searchBox: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    backgroundColor: "#f9fafb",
  },
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  cardText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: "#374151",
  },
  emptyText: {
    marginTop: 24,
    textAlign: "center",
    color: "#6b7280",
  },
});