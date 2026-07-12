import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTitleAlign: "center",
          contentStyle: { backgroundColor: "#ffffff" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Casos jurídicos" }} />
        <Stack.Screen
          name="caso/[id]"
          options={{ title: "Detalle del caso" }}
        />
      </Stack>
    </>
  );
}