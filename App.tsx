import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Animated,
} from "react-native";

type CalcResult = {
  gross: number;
  withholding: number;
  net: number;
  eay: number;
  stopajPctUsed: number;
};

const STOPAJ_TL_UP_TO_6M = 17.5; // <=180
const STOPAJ_TL_UP_TO_1Y = 15; // 181-365
const STOPAJ_TL_OVER_1Y = 10; // >365

// TCMB bilgi
const TCMB_POLICY_RATE_PCT = 37;
const TCMB_POLICY_RATE_DECISION_DATE = "22 Ocak 2026";
const TCMB_NEXT_MPC_MEETING_DATE = "12 Mart 2026";

const DEFAULT_PRINCIPAL = 500000;
const DEFAULT_RATE = 42.5;
const DEFAULT_DAYS = 32;

function clampNonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatTL(n: number): string {
  const rounded = Math.round(Number.isFinite(n) ? n : 0);
  return new Intl.NumberFormat("tr-TR").format(rounded);
}

function parsePrincipalInt(input: string): number {
  const digits = (input ?? "").toString().replace(/\D+/g, "");
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

function formatThousandsTR(input: string): string {
  let s = (input ?? "").toString();
  s = s.replace(/,/g, "");
  const digits = s.replace(/\D+/g, "");
  if (!digits) return "";
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("tr-TR").format(n);
}

function digitsOnly(text: string): string {
  return (text ?? "").replace(/\D+/g, "");
}

function formatRateTR(input: string): string {
  let s = (input ?? "").toString();

  s = s.replace(/\./g, ",");
  s = s.replace(/[^0-9,]/g, "");

  const firstCommaIndex = s.indexOf(",");
  if (firstCommaIndex !== -1) {
    const before = s.slice(0, firstCommaIndex + 1);
    const after = s.slice(firstCommaIndex + 1).replace(/,/g, "");
    s = before + after;
  }

  if (s.startsWith(",")) s = "0" + s;
  return s;
}

function parseRateNumber(input: string): number {
  const raw = (input ?? "").toString().trim();
  if (!raw) return 0;

  let s = raw.replace(/\s+/g, "");
  s = s.replace(",", ".");
  s = s.replace(/[^0-9.]/g, "");

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function getStopajPctForTlDepositDays(days: number): number {
  const d = Math.max(1, Math.floor(clampNonNegative(days)));
  if (d <= 180) return STOPAJ_TL_UP_TO_6M;
  if (d <= 365) return STOPAJ_TL_UP_TO_1Y;
  return STOPAJ_TL_OVER_1Y;
}

function calcNetDeposit(params: {
  principal: number;
  annualRatePct: number;
  days: number;
}): CalcResult {
  const P = clampNonNegative(params.principal);
  const r = clampNonNegative(params.annualRatePct) / 100;
  const d = Math.max(1, Math.floor(clampNonNegative(params.days)));

  const stopajPctUsed = getStopajPctForTlDepositDays(d);
  const s = stopajPctUsed / 100;

  const gross = P * r * (d / 365);
  const withholding = gross * s;
  const net = gross - withholding;

  const eay = P > 0 ? (net / P) * (365 / d) * 100 : 0;

  return { gross, withholding, net, eay, stopajPctUsed };
}

function copyToClipboard(text: string) {
  // Web (Vercel)
  const nav: any = typeof navigator !== "undefined" ? navigator : null;
  if (nav?.clipboard?.writeText) {
    return nav.clipboard.writeText(text);
  }

  // Fallback (web)
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

export default function App() {
  const [principalText, setPrincipalText] = useState(() => formatTL(DEFAULT_PRINCIPAL));
  const [rateText, setRateText] = useState(() => DEFAULT_RATE.toString().replace(".", ","));

  const [selectedDays, setSelectedDays] = useState<32 | 92 | 180 | "custom">(DEFAULT_DAYS);
  const [customDaysText, setCustomDaysText] = useState(() => String(DEFAULT_DAYS));

  // Input focus state
  const [focus, setFocus] = useState<{ principal: boolean; rate: boolean; days: boolean }>({
    principal: false,
    rate: false,
    days: false,
  });

  // Kopyalandı feedback
  const [copied, setCopied] = useState(false);

  const daysValue = useMemo(() => {
    if (selectedDays === "custom") {
      const d = parseInt(digitsOnly(customDaysText), 10);
      return Number.isFinite(d) && d > 0 ? d : 0;
    }
    return selectedDays;
  }, [selectedDays, customDaysText]);

  const principalNumber = useMemo(() => parsePrincipalInt(principalText), [principalText]);
  const rateNumber = useMemo(() => parseRateNumber(rateText), [rateText]);

  const result = useMemo(() => {
    const days = daysValue > 0 ? daysValue : DEFAULT_DAYS;
    return calcNetDeposit({ principal: principalNumber, annualRatePct: rateNumber, days });
  }, [principalNumber, rateNumber, daysValue]);

  // Pulse
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseKey = useMemo(
    () => `${principalText}|${rateText}|${daysValue}`,
    [principalText, rateText, daysValue]
  );

  useEffect(() => {
    Animated.sequence([
      Animated.timing(pulse, { toValue: 0.985, duration: 90, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [pulseKey, pulse]);

  const canCalculate = principalNumber > 0 && rateNumber > 0;

  async function onCopyNet() {
    if (!canCalculate) return;

    const days = daysValue || DEFAULT_DAYS;
    const netStr = `${formatTL(result.net)} TL`;
    const text = `Net kazanç: ${netStr} (Anapara: ${formatTL(principalNumber)} TL, Faiz: %${rateText}, Vade: ${days} gün)`;

    await copyToClipboard(text);

    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  }

  const warningText = !principalNumber
    ? "Anapara girin"
    : !rateNumber
    ? "Faiz oranı girin"
    : "";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.androidTopPad} />

      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit>
            Net TL Mevduat
          </Text>
          <Text style={styles.subtitle}>Elinize Geçecek Net TL</Text>

          <Text style={styles.exampleNote}>Örnek değerler doludur. Değiştirince otomatik hesaplanır.</Text>

          {/* FORM */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Anapara (TL)</Text>
              <TextInput
                value={principalText}
                onChangeText={(t) => setPrincipalText(formatThousandsTR(t))}
                keyboardType="numeric"
                placeholder="Örnek: 100.000"
                style={[styles.input, focus.principal && styles.inputFocus]}
                onFocus={() => setFocus((p) => ({ ...p, principal: true }))}
                onBlur={() => setFocus((p) => ({ ...p, principal: false }))}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Faiz Oranı (%)</Text>
              <TextInput
                value={rateText}
                onChangeText={(t) => setRateText(formatRateTR(t))}
                keyboardType="numeric"
                placeholder="Örnek: 42,5"
                style={[styles.input, focus.rate && styles.inputFocus]}
                onFocus={() => setFocus((p) => ({ ...p, rate: true }))}
                onBlur={() => setFocus((p) => ({ ...p, rate: false }))}
              />
              <Text style={styles.smallHint}>Ondalık için virgül kullanın (örn: 37,5).</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Vade (Gün)</Text>

              <View style={styles.pills}>
                {[32, 92, 180].map((d) => {
                  const active = selectedDays === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => {
                        setSelectedDays(d as 32 | 92 | 180);
                        setCustomDaysText(String(d));
                      }}
                      style={[styles.pill, active && styles.pillActive]}
                    >
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>{d}</Text>
                    </Pressable>
                  );
                })}

                <Pressable
                  onPress={() => setSelectedDays("custom")}
                  style={[styles.pill, selectedDays === "custom" && styles.pillActive]}
                >
                  <Text style={[styles.pillText, selectedDays === "custom" && styles.pillTextActive]}>Özel</Text>
                </Pressable>
              </View>

              {selectedDays === "custom" && (
                <TextInput
                  value={customDaysText}
                  onChangeText={(t) => setCustomDaysText(digitsOnly(t))}
                  keyboardType="numeric"
                  placeholder="Gün girin (ör. 400)"
                  style={[styles.input, { marginTop: 10 }, focus.days && styles.inputFocus]}
                  onFocus={() => setFocus((p) => ({ ...p, days: true }))}
                  onBlur={() => setFocus((p) => ({ ...p, days: false }))}
                />
              )}
            </View>
          </View>

          {/* NET KART + KOPYALA */}
          <Animated.View style={[styles.netCard, { transform: [{ scale: pulse }] }]}>
            <Pressable onPress={onCopyNet} disabled={!canCalculate} style={styles.netPressArea}>
              <Text style={[styles.netValue, !canCalculate && styles.netValueDisabled]}>
                + {formatTL(canCalculate ? result.net : 0)} TL
              </Text>

              <View style={styles.netLabelRow}>
                <Text style={styles.netLabel}>Net Kazanç</Text>
                {copied ? <Text style={styles.copied}>Kopyalandı ✓</Text> : <Text style={styles.copyHint}>Dokun → Kopyala</Text>}
              </View>

              {!canCalculate ? <Text style={styles.warning}>{warningText}</Text> : null}

              <View style={styles.metaPills}>
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>Vade: {daysValue || DEFAULT_DAYS} gün</Text>
                </View>
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>Stopaj: %{result.stopajPctUsed}</Text>
                </View>
              </View>

              <Text style={styles.microNote}>Hesaplama: basit faiz (365 gün)</Text>
            </Pressable>
          </Animated.View>

          {/* DETAY */}
          <View style={styles.breakdown}>
            <Text style={styles.breakRow}>Brüt getiri: {formatTL(result.gross)} TL</Text>
            <Text style={styles.breakRow}>Stopaj kesintisi: {formatTL(result.withholding)} TL</Text>
            <Text style={styles.breakSubRow}>
              Vade: {daysValue || DEFAULT_DAYS} gün — Uygulanan stopaj: %{result.stopajPctUsed}
            </Text>
            <Text style={styles.breakRow}>Efektif yıllık (EAY): {result.eay.toFixed(1)}%</Text>
          </View>

          {/* TCMB bilgi */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>TCMB Bilgisi</Text>
            <Text style={styles.infoLine}>
              Politika faizi: %{TCMB_POLICY_RATE_PCT} (PPK karar tarihi: {TCMB_POLICY_RATE_DECISION_DATE})
            </Text>
            <Text style={styles.infoLine}>Sonraki PPK toplantısı: {TCMB_NEXT_MPC_MEETING_DATE}</Text>
            <Text style={styles.infoHint}>
              Bu araç bilgilendirme amaçlıdır. Nihai getiri ve vergi uygulamaları ilgili finans kuruluşu tarafından
              belirlenir.
            </Text>
          </View>

          <Text style={styles.footerHint}>© Net Mevduat — Basit, hızlı, net.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FAFB" },
  androidTopPad: { height: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0 },

  container: { padding: 18, paddingBottom: 34 },

  title: { fontSize: 24, fontWeight: "800", color: "#111827", textAlign: "center" },
  subtitle: { marginTop: 4, fontSize: 14, color: "#6B7280", textAlign: "center" },
  exampleNote: { marginTop: 10, fontSize: 12, color: "#6B7280", textAlign: "center" },

  form: { marginTop: 18, gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 13, color: "#374151", fontWeight: "700" },

  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: "#111827",
  },
  inputFocus: {
    borderColor: "#111827",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },

  smallHint: { marginTop: 4, fontSize: 12, color: "#6B7280" },

  pills: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  pillActive: { borderColor: "#111827", backgroundColor: "#F3F4F6" },
  pillText: { color: "#374151", fontWeight: "700" },
  pillTextActive: { color: "#111827" },

  netCard: {
    marginTop: 18,
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  netPressArea: { width: "100%", alignItems: "center", paddingVertical: 6 },

  netValue: { fontSize: 40, fontWeight: "900", color: "#166534" },
  netValueDisabled: { color: "#9CA3AF" },

  netLabelRow: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 4 },
  netLabel: { fontSize: 14, color: "#6B7280" },
  copyHint: { fontSize: 12, color: "#065F46", fontWeight: "700" },
  copied: { fontSize: 12, color: "#065F46", fontWeight: "900" },

  warning: { marginTop: 6, fontSize: 12, color: "#6B7280", fontWeight: "700" },

  metaPills: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap", justifyContent: "center" },
  metaPill: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  metaPillText: { fontSize: 12, color: "#065F46", fontWeight: "800" },

  microNote: { marginTop: 8, fontSize: 11, color: "#6B7280" },

  breakdown: { marginTop: 16, alignSelf: "stretch", gap: 6 },
  breakRow: { fontSize: 13, color: "#374151", textAlign: "center" },
  breakSubRow: { fontSize: 12, color: "#111827", textAlign: "center", fontWeight: "700" },

  infoCard: {
    marginTop: 18,
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  infoTitle: { fontSize: 12, fontWeight: "900", color: "#1E3A8A", marginBottom: 6 },
  infoLine: { fontSize: 12, color: "#1E3A8A", marginBottom: 2 },
  infoHint: { marginTop: 6, fontSize: 11, color: "#334155" },

  footerHint: { marginTop: 16, fontSize: 11, color: "#9CA3AF", textAlign: "center" },
});