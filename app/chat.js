import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  Modal,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { auth, db, storage } from "../firebaseConfig";
import COLORS from "../constants/colors";

import {
  sendMessage,
  listenToMessages,
  getOlderMessages,
  setTypingStatus,
  listenToTyping,
  markMessagesAsRead,
} from "../services/userService";

import { doc, getDoc, onSnapshot } from "firebase/firestore";

const ICEBREAKERS = [
  `What's your ideal weekend vibe?`,
  `Coffee date or sunset walk?`,
  `What's something you could talk about for hours?`,
  `What's your comfort food?`,
  `If you could travel tomorrow, where would you go?`,
  `What's your current mood soundtrack?`,
  `Beach holiday or mountain escape?`,
  `What's the funniest thing that happened this week?`,
];

function showError(title, error) {
  Alert.alert(title, error?.message || "Something went wrong.");
}

function getDateFromFirestore(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function formatLastSeen(value) {
  const date = getDateFromFirestore(value);
  if (!date) return "Last seen recently";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Last seen just now";
  if (diffMin < 60) return `Last seen ${diffMin} min ago`;

  const diffHours = Math.floor(diffMin / 60);

  if (diffHours < 24) {
    return `Last seen ${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }

  return "Last seen earlier";
}

function formatMessageTime(value) {
  const date = getDateFromFirestore(value);
  if (!date) return "";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAudioTime(ms) {
  if (!ms) return "0:00";

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

function getPhotoArray(photoURL, photos) {
  try {
    if (photos) {
      const decoded =
        typeof photos === "string" ? decodeURIComponent(photos) : photos;

      const parsed =
        typeof decoded === "string" ? JSON.parse(decoded) : decoded;

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(Boolean);
      }
    }
  } catch (error) {
    console.log("Photo array parse error:", error.message);
  }

  if (photoURL && photoURL !== "undefined" && photoURL !== "null") {
    return [photoURL];
  }

  return ["https://picsum.photos/200"];
}

function getMainPhoto(photoURL, photos) {
  const photoList = getPhotoArray(photoURL, photos);
  return photoList[0] || "https://picsum.photos/200";
}

function getMessageMillis(message) {
  const date = getDateFromFirestore(message?.createdAt);
  return date ? date.getTime() : 0;
}

function getMessageText(message) {
  return String(
    message?.text ??
      message?.messageText ??
      message?.body ??
      message?.content ??
      ""
  );
}

function hasMessageContent(message) {
  return !!(
    getMessageText(message).trim() ||
    message?.imageUrl ||
    message?.audioUrl
  );
}

function mergeMessages(currentMessages, nextMessages) {
  const messageMap = new Map();

  [...currentMessages, ...nextMessages].forEach((message) => {
    if (!message?.id) return;
    if (!hasMessageContent(message)) return;

    const mergeKey = message.clientMessageId || message.id;
    const existing = messageMap.get(mergeKey);

    messageMap.set(mergeKey, {
      ...existing,
      ...message,
    });
  });

  return Array.from(messageMap.values()).sort(
    (a, b) => getMessageMillis(a) - getMessageMillis(b)
  );
}

function getParamString(value) {
  if (Array.isArray(value)) return value[0] || "";
  return typeof value === "string" ? value : "";
}

function VoiceWave({ isMe, progress }) {
  const bars = [10, 18, 26, 16, 30, 22, 14, 24, 18, 28, 12, 20];

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      {bars.map((height, index) => {
        const activeIndex = Math.floor((progress || 0) * bars.length);
        const isActive = index <= activeIndex;

        return (
          <View
            key={index}
            style={{
              width: 3,
              height,
              borderRadius: 999,
              backgroundColor: isActive
                ? COLORS.teal
                : isMe
                ? "rgba(255,255,255,0.65)"
                : "#94a3b8",
              opacity: isActive ? 1 : 0.65,
            }}
          />
        );
      })}
    </View>
  );
}

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const chatId = getParamString(params.chatId);
  const name = getParamString(params.name);
  const photoURL = getParamString(params.photoURL);
  const photos = Array.isArray(params.photos)
    ? params.photos[0] || ""
    : params.photos;

  const [messages, setMessages] = useState([]);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);
  const [text, setText] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [recording, setRecording] = useState(null);
  const [recordedAudioUri, setRecordedAudioUri] = useState(null);
  const [sending, setSending] = useState(false);
  const [userStatus, setUserStatus] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [suggestedIcebreaker, setSuggestedIcebreaker] = useState("");
  const [playingAudioUrl, setPlayingAudioUrl] = useState(null);
  const [pausedAudioUrl, setPausedAudioUrl] = useState(null);
  const [loadingAudioUrl, setLoadingAudioUrl] = useState(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioPosition, setAudioPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profilePhotoIndex, setProfilePhotoIndex] = useState(0);
  const [chatImagePreviewUrl, setChatImagePreviewUrl] = useState("");
  const [chatImagePreviewLoading, setChatImagePreviewLoading] = useState(false);
  const [checkingBlock, setCheckingBlock] = useState(true);
  const [chatBlocked, setChatBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState("");

  const scrollViewRef = useRef(null);
  const soundRef = useRef(null);
  const isMountedRef = useRef(true);
  const typingTimeoutRef = useRef(null);
  const lastTypingStatusRef = useRef(false);
  const keepScrollPositionRef = useRef(false);
  const sendingRef = useRef(false);

  const scrollToLatestMessage = useCallback((animated = true) => {
    const scroll = () => {
      scrollViewRef.current?.scrollToEnd({ animated });
    };

    scroll();
    requestAnimationFrame(scroll);
    setTimeout(scroll, 120);
    setTimeout(scroll, 350);
  }, []);

  const currentUserId = auth.currentUser?.uid;
  const otherUserId = chatId.split("_").find((id) => id !== currentUserId);

  const profilePhotos = getPhotoArray(photoURL, photos);
  const avatarPhoto = getMainPhoto(photoURL, photos);
  const activeProfilePhoto =
    profilePhotos[profilePhotoIndex] || profilePhotos[0];

  const checkBlockedStatus = useCallback(async () => {
    try {
      if (!currentUserId || !otherUserId) {
        setCheckingBlock(false);
        return;
      }

      const [myBlockSnap, theirBlockSnap] = await Promise.all([
        getDoc(doc(db, "blocks", `${currentUserId}_${otherUserId}`)),
        getDoc(doc(db, "blocks", `${otherUserId}_${currentUserId}`)),
      ]);

      const iBlockedThem = myBlockSnap.exists();
      const theyBlockedMe = theirBlockSnap.exists();

      if (!isMountedRef.current) return;

      if (iBlockedThem || theyBlockedMe) {
        setChatBlocked(true);
        setBlockReason(
          iBlockedThem
            ? "You blocked this user. Chat is disabled."
            : "This chat is unavailable."
        );

        if (chatId && currentUserId) {
          await setTypingStatus(chatId, currentUserId, false).catch(() => {});
        }
      } else {
        setChatBlocked(false);
        setBlockReason("");
      }
    } catch (error) {
      console.log("checkBlockedStatus error:", error.message);
    } finally {
      if (isMountedRef.current) {
        setCheckingBlock(false);
      }
    }
  }, [chatId, currentUserId, otherUserId]);

  const updateTypingStatus = useCallback(
    (nextStatus, immediate = false) => {
      if (!chatId || !currentUserId) return;

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      const writeTypingStatus = (status) => {
        if (lastTypingStatusRef.current === status) return;

        lastTypingStatusRef.current = status;
        setTypingStatus(chatId, currentUserId, status).catch(() => {});
      };

      if (immediate || !nextStatus) {
        writeTypingStatus(!!nextStatus);
        return;
      }

      writeTypingStatus(true);

      typingTimeoutRef.current = setTimeout(() => {
        writeTypingStatus(false);
        typingTimeoutRef.current = null;
      }, 1800);
    },
    [chatId, currentUserId]
  );

  const loadOlderMessages = useCallback(async () => {
    try {
      if (!chatId || loadingOlderMessages || !hasOlderMessages) return;

      const oldestMessage = messages.find(
        (message) =>
          message?.createdAt && !String(message.id || "").startsWith("local-")
      );

      if (!oldestMessage?.createdAt) {
        setHasOlderMessages(false);
        return;
      }

      setLoadingOlderMessages(true);

      const olderMessages = await getOlderMessages(
        chatId,
        oldestMessage.createdAt
      );

      if (!isMountedRef.current) return;

      if (olderMessages.length === 0) {
        setHasOlderMessages(false);
        return;
      }

      keepScrollPositionRef.current = true;
      setMessages((prev) => mergeMessages(olderMessages, prev));
      setHasOlderMessages(olderMessages.length >= 80);
      setTimeout(() => {
        keepScrollPositionRef.current = false;
      }, 400);
    } catch (error) {
      console.log("loadOlderMessages error:", error.message);
    } finally {
      if (isMountedRef.current) {
        setLoadingOlderMessages(false);
      }
    }
  }, [chatId, hasOlderMessages, loadingOlderMessages, messages]);

  const goPreviousProfilePhoto = () => {
    if (profilePhotos.length <= 1) return;

    setProfilePhotoIndex((prev) =>
      prev === 0 ? profilePhotos.length - 1 : prev - 1
    );
  };

  const goNextProfilePhoto = () => {
    if (profilePhotos.length <= 1) return;

    setProfilePhotoIndex((prev) => (prev + 1) % profilePhotos.length);
  };

  useEffect(() => {
    setMessages([]);
    setHasOlderMessages(true);
    setLoadingOlderMessages(false);
    keepScrollPositionRef.current = false;
  }, [chatId]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!auth.currentUser || !chatId) {
      router.replace("/login");
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [chatId]);

  useEffect(() => {
    checkBlockedStatus();

    const timer = setInterval(() => {
      checkBlockedStatus();
    }, 8000);

    return () => clearInterval(timer);
  }, [checkBlockedStatus]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }

      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {});
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      if (chatId && currentUserId) {
        setTypingStatus(chatId, currentUserId, false).catch(() => {});
        lastTypingStatusRef.current = false;
      }
    };
  }, [recording, chatId, currentUserId]);

  useEffect(() => {
    if (!otherUserId || chatBlocked) return;

    const unsubscribe = onSnapshot(
      doc(db, "users", otherUserId),
      (docSnap) => {
        if (docSnap.exists() && isMountedRef.current) {
          setUserStatus(docSnap.data());
        }
      },
      (error) => {
        console.log("User status listener error:", error.message);
      }
    );

    return unsubscribe;
  }, [otherUserId, chatBlocked]);

  useEffect(() => {
    if (!chatId || !otherUserId || chatBlocked) return;

    const unsubscribe = listenToTyping(chatId, otherUserId, (typing) => {
      if (isMountedRef.current) {
        setIsTyping(typing);
      }
    });

    return unsubscribe;
  }, [chatId, otherUserId, chatBlocked]);

  useEffect(() => {
  const randomSuggestion =
    ICEBREAKERS[Math.floor(Math.random() * ICEBREAKERS.length)];

  setSuggestedIcebreaker(randomSuggestion);
}, []);

  useEffect(() => {
    if (!chatId || chatBlocked) return;

    const unsubscribe = listenToMessages(chatId, async (newMessages) => {
      if (!isMountedRef.current) return;

      const safeMessages = (Array.isArray(newMessages) ? newMessages : []).filter(
        hasMessageContent
      );

      setMessages((prev) => mergeMessages(prev, safeMessages));

      if (safeMessages.length < 80) {
        setHasOlderMessages(false);
      }

      if (auth.currentUser?.uid) {
        try {
          await markMessagesAsRead(chatId, auth.currentUser.uid);
        } catch (error) {
          console.log("markMessagesAsRead error:", error.message);
        }
      }
    });

    return unsubscribe;
  }, [chatId, chatBlocked]);

  useEffect(() => {
    if (keepScrollPositionRef.current) return;

    scrollToLatestMessage(false);
  }, [messages, scrollToLatestMessage]);

  useEffect(() => {
    messages.forEach((msg) => {
      if (msg?.imageUrl?.startsWith("http")) {
        Image.prefetch(msg.imageUrl).catch(() => {});
      }
    });
  }, [messages]);

  const resetAudioState = () => {
    setLoadingAudioUrl(null);
    setPlayingAudioUrl(null);
    setPausedAudioUrl(null);
    setAudioProgress(0);
    setAudioPosition(0);
    setAudioDuration(0);
  };

  const pickImage = async () => {
    if (chatBlocked) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow photo access from iPhone Settings."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: false,
      });

      if (result.canceled) return;

      const imageUri = result.assets?.[0]?.uri;

      if (!imageUri) {
        Alert.alert("Image error", "Image selected but no image path found.");
        return;
      }

      setSelectedImage(imageUri);
    } catch (error) {
      showError("Gallery error", error);
    }
  };

  const takePhoto = async () => {
    if (chatBlocked) return;

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow camera access from iPhone Settings."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: false,
      });

      if (result.canceled) return;

      const imageUri = result.assets?.[0]?.uri;

      if (!imageUri) {
        Alert.alert("Camera error", "Photo taken but no image path found.");
        return;
      }

      setSelectedImage(imageUri);
    } catch (error) {
      showError("Camera error", error);
    }
  };

  const chooseImageOption = () => {
    if (chatBlocked) return;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Choose from Gallery"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) takePhoto();
          if (buttonIndex === 2) pickImage();
        }
      );
    } else {
      Alert.alert("Send Image", "Choose an option", [
        { text: "Take Photo", onPress: takePhoto },
        { text: "Choose from Gallery", onPress: pickImage },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const uploadImage = async (uri) => {
    if (!uri || !chatId || !auth.currentUser?.uid) {
      throw new Error("Missing image upload information.");
    }

    const response = await fetch(uri);

    if (!response.ok) {
      throw new Error("Could not read selected image.");
    }

    const blob = await response.blob();

    if (!blob) {
      throw new Error("Image file is empty.");
    }

    const filename = `${chatId}_${auth.currentUser.uid}_${Date.now()}.jpg`;
    const storageRef = ref(storage, `chatImages/${filename}`);

    await uploadBytes(storageRef, blob);

    return await getDownloadURL(storageRef);
  };

  const startRecording = async () => {
    if (chatBlocked) return;

    try {
      if (recordedAudioUri) {
        setRecordedAudioUri(null);
      }

      if (recording) return;

      const permission = await Audio.requestPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert("Permission needed", "Microphone permission is needed.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const result = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(result.recording);
    } catch (error) {
      showError("Recording error", error);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;

      await recording.stopAndUnloadAsync();

      const uri = recording.getURI();

      if (!uri) {
        Alert.alert("Voice error", "Could not save voice recording.");
        setRecording(null);
        return;
      }

      setRecordedAudioUri(uri);
      setRecording(null);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
    } catch (error) {
      showError("Recording error", error);
      setRecording(null);
    }
  };

  const uploadAudio = async (uri) => {
    if (!uri || !chatId || !auth.currentUser?.uid) {
      throw new Error("Missing audio upload information.");
    }

    const response = await fetch(uri);

    if (!response.ok) {
      throw new Error("Could not read voice file.");
    }

    const blob = await response.blob();

    if (!blob) {
      throw new Error("Voice file is empty.");
    }

    const filename = `${chatId}_${auth.currentUser.uid}_${Date.now()}.m4a`;
    const storageRef = ref(storage, `chatAudio/${filename}`);

    await uploadBytes(storageRef, blob);

    return await getDownloadURL(storageRef);
  };

  const playAudio = async (audioUrl) => {
    try {
      if (!audioUrl) return;

      if (playingAudioUrl === audioUrl && soundRef.current) {
        await soundRef.current.pauseAsync();
        setPausedAudioUrl(audioUrl);
        setPlayingAudioUrl(null);
        return;
      }

      if (pausedAudioUrl === audioUrl && soundRef.current) {
        await soundRef.current.playAsync();
        setPlayingAudioUrl(audioUrl);
        setPausedAudioUrl(null);
        return;
      }

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      resetAudioState();
      setLoadingAudioUrl(audioUrl);
      setPlayingAudioUrl(audioUrl);

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded || !isMountedRef.current) return;

          const duration = status.durationMillis || 0;
          const position = status.positionMillis || 0;

          setAudioDuration(duration);
          setAudioPosition(position);
          setAudioProgress(duration ? position / duration : 0);

          if (status.didJustFinish) {
            resetAudioState();
          }
        }
      );

      soundRef.current = sound;
      setLoadingAudioUrl(null);
    } catch (error) {
      resetAudioState();
      showError("Audio error", error);
    }
  };

  const handleSend = async () => {
    if (chatBlocked) {
      Alert.alert("Chat unavailable", blockReason || "This chat is blocked.");
      return;
    }

    if (!auth.currentUser?.uid) {
      router.replace("/login");
      return;
    }

    if (!chatId) {
      Alert.alert("Chat error", "Missing chat information.");
      return;
    }

    const trimmedText = text.trim();
    const pendingImageUri = selectedImage;
    const pendingAudioUri = recordedAudioUri;
    const hasAttachment = !!pendingImageUri || !!pendingAudioUri;
    const shouldShowOptimisticMessage = !!trimmedText || hasAttachment;
    const optimisticMessageId = `local-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    if (!trimmedText && !hasAttachment) return;
    if (sending || sendingRef.current) return;

    try {
      sendingRef.current = true;
      setSending(true);

      if (shouldShowOptimisticMessage) {
        setMessages((prev) => [
          ...prev,
          {
            id: optimisticMessageId,
            senderId: auth.currentUser.uid,
            text: trimmedText,
            imageUrl: pendingImageUri || "",
            audioUrl: pendingAudioUri || "",
            clientMessageId: optimisticMessageId,
            createdAt: new Date(),
            status: "sending",
          },
        ]);

        setText("");
        setSelectedImage(null);
        setRecordedAudioUri(null);
        updateTypingStatus(false, true);
      }

      let imageUrl = "";
      let audioUrl = "";

      if (pendingImageUri) {
        imageUrl = await uploadImage(pendingImageUri);
      }

      if (pendingAudioUri) {
        audioUrl = await uploadAudio(pendingAudioUri);
      }

      const serverMessageId = await sendMessage(
        chatId,
        auth.currentUser.uid,
        trimmedText,
        imageUrl,
        audioUrl,
        optimisticMessageId
      );

      updateTypingStatus(false, true);

      if (shouldShowOptimisticMessage && isMountedRef.current) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === optimisticMessageId
              ? {
                  ...msg,
                  id: serverMessageId || msg.id,
                  imageUrl: imageUrl || msg.imageUrl,
                  audioUrl: audioUrl || msg.audioUrl,
                  clientMessageId: optimisticMessageId,
                  status: "sent",
                }
              : msg
          )
        );
      }

      if (isMountedRef.current) {
        setText("");
        setSelectedImage(null);
        setRecordedAudioUri(null);
      }
    } catch (error) {
      if (shouldShowOptimisticMessage && isMountedRef.current) {
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== optimisticMessageId)
        );
        setText(trimmedText);
        setSelectedImage(pendingImageUri);
        setRecordedAudioUri(pendingAudioUri);
      }

      showError("Send failed", error);
    } finally {
      sendingRef.current = false;
      if (isMountedRef.current) {
        setSending(false);
      }
    }
  };

  const handleTextChange = (value) => {
    if (chatBlocked) return;

    setText(value);

    updateTypingStatus(value.length > 0);
  };

  const statusText = isTyping
    ? "Typing..."
    : userStatus?.isOnline
    ? "Online now"
    : formatLastSeen(userStatus?.lastSeen);

  const statusColor = isTyping || userStatus?.isOnline ? COLORS.lime : "#777";

  if (checkingBlock) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: COLORS.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator color="#111" />
        <Text style={{ marginTop: 12, fontWeight: "900", color: COLORS.black }}>
          Checking chat...
        </Text>
      </SafeAreaView>
    );
  }

  if (chatBlocked) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background,}}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderColor: "#dbe3ea",
            backgroundColor: COLORS.softCard,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              backgroundColor: COLORS.teal,
              paddingHorizontal: 13,
              paddingVertical: 9,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: COLORS.white, fontWeight: "900" }}>‹</Text>
          </TouchableOpacity>

          <Text
            style={{
              marginLeft: 14,
              fontSize: 18,
              fontWeight: "900",
              color: COLORS.black,
            }}
          >
            Chat unavailable
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 28,
          }}
        >
          <Text style={{ fontSize: 46 }}>🚫</Text>

          <Text
            style={{
              marginTop: 14,
              fontSize: 26,
              fontWeight: "900",
              color: COLORS.black,
              textAlign: "center",
            }}
          >
            This chat is blocked
          </Text>

          <Text
            style={{
              marginTop: 10,
              color: COLORS.darkBlueGray,
              lineHeight: 22,
              textAlign: "center",
              fontWeight: "700",
            }}
          >
            {blockReason ||
              "You cannot send or receive messages in this conversation."}
          </Text>

          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              marginTop: 24,
              backgroundColor: COLORS.teal,
              borderRadius: 999,
              paddingVertical: 15,
              paddingHorizontal: 36,
            }}
          >
            <Text style={{ color: COLORS.white, fontWeight: "900" }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <LinearGradient
          colors={[COLORS.background, COLORS.mint, COLORS.background]}
          style={{ flex: 1 }}
        >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderColor: "#dbe3ea",
            backgroundColor: COLORS.softCard,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              backgroundColor: COLORS.teal,
              paddingHorizontal: 13,
              paddingVertical: 9,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: COLORS.white, fontWeight: "900" }}>‹</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setProfileModalVisible(true)}
            activeOpacity={0.85}
            style={{ marginLeft: 12 }}
          >
            <Image
              source={{ uri: avatarPhoto }}
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: "#dbe3ea",
              }}
            />

            {userStatus?.isOnline && (
              <View
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: COLORS.lime,
                  borderWidth: 2,
                  borderColor: COLORS.white,
                }}
              />
            )}
          </TouchableOpacity>

          <View style={{ marginLeft: 12, flex: 1 }}>
  <TouchableOpacity
    onPress={() => {
      if (otherUserId) {
        router.push(`/user-profile?userId=${encodeURIComponent(otherUserId)}`);
      }
    }}
  >
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: "900",
          color: COLORS.black,
        }}
      >
        {name || "User"}
      </Text>

      {userStatus?.verified && (
        <View
          style={{
            marginLeft: 8,
            backgroundColor: COLORS.teal,
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text
            style={{
              color: COLORS.white,
              fontWeight: "900",
              fontSize: 10,
            }}
          >
            ✓ VERIFIED
          </Text>
        </View>
      )}
    </View>
  </TouchableOpacity>

  <Text
    style={{
      color: statusColor,
      fontSize: 13,
      fontWeight: "800",
      marginTop: 2,
    }}
  >
    {statusText}
  </Text>
</View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (!keepScrollPositionRef.current) {
              scrollToLatestMessage(false);
            }
          }}
          onLayout={() => scrollToLatestMessage(false)}
        >
          {messages.length > 0 && hasOlderMessages ? (
            <TouchableOpacity
              onPress={loadOlderMessages}
              disabled={loadingOlderMessages}
              activeOpacity={0.86}
              style={{
                alignSelf: "center",
                backgroundColor: COLORS.softCard,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: COLORS.softBorder,
                paddingHorizontal: 18,
                paddingVertical: 10,
                marginBottom: 14,
                minWidth: 176,
                alignItems: "center",
              }}
            >
              {loadingOlderMessages ? (
                <ActivityIndicator color={COLORS.rose} size="small" />
              ) : (
                <Text
                  style={{
                    color: COLORS.rose,
                    fontWeight: "900",
                    fontSize: 13,
                  }}
                >
                  Load Earlier Messages
                </Text>
              )}
            </TouchableOpacity>
          ) : null}

          {messages.map((msg) => {
            const isMe = msg.senderId === auth.currentUser?.uid;
            const messageText = getMessageText(msg);
            const isSending = msg.status === "sending";
            const isPlaying = playingAudioUrl === msg.audioUrl;
            const isPaused = pausedAudioUrl === msg.audioUrl;
            const isLoadingAudio = loadingAudioUrl === msg.audioUrl;
            const progressForThisAudio =
              isPlaying || isPaused ? audioProgress : 0;
            const durationForThisAudio =
              isPlaying || isPaused ? audioDuration : 0;
            const positionForThisAudio =
              isPlaying || isPaused ? audioPosition : 0;

            return (
              <View
                key={msg.id}
                style={{
                  alignSelf: isMe ? "flex-end" : "flex-start",
                  backgroundColor: isMe ? COLORS.teal : COLORS.white,
                  padding: msg.imageUrl ? 7 : 13,
                  borderRadius: 24,
                  marginBottom: 12,
                  maxWidth: "82%",
                  shadowColor: "#000",
                  shadowOpacity: 0.06,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 2,
                }}
              >
                {msg.imageUrl ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      setChatImagePreviewLoading(true);
                      setChatImagePreviewUrl(msg.imageUrl);
                    }}
                  >
                    <Image
                      source={{ uri: msg.imageUrl }}
                      style={{
                        width: 230,
                        height: 230,
                        borderRadius: 18,
                        marginBottom: messageText || msg.audioUrl ? 8 : 0,
                        opacity: isSending ? 0.72 : 1,
                      }}
                    />

                    {isSending && (
                      <View
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: messageText || msg.audioUrl ? 8 : 0,
                          borderRadius: 18,
                          backgroundColor: "rgba(0,0,0,0.22)",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <ActivityIndicator color={COLORS.white} />
                        <Text
                          style={{
                            color: COLORS.white,
                            marginTop: 8,
                            fontWeight: "900",
                          }}
                        >
                          Sending...
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ) : null}

                {msg.audioUrl ? (
                  <TouchableOpacity
                    onPress={() => playAudio(msg.audioUrl)}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: isMe
                        ? "rgba(255,255,255,0.14)"
                        : "#f1f5f9",
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderRadius: 20,
                      marginBottom: messageText ? 8 : 0,
                      minWidth: 230,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: isMe ? COLORS.white : COLORS.teal,
                          justifyContent: "center",
                          alignItems: "center",
                          marginRight: 12,
                        }}
                      >
                        {isLoadingAudio ? (
                          <ActivityIndicator
                            color={isMe ? COLORS.teal : COLORS.white}
                            size="small"
                          />
                        ) : null}
                        <Text
                          style={{
                            fontSize: 16,
                            opacity: isLoadingAudio ? 0 : 1,
                          }}
                        >
                          {isPlaying ? "⏸" : "▶️"}
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <VoiceWave
                          isMe={isMe}
                          progress={progressForThisAudio}
                        />

                        <View
                          style={{
                            height: 4,
                            backgroundColor: isMe
                              ? "rgba(255,255,255,0.32)"
                              : "#dbe3ea",
                            borderRadius: 999,
                            overflow: "hidden",
                            marginTop: 8,
                          }}
                        >
                          <View
                            style={{
                              width: `${Math.max(
                                3,
                                progressForThisAudio * 100
                              )}%`,
                              height: "100%",
                              backgroundColor: isMe ? COLORS.white : COLORS.teal,
                            }}
                          />
                        </View>

                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginTop: 6,
                          }}
                        >
                          <Text
                            style={{
                              color: isMe ? "rgba(255,255,255,0.82)" : "#777",
                              fontSize: 12,
                              fontWeight: "800",
                            }}
                          >
                            {isSending
                              ? "Sending..."
                              : isLoadingAudio
                              ? "Opening..."
                              : isPlaying
                              ? "Playing"
                              : isPaused
                              ? "Paused"
                              : "Voice"}
                          </Text>

                          <Text
                            style={{
                              color: isMe ? "rgba(255,255,255,0.82)" : "#777",
                              fontSize: 12,
                              fontWeight: "800",
                            }}
                          >
                            {durationForThisAudio
                              ? `${formatAudioTime(
                                  positionForThisAudio
                                )} / ${formatAudioTime(durationForThisAudio)}`
                              : "0:00"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ) : null}

                {messageText ? (
                  <Text
                    style={{
                      color: isMe ? COLORS.white : COLORS.background,
                      fontSize: 15,
                      lineHeight: 21,
                      paddingHorizontal: msg.imageUrl ? 6 : 0,
                      paddingBottom: msg.imageUrl ? 4 : 0,
                    }}
                  >
                    {messageText}
                  </Text>
                ) : null}

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    marginTop: 5,
                    paddingHorizontal: msg.imageUrl ? 6 : 0,
                  }}
                >
                  <Text
                    style={{
                      color: isMe ? "rgba(255,255,255,0.78)" : "#999",
                      fontSize: 11,
                      fontWeight: "700",
                      marginRight: isMe ? 6 : 0,
                    }}
                  >
                    {formatMessageTime(msg.createdAt)}
                  </Text>

                  {isMe && (
                    <Text style={{ color: isMe ? COLORS.white : COLORS.teal, fontSize: 11 }}>
                      {isSending
                        ? "..."
                        : msg.status === "read"
                        ? "🔵🔵"
                        : "🔵"}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View
          style={{
            padding: 12,
            borderTopWidth: 1,
            borderColor: "#dbe3ea",
            backgroundColor: COLORS.softCard,
          }}
        >
          {selectedImage && (
            <View style={{ marginBottom: 10 }}>
              <Image
                source={{ uri: selectedImage }}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 16,
                }}
              />

              <TouchableOpacity
                onPress={() => setSelectedImage(null)}
                style={{
                  position: "absolute",
                  top: -8,
                  left: 82,
                  backgroundColor: COLORS.rose,
                  borderRadius: 13,
                  width: 26,
                  height: 26,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: COLORS.white, fontWeight: "900" }}>×</Text>
              </TouchableOpacity>
            </View>
          )}

          {recordedAudioUri && (
            <View
              style={{
                marginBottom: 10,
                padding: 14,
                borderRadius: 20,
                backgroundColor: COLORS.blueSoft,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: COLORS.teal,
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: 12,
                  }}
                >
                  <Text style={{ color: COLORS.white, fontSize: 18 }}>🎤</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "900", color: COLORS.black }}>
                    Voice ready
                  </Text>

                  <Text
                    style={{ color: "#777", marginTop: 3, fontWeight: "700" }}
                  >
                    Add a message or send it now
                  </Text>
                </View>

                <TouchableOpacity onPress={() => setRecordedAudioUri(null)}>
                  <Text style={{ fontWeight: "900", color: COLORS.rose }}>
                    Remove
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {messages.length < 4 && suggestedIcebreaker ? (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={() => setText(suggestedIcebreaker)}
    style={{
      marginBottom: 8,
      backgroundColor: COLORS.blueSoft,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: "#b8ece7",
    }}
  >
    <Text
      numberOfLines={1}
      style={{
        color: COLORS.black,
        fontSize: 14,
        fontWeight: "800",
      }}
    >
      💡 {suggestedIcebreaker}
    </Text>
  </TouchableOpacity>
) : null}

