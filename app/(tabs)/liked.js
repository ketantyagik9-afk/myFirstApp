import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import COLORS from "../../constants/colors";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";

import { auth, db } from "../../firebaseConfig";
import { likeUser } from "../../services/userService";
import { playMatchWhistle } from "../../services/soundService";

function getMainPhoto(person) {
  if (Array.isArray(person?.photos) && person.photos.length > 0) {
    return person.photos[0];
  }

  if (person?.photoURL) {
    return person.photoURL;
  }

  return "https://picsum.photos/300";
}

export default function LikedScreen() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLikedYou = useCallback(async () => {
    try {
      if (!auth.currentUser) {
        router.replace("/login");
        return;
      }

      setLoading(true);

      const q = query(
        collection(db, "likes"),
        where("toUserId", "==", auth.currentUser.uid)
      );

      const snapshot = await getDocs(q);
      const results = [];

      for (const likeDoc of snapshot.docs) {
        const likeData = likeDoc.data();
        const userSnap = await getDoc(doc(db, "users", likeData.fromUserId));

        if (userSnap.exists()) {
          results.push({
            id: userSnap.id,
            ...userSnap.data(),
          });
        }
      }

      setPeople(results);
    } catch (error) {
      Alert.alert("Load failed", error?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLikedYou();
  }, [loadLikedYou]);

  const handleMatchBack = async (person) => {
    try {
      if (!auth.currentUser?.uid || !person?.id) return;

      const result = await likeUser(auth.currentUser.uid, person.id);

      if (result?.matched) {
        await playMatchWhistle();
        Alert.alert("Match", `You and ${person.name || "User"} matched`);

        const chatId = [auth.currentUser.uid, person.id].sort().join("_");
        const mainPhoto = getMainPhoto(person);

        router.push(
          `/chat?chatId=${chatId}&name=${encodeURIComponent(
            person.name || "User"
          )}&photoURL=${encodeURIComponent(mainPhoto)}`
        );
      } else {
        Alert.alert("Liked", `You liked ${person.name || "User"}`);
      }
    } catch (error) {
      Alert.alert("Like failed", error?.message || "Something went wrong.");
    }
  };

  return (
    <LinearGradient
      colors={[COLORS.background, COLORS.mint, COLORS.background]}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 20,
          paddingTop: 60,
          paddingBottom: 40,
        }}
      >
        <Text style={{ fontSize: 34, fontWeight: "900", color: COLORS.black }}>
          Liked You
        </Text>

        <Text
          style={{
            color: COLORS.darkBlueGray,
            marginTop: 6,
            marginBottom: 20,
          }}
        >
          People who said Yeah to you.
        </Text>

        {loading ? (
          <View style={{ paddingTop: 80, alignItems: "center" }}>
            <ActivityIndicator color={COLORS.teal} />
            <Text
              style={{
                marginTop: 12,
                fontWeight: "900",
                color: COLORS.black,
              }}
            >
              Loading...
            </Text>
          </View>
        ) : people.length === 0 ? (
          <View
            style={{
              backgroundColor: COLORS.softCard,
              borderRadius: 30,
              padding: 24,
              alignItems: "center",
              shadowColor: "#000",
              shadowOpacity: 0.06,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
              elevation: 3,
            }}
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: "900",
                color: COLORS.black,
              }}
            >
              No likes yet
            </Text>

            <Text
              style={{
                color: COLORS.darkBlueGray,
                marginTop: 8,
                textAlign: "center",
                lineHeight: 22,
              }}
            >
              Keep your vibe active so people nearby can discover you.
            </Text>
          </View>
        ) : (
          people.map((person) => (
            <View
              key={person.id}
              style={{
                backgroundColor: COLORS.softCard,
                borderRadius: 28,
                padding: 14,
                marginBottom: 14,
                flexDirection: "row",
                alignItems: "center",
                shadowColor: "#000",
                shadowOpacity: 0.06,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 5 },
                elevation: 3,
              }}
            >
              <Image
                source={{ uri: getMainPhoto(person) }}
                blurRadius={8}
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 38,
                  backgroundColor: "#dbe3ea",
                }}
              />

              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "900",
                    color: COLORS.black,
                  }}
                >
                  Someone likes you
                </Text>

                <Text
                  style={{
                    color: COLORS.darkBlueGray,
                    marginTop: 4,
                    fontWeight: "700",
                  }}
                >
                  Tap Yeah to match
                </Text>

                <Text style={{ color: "#999", marginTop: 4, fontSize: 13 }}>
                  {person.currentVibe || "Active vibe"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => handleMatchBack(person)}
                activeOpacity={0.86}
                style={{
                  backgroundColor: COLORS.teal,
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: COLORS.white, fontWeight: "900" }}>
                  Yeah
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </LinearGradient>
  );
}
