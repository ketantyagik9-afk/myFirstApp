import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

import COLORS from "../constants/colors";

export default function TermsScreen() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ padding: 22, paddingTop: 58, paddingBottom: 50 }}
    >
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.black }}>
          Back
        </Text>
      </TouchableOpacity>

      <Text
        style={{
          fontSize: 34,
          fontWeight: "900",
          marginTop: 22,
          color: COLORS.black,
        }}
      >
        Terms & Conditions
      </Text>

      <View style={card}>
        <Text style={p}>
          By using Cliqzee, you agree to use it respectfully, safely, and only if
          you are 18 years old or older.
        </Text>

        <Text style={h}>1. Eligibility</Text>
        <Text style={p}>You must be at least 18 years old to create an account.</Text>

        <Text style={h}>2. User behaviour</Text>
        <Text style={p}>
          You must not harass, threaten, impersonate, scam, spam, or abuse other
          users.
        </Text>

        <Text style={h}>3. Your content</Text>
        <Text style={p}>
          You are responsible for photos, messages, profile details, and plans
          you share.
        </Text>

        <Text style={h}>4. Safety</Text>
        <Text style={p}>
          Meet in public places, protect your personal information, and report
          unsafe behaviour.
        </Text>

        <Text style={h}>5. Account action</Text>
        <Text style={p}>
          We may remove content or restrict accounts that break these terms or
          create safety risks.
        </Text>

        <Text style={h}>6. Paid features</Text>
        <Text style={p}>
          Some features may require a paid subscription. Subscription billing,
          renewal, cancellation, and refunds are handled by the app store where
          the purchase was made.
        </Text>

        <Text style={h}>7. Changes</Text>
        <Text style={p}>These terms may be updated as the app develops.</Text>
      </View>
    </ScrollView>
  );
}

const card = {
  backgroundColor: COLORS.softCard,
  borderRadius: 24,
  padding: 18,
  marginTop: 18,
  borderWidth: 1,
  borderColor: COLORS.softBorder,
};

const h = {
  fontSize: 18,
  fontWeight: "900",
  marginTop: 18,
  color: COLORS.black,
};

const p = {
  color: COLORS.darkBlueGray,
  lineHeight: 22,
  marginTop: 8,
  fontSize: 15,
  fontWeight: "700",
};
