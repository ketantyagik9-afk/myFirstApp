import React from "react";
import { TextInput } from "react-native";

export default function AppInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="gray"
      secureTextEntry={secureTextEntry}
      style={{
        borderWidth: 1,
        borderColor: "#ccc",
        marginBottom: 12,
        padding: 12,
        borderRadius: 8,
        color: "black",
        backgroundColor: "white",
      }}
    />
  );
}