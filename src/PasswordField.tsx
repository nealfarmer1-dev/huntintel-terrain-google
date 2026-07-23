import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useState } from "react";
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from "react-native";

type PasswordFieldProps = Omit<TextInputProps, "secureTextEntry">;

export function PasswordField({ style, ...props }: PasswordFieldProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const accessibilityLabel = passwordVisible ? "Hide password" : "Show password";

  return (
    <View style={styles.container}>
      <TextInput
        {...props}
        secureTextEntry={!passwordVisible}
        style={[style, styles.input]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked: passwordVisible }}
        hitSlop={4}
        onPress={() => setPasswordVisible((visible) => !visible)}
        style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
      >
        <Ionicons
          name={passwordVisible ? "eye-off-outline" : "eye-outline"}
          size={22}
          color="#d0a65d"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative" },
  input: { paddingRight: 58 },
  toggle: {
    position: "absolute",
    right: 0,
    top: "50%",
    height: 48,
    width: 48,
    minHeight: 48,
    transform: [{ translateY: -24 }],
    alignItems: "center",
    justifyContent: "center",
  },
  togglePressed: { opacity: 0.65 },
});
