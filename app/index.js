import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../firebaseConfig";

export default function IndexScreen() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setLoggedIn(!!user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "white",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="black" />
        <Text style={{ marginTop: 12, color: "black" }}>
          Loading...
        </Text>
      </View>
    );
  }

  if (loggedIn) {
    return <Redirect href="/home" />;
  }

  return <Redirect href="/login" />;
}