import React from "react";
import { TouchableOpacity, Text } from "react-native";

export default function AppButton({
  title,
  onPress,
  backgroundColor = "black",
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor,
        padding: 15,
        borderRadius: 8,
        marginTop: 8,
      }}
    >
      <Text style={{ color: "white", textAlign: "center", fontWeight: "600" }}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}