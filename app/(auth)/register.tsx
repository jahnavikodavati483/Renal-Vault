import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signUp } from '../../services/auth';
import { Button } from '../../components/ui/Button';
import { LogoBrand } from '../../components/Logo';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { Sex } from '../../types';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password || !age) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
      Alert.alert('Invalid age', 'Please enter a valid age.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim(), ageNum, sex);
      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      Alert.alert('Registration Failed', e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <LogoBrand size="lg" showTagline />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Your age and sex are used to accurately calculate your eGFR.</Text>

        {/* Name */}
        <InputField
          label="Full Name"
          icon="person-outline"
          value={name}
          onChangeText={setName}
          placeholder="John Doe"
        />

        {/* Email */}
        <InputField
          label="Email Address"
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Password */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input]}
              placeholder="Min. 6 characters"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Age */}
        <InputField
          label="Age (years)"
          icon="calendar-outline"
          value={age}
          onChangeText={setAge}
          placeholder="e.g. 45"
          keyboardType="numeric"
        />

        {/* Sex selector */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Biological Sex</Text>
          <Text style={styles.helperText}>Required for accurate eGFR calculation</Text>
          <View style={styles.sexRow}>
            {(['male', 'female'] as Sex[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.sexBtn, sex === s && styles.sexBtnSelected]}
                onPress={() => setSex(s)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={s === 'male' ? 'male' : 'female'}
                  size={20}
                  color={sex === s ? Colors.white : Colors.primary}
                />
                <Text style={[styles.sexBtnText, sex === s && styles.sexBtnTextSelected]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Button
          title="Create Account"
          onPress={handleRegister}
          loading={loading}
          fullWidth
          style={styles.registerBtn}
          size="lg"
        />

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InputField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  icon: any;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: any;
  autoCapitalize?: any;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <Ionicons name={icon} size={18} color={Colors.textMuted} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'words'}
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 70,
    paddingBottom: 28,
    paddingHorizontal: Spacing.lg,
    backgroundColor: '#F8FAFB',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { position: 'absolute', left: Spacing.lg, top: 70 },
  body: { padding: Spacing.lg, paddingTop: Spacing.xl },
  title: { ...Typography.displayMedium, color: Colors.text, marginBottom: Spacing.xs },
  subtitle: { ...Typography.bodyMedium, color: Colors.textSecondary, marginBottom: Spacing.lg },
  inputGroup: { marginBottom: Spacing.md },
  label: { ...Typography.labelLarge, color: Colors.text, marginBottom: Spacing.xs },
  helperText: { ...Typography.bodySmall, color: Colors.textMuted, marginBottom: Spacing.xs },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, ...Typography.bodyLarge, color: Colors.text },
  eyeIcon: { padding: Spacing.xs },
  sexRow: { flexDirection: 'row', gap: Spacing.md },
  sexBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  sexBtnSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sexBtnText: { ...Typography.labelLarge, color: Colors.primary },
  sexBtnTextSelected: { color: Colors.white },
  registerBtn: { marginTop: Spacing.md, marginBottom: Spacing.lg },
  loginRow: { flexDirection: 'row', justifyContent: 'center', paddingBottom: Spacing.xl },
  loginText: { ...Typography.bodyMedium, color: Colors.textSecondary },
  loginLink: { ...Typography.bodyMedium, color: Colors.primary, fontWeight: '700' },
});
