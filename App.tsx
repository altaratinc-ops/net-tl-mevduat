import React, { useMemo, useState } from "react";
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
} from "react-native";

type CalcResult = {
  gross: number;
  withholding: number;
  net: number;
  eay: number;
  stopajPctUsed: number;
};

// Bilgi tarihleri (manuel)
const INFO_LAST_UPDATED = "2026-02-25";

// TL mevduat stopaj oranları (vade bazlı)
const STOPAJ_TL_UP_TO_6M = 17.5;
const STOPAJ_TL_UP_TO_1Y = 15;
const STOPAJ_TL_OVER_1Y = 10;

// TCMB politika faizi (bilgi amaçlı)
const TCMB_POLICY_RATE_PCT = 37;
const TCMB_POLICY_RATE_NOTE_DATE = "2026-01-22";

function clampNonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * TR sayı parse:
 * - "500.000" => 500000
 * - "42,5" => 42.5
 * - "42.5" => 42.5 (destekliyoruz ama faiz inputunda bunu otomatik virgüle çevireceğiz)
 */
function parseTrNumber(input: string): number {
  const raw = (input ?? "").toString().trim();
  if (!raw) return 0;

  let s = raw.replace(/\s+/g, "");

  // Hem . hem , varsa: . binlik, , ondalık varsay
  if (s.includes(".") && s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    // sadece virgül varsa ondalık
    s = s.replace(",", ".");
  } else {
    // sadece nokta varsa: ondalık olabilir (42.5) ya da binlik (500.000)
    // burada güvenli şekilde: birden fazla nokta varsa binlik say
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount >= 2) s = s.replace(/\./g, "");
    // tek nokta varsa olduğu gibi bırak (42.5)
  }

  s = s.replace(/[^0-9.]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// Anapara: sadece rakam topla, TR formatla (1000000 -> 1.000.000)
// Ayrıca kullanıcı virgül basarsa (,) görmezden gel (biz otomatik nokta koyuyoruz)
function formatThousandsTR(input: string): string {
  let s = (input ?? "").toString();

  // Kullanıcı virgül basarsa boşver (binlik ayırıcıyı biz koyacağız)
  s = s.replace(/,/g, "");

  const digitsOnly = s.replace(/\D+/g, "");
  if (!digitsOnly) return "";

  const n = parseInt(digitsOnly, 10);
  if (!Number.isFinite(n)) return "";

  return new Intl.NumberFormat("tr-TR").format(n);
}

// Gün: sadece rakam
function digitsOnly(text: string): string {
  return (text ?? "").replace(/\D+/g, "");
}

/**
 * Faiz inputu:
 * - Nokta (.) basarsa otomatik virgül (,) yapsın
 * - Sadece rakam + virgül kalsın
 * - 1 tane virgül olsun
 * - ",5" -> "0,5"
 */
function formatRateTR(input: string): string {
  let s = (input ?? "").toString();

  // Noktayı virgüle çevir
  s = s.replace(/\./g, ",");

  // Sadece rakam ve virgül
  s = s.replace(/[^0-9,]/g, "");

  // Tek virgül
  const firstCommaIndex = s.indexOf(",");
  if (firstCommaIndex !== -1) {
    const before = s.slice(0, firstCommaIndex + 1);
    const after = s.slice(firstCommaIndex + 1).replace(/,/g, "");
    s = before + after;
  }

  if (s.startsWith(",")) s = "0" + s;

  return s;
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

function formatTL(n: number): string {
  const rounded = Math.round(Number.isFinite(n) ? n : 0);
  return new Intl.NumberFormat("tr-TR").format(rounded);
}

export default function App() {
  const [principalText, setPrincipalText] = useState("500.000");

  // Örnek: 42,5 ile başlasın
  const [rateText, setRateText] = useState("42,5");

  const [selectedDays, setSelectedDays] = useState<32 | 92 | 180 | "custom">(32);
  const [customDaysText, setCustomDaysText] = useState("32");

  // Net sonuçlar sadece "Neti Hesapla" ile güncellenir
  const [result, setResult] = useState(() =>
    calcNetDeposit({
      principal: 500000,
      annualRatePct: 42.5,
      days: 32,
    })
  );

  const daysValue = useMemo(() => {
    if (selectedDays === "custom") {
      const d = parseInt(digitsOnly(customDaysText), 10);
      return Number.isFinite(d) && d > 0 ? d : 0;
    }
    return selectedDays;
  }, [selectedDays, customDaysText]);

  // Stopaj yazısı vade değişince anında güncellensin
  const stopajPreviewPct = useMemo(() => {
    const d = daysValue > 0 ? daysValue : 32;
    return getStopajPctForTlDepositDays(d);
  }, [daysValue]);

  const onCalculate = () => {
    const principal = parseTrNumber(principalText);
    const annualRatePct = parseTrNumber(rateText); // "42,5" -> 42.5
    const days = daysValue;

    const res = calcNetDeposit({ principal, annualRatePct, days });
    setResult(res);
  };

  const netPrefix = result.net > 0 ? "+ " : "";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.androidTopPad} />

      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit>
            Net TL Mevduat
          </Text>
          <Text style={styles.subtitle}>Elinize Geçecek Net TL</Text>

          <Text style={styles.exampleNote}>
            Örnek değerler doludur. Değiştirip hesaplayın.
          </Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Anapara (TL)</Text>
              <TextInput
                value={principalText}
                onChangeText={(t) => setPrincipalText(formatThousandsTR(t))}
                keyboardType="numeric"
                placeholder="Örnek: 100.000"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Faiz Oranı (%)</Text>
              <TextInput
                value={rateText}
                onChangeText={(t) => setRateText(formatRateTR(t))}
                keyboardType="numeric"
                placeholder="Örnek: 42,5"
                style={styles.input}
              />
              <Text style={styles.smallHint}>
                Ondalık için virgül kullanın (ör. 37,5). Nokta yazarsanız otomatik virgüle çevrilir.
              </Text>
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
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>
                        {d}
                      </Text>
                    </Pressable>
                  );
                })}

                <Pressable
                  onPress={() => setSelectedDays("custom")}
                  style={[styles.pill, selectedDays === "custom" && styles.pillActive]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      selectedDays === "custom" && styles.pillTextActive,
                    ]}
                  >
                    Özel
                  </Text>
                </Pressable>
              </View>

              {selectedDays === "custom" && (
                <TextInput
                  value={customDaysText}
                  onChangeText={(t) => setCustomDaysText(digitsOnly(t))}
                  keyboardType="numeric"
                  placeholder="Gün girin (ör. 400)"
                  style={[styles.input, { marginTop: 10 }]}
                />
              )}

              <Text style={styles.infoText}>
                Stopaj (TL mevduat, vade bazlı): %{stopajPreviewPct} — Vade: {daysValue || 32} gün — Güncelleme:{" "}
                {INFO_LAST_UPDATED}
              </Text>

              <Text style={styles.infoText}>
                TCMB politika faizi (bilgi): %{TCMB_POLICY_RATE_PCT} — Not tarihi:{" "}
                {TCMB_POLICY_RATE_NOTE_DATE}
              </Text>

              <Text style={styles.infoText}>
                Net sonuçlar “Neti Hesapla” ile güncellenir.
              </Text>
            </View>

            <Pressable onPress={onCalculate} style={styles.button}>
              <Text style={styles.buttonText}>Neti Hesapla</Text>
            </Pressable>
          </View>

          <View style={styles.resultWrap}>
            <Text style={styles.netValue}>
              {netPrefix}
              {formatTL(result.net)} TL
            </Text>
            <Text style={styles.netLabel}>Net Kazanç</Text>

            <View style={styles.breakdown}>
              <Text style={styles.breakRow}>
                Brüt getiri: {formatTL(result.gross)} TL
              </Text>
              <Text style={styles.breakRow}>
                Stopaj kesintisi: {formatTL(result.withholding)} TL
              </Text>
              <Text style={styles.breakRow}>
                Efektif yıllık (EAY): {result.eay.toFixed(1)}%
              </Text>
            </View>

            <Text style={styles.disclaimer}>
              Bu uygulamadaki oranlar bilgilendirme amaçlıdır. Resmi kaynaklar esas alınmalıdır.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  androidTopPad: {
    height: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
  },

  container: { padding: 18, paddingBottom: 28 },

  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  subtitle: { marginTop: 4, fontSize: 14, color: "#6B7280", textAlign: "center" },

  exampleNote: {
    marginTop: 10,
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },

  form: { marginTop: 18, gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 13, color: "#374151", fontWeight: "700" },

  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FAFAFA",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#111827",
  },

  smallHint: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
  },

  pills: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  pillActive: { borderColor: "#111827" },
  pillText: { color: "#374151", fontWeight: "700" },
  pillTextActive: { color: "#111827" },

  infoText: {
    marginTop: 8,
    fontSize: 12,
    color: "#1E3A8A",
    textAlign: "center",
  },

  button: {
    marginTop: 4,
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },

  resultWrap: { marginTop: 22, alignItems: "center" },
  netValue: { fontSize: 40, fontWeight: "900", color: "#166534" },
  netLabel: { marginTop: 2, fontSize: 14, color: "#6B7280" },

  breakdown: { marginTop: 14, alignSelf: "stretch", gap: 6 },
  breakRow: { fontSize: 13, color: "#374151", textAlign: "center" },

  disclaimer: {
    marginTop: 14,
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
  },
});