<View
  style={{
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 24,
    padding: 8,
    borderWidth: 1,
    borderColor: "#dbe3ea",
  }}
>
  <TouchableOpacity
    onPress={chooseImageOption}
    style={{
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: COLORS.softCard,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 8,
    }}
  >
    <Text style={{ fontSize: 20 }}>📸</Text>
  </TouchableOpacity>

  <TouchableOpacity
    onPress={recording ? stopRecording : startRecording}
    style={{
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: recording ? COLORS.rose : COLORS.white,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 8,
    }}
  >
    <Text style={{ fontSize: 20 }}>{recording ? "⏹" : "🎤"}</Text>
  </TouchableOpacity>

  <TextInput
    value={text}
    onChangeText={handleTextChange}
    onFocus={() => scrollToLatestMessage(true)}
    placeholder={
      selectedImage || recordedAudioUri ? "Add a message..." : "Message..."
    }
    placeholderTextColor="#999"
    style={{
      flex: 1,
      color: COLORS.black,
      fontSize: 15,
      paddingVertical: 10,
      paddingHorizontal: 8,
    }}
  />

  <TouchableOpacity
    onPress={handleSend}
    disabled={sending}
    style={{
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: COLORS.teal,
      justifyContent: "center",
      alignItems: "center",
      opacity: sending ? 0.6 : 1,
      marginLeft: 8,
    }}
  >
    {sending ? (
      <ActivityIndicator color="white" size="small" />
    ) : (
      <Text style={{ color: COLORS.white, fontWeight: "900" }}>➤</Text>
    )}
  </TouchableOpacity>
</View>  
         
          
        </View>

        <Modal
          transparent
          visible={profileModalVisible}
          animationType="fade"
          onRequestClose={() => setProfileModalVisible(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.86)",
              justifyContent: "center",
              alignItems: "center",
              padding: 24,
            }}
          >
            <View
              style={{
                backgroundColor: COLORS.softCard,
                borderRadius: 34,
                padding: 22,
                width: "100%",
                alignItems: "center",
              }}
            >
              <View>
                <Image
                  source={{ uri: activeProfilePhoto }}
                  style={{
                    width: 240,
                    height: 300,
                    borderRadius: 30,
                    backgroundColor: COLORS.blueSoft,
                  }}
                />

                {profilePhotos.length > 1 && (
                  <>
                    <TouchableOpacity
                      onPress={goPreviousProfilePhoto}
                      activeOpacity={0.7}
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: "45%",
                      }}
                    />

                    <TouchableOpacity
                      onPress={goNextProfilePhoto}
                      activeOpacity={0.7}
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: "45%",
                      }}
                    />

                    <View
                      style={{
                        position: "absolute",
                        top: 12,
                        left: 12,
                        right: 12,
                        flexDirection: "row",
                        gap: 5,
                      }}
                    >
                      {profilePhotos.map((_, index) => (
                        <View
                          key={index}
                          style={{
                            flex: 1,
                            height: 4,
                            borderRadius: 999,
                            backgroundColor:
                              index === profilePhotoIndex
                                ? "white"
                                : "rgba(255,255,255,0.45)",
                          }}
                        />
                      ))}
                    </View>
                  </>
                )}
              </View>

              <Text
                style={{
                  marginTop: 18,
                  fontSize: 28,
                  fontWeight: "900",
                  color: COLORS.black,
                }}
              >
                {name || "User"}
              </Text>

              <Text
                style={{
                  marginTop: 6,
                  color: statusColor,
                  fontWeight: "800",
                }}
              >
                {statusText}
              </Text>

              <TouchableOpacity
                onPress={() => setProfileModalVisible(false)}
                style={{
                  marginTop: 24,
                  backgroundColor: COLORS.teal,
                  borderRadius: 999,
                  paddingVertical: 15,
                  width: "100%",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ color: COLORS.white, fontWeight: "900", fontSize: 16 }}
                >
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          transparent
          visible={!!chatImagePreviewUrl}
          animationType="fade"
          onRequestClose={() => setChatImagePreviewUrl("")}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.94)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Image
              source={{ uri: chatImagePreviewUrl }}
              resizeMode="contain"
              onLoadStart={() => setChatImagePreviewLoading(true)}
              onLoadEnd={() => setChatImagePreviewLoading(false)}
              style={{
                width: "100%",
                height: "82%",
              }}
            />

            {chatImagePreviewLoading && (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <ActivityIndicator color={COLORS.white} size="large" />
                <Text
                  style={{
                    color: COLORS.white,
                    marginTop: 12,
                    fontWeight: "900",
                  }}
                >
                  Opening photo...
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() => {
                setChatImagePreviewUrl("");
                setChatImagePreviewLoading(false);
              }}
              style={{
                position: "absolute",
                top: 54,
                right: 20,
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "rgba(255,255,255,0.18)",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: COLORS.white,
                  fontSize: 28,
                  fontWeight: "900",
                }}
              >
                ×
              </Text>
            </TouchableOpacity>
          </View>
        </Modal>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
