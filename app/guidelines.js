import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

export default function GuidelinesScreen() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#f7f7f7" }}
      contentContainerStyle={{ padding: 22, paddingTop: 58, paddingBottom: 50 }}
    >
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: "#111" }}>
          ‹ Back
        </Text>
      </TouchableOpacity>

      <Text style={{ fontSize: 34, fontWeight: "900", marginTop: 22 }}>
        Community Guidelines
      </Text>

      <View style={card}>
        <Text style={h}>Be respectful</Text>
        <Text style={p}>No harassment, threats, hate, bullying, or pressure.</Text>

        <Text style={h}>Be honest</Text>
        <Text style={p}>Use your own photos and do not impersonate others.</Text>

        <Text style={h}>Keep it safe</Text>
        <Text style={p}>
          Meet in public places, tell a friend, and leave if something feels wrong.
        </Text>

        <Text style={h}>No scams or spam</Text>
        <Text style={p}>
          Do not ask for money, passwords, private documents, or banking details.
        </Text>

        <Text style={h}>Report problems</Text>
        <Text style={p}>
          Use Block and Report if someone makes you uncomfortable.
        </Text>
      </View>
    </ScrollView>
  );
}

const card = {
  backgroundColor: "white",
  borderRadius: 24,
  padding: 18,
  marginTop: 18,
};

const h = {
  fontSize: 18,
  fontWeight: "900",
  marginTop: 18,
  color: "#111",
};

const p = {
  color: "#555",
  lineHeight: 22,
  marginTop: 8,
  fontSize: 15,
};