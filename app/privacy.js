import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

import COLORS from "../constants/colors";

export default function PrivacyScreen() {
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
        Privacy Policy
      </Text>

      <View style={card}>
        <Text style={p}>
          This policy explains what information Cliqzee uses and why.
        </Text>

        <Text style={h}>1. Information we collect</Text>
        <Text style={p}>
          Email, profile details, photos, approximate location for nearby
          matching, vibes, likes, matches, messages, support requests, reports,
          blocks, crash logs, and push notification tokens.
        </Text>

        <Text style={h}>2. Why we use it</Text>
        <Text style={p}>
          To create profiles, show nearby users, enable chat, send
          notifications, improve safety, support blocking/reporting, and fix app
          errors.
        </Text>

        <Text style={h}>3. Location</Text>
        <Text style={p}>
          Location is used to show nearby activity and estimate distance. We
          store approximate location for safety and do not show your precise
          coordinates to other users.
        </Text>

        <Text style={h}>4. Safety data</Text>
        <Text style={p}>
          Reports, blocks, support requests, and app error logs may be stored so
          we can protect users, review unsafe behaviour, and improve reliability.
        </Text>

        <Text style={h}>5. Payments</Text>
        <Text style={p}>
          If paid features are enabled, purchases and subscription status may be
          handled by Apple, Google, and our subscription provider. We use that
          status only to unlock paid app features.
        </Text>

        <Text style={h}>6. Deletion</Text>
        <Text style={p}>
          You can request data deletion or delete your account from Profile.
        </Text>

        <Text style={h}>7. Contact</Text>
        <Text style={p}>
          For help, open Profile and use Support Center. If you cannot access
          your account, contact support through the app listing.
        </Text>
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
