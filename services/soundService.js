import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";

const WHISTLE_STORAGE_KEY = "selectedWhistleSound";

export const WHISTLE_SOUNDS = [
  { key: "soft", label: "Soft whistle" },
  { key: "bright", label: "Bright whistle" },
  { key: "double", label: "Double whistle" },
  { key: "pop", label: "Pop whistle" },
];

const WHISTLE_ASSETS = {
  soft: require("../assets/sounds/whistle-soft.wav"),
  bright: require("../assets/sounds/whistle-bright.wav"),
  double: require("../assets/sounds/whistle-double.wav"),
  pop: require("../assets/sounds/whistle-pop.wav"),
};

const activeSounds = new Set();
let selectedWhistleSound = "bright";

const playSound = async (asset, volume = 0.75) => {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
    });

    const { sound } = await Audio.Sound.createAsync(asset, {
      shouldPlay: false,
      volume,
    });

    activeSounds.add(sound);

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status?.didJustFinish) {
        activeSounds.delete(sound);
        sound.unloadAsync().catch(() => {});
      }
    });

    await sound.setVolumeAsync(volume);
    await sound.replayAsync();
    return true;
  } catch (error) {
    console.log("Sound effect error:", error.message);
    return false;
  }
};

export const loadWhistleSoundPreference = async () => {
  try {
    const storedValue = await AsyncStorage.getItem(WHISTLE_STORAGE_KEY);

    if (storedValue && WHISTLE_ASSETS[storedValue]) {
      selectedWhistleSound = storedValue;
    }
  } catch (error) {
    console.log("Load whistle preference error:", error.message);
  }

  return selectedWhistleSound;
};

export const saveWhistleSoundPreference = async (key) => {
  if (!WHISTLE_ASSETS[key]) return selectedWhistleSound;

  selectedWhistleSound = key;

  try {
    await AsyncStorage.setItem(WHISTLE_STORAGE_KEY, key);
  } catch (error) {
    console.log("Save whistle preference error:", error.message);
  }

  return selectedWhistleSound;
};

export const playWhistleSound = async (key = selectedWhistleSound) => {
  const soundKey = WHISTLE_ASSETS[key] ? key : selectedWhistleSound;
  return playSound(WHISTLE_ASSETS[soundKey], 1);
};

export const playMatchWhistle = async () => {
  await loadWhistleSoundPreference();
  return playWhistleSound(selectedWhistleSound);
};

export const playNotificationWhistle = () =>
  playSound(require("../assets/sounds/notification_whistle.wav"), 0.85);
