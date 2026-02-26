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
  LayoutChangeEvent,
} from "react-native";

/**
 * ---- AYARLAR (manuel güncellenebilir) ----
 * Bu değerler bilgilendirme amaçlıdır.
 */
const MARKET_RANGES_LAST_UPDATED = "26 Şubat 2026";
const MARKET_RANGES: Array<{ days: 32 | 92 | 180; min: number; max: number }> = [
  { days: 32, min: 38, max: 51 },
  { days: 92, min: 37, max: 45 },
  { days: 180, min: 35, max: 43 },
];

// Stopaj (TL mevduat) — bilgilendirme amaçlı, gerektiğinde manuel güncelle
const STOPAJ_TL_UP_TO_6M = 17.5; // <=180 gün
const STOPAJ_TL_UP_TO_1Y = 15; // 181-365 gün
const STOPAJ_TL_OVER_1Y = 10; // >365 gün

const TCMB_POLICY_RATE_PCT = 37;
const TCMB_POLICY_RATE_DECISION_DATE = "22 Ocak 2026";
const TCMB_NEXT_MPC_MEETING_DATE = "12 Mart 2026";

// Varsayılan örnekler
const DEFAULT_PRINCIPAL = 500000;
const DEFAULT_RATE = 42.5;
const DEFAULT_DAYS = 32;

// SEO
const SEO_TITLE = "Net Mevduat – TL Vadeli Mevduat Net Getiri Hesaplama";
const SEO_DESCRIPTION =
  "TL vadeli mevduat net getiri hesaplama aracı. Stopaj dahil net kazancınızı hızlı ve sade şekilde hesaplayın. 32/92/180 gün için piyasa aralığı bilgilendirmesi içerir.";

type CalcResult = {
  gross: number;
  withholding: number;
  net: number;
  eay: number;
  stopajPctUsed: number;
};

function clampNonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatTLInt(n: number): string {
  const rounded = Math.round(Number.isFinite(n) ? n : 0);
  return new Intl.NumberFormat("tr-TR").format(rounded);
}

function parsePrincipalInt(input: string): number {
  const digits = (input ?? "").toString().replace(/\D+/g, "");
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

// anapara input: sadece rakam, görüntüde binlik ayırıcı
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

// faiz input: '.' -> ','; tek virgül izinli
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

function calcNetDeposit(params: { principal: number; annualRatePct: number; days: number }): CalcResult {
  const P = clampNonNegative(params.principal);
  const r = clampNonNegative(params.annualRatePct) / 100;
  const d = Math.max(1, Math.floor(clampNonNegative(params.days)));

  const stopajPctUsed = getStopajPctForTlDepositDays(d);
  const s = stopajPctUsed / 100;

  // basit faiz varsayımı
  const gross = P * r * (d / 365);
  const withholding = gross * s;
  const net = gross - withholding;

  const eay = P > 0 ? (net / P) * (365 / d) * 100 : 0;

  return { gross, withholding, net, eay, stopajPctUsed };
}

function getMarketBucket(days: number): 32 | 92 | 180 | null {
  const d = Math.max(1, Math.floor(clampNonNegative(days)));
  if (d <= 32) return 32;
  if (d <= 92) return 92;
  if (d <= 180) return 180;
  return null;
}

async function copyToClipboard(text: string) {
  const nav: any = typeof navigator !== "undefined" ? navigator : null;

  if (nav?.clipboard?.writeText) {
    await nav.clipboard.writeText(text);
    return;
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  } catch {
    // sessiz
  }
}

export default function App() {
  // Theme toggle (default: dark)
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const isDark = theme === "dark";
  const t = isDark ? dark : light;

  // Inputs
  const [principalText, setPrincipalText] = useState(() => formatTLInt(DEFAULT_PRINCIPAL));
  const [rateText, setRateText] = useState(() => DEFAULT_RATE.toString().replace(".", ","));
  const [selectedDays, setSelectedDays] = useState<32 | 92 | 180 | "custom">(DEFAULT_DAYS);
  const [customDaysText, setCustomDaysText] = useState(() => String(DEFAULT_DAYS));

  // UX
  const [copied, setCopied] = useState(false);

  // SEO (web)
  useEffect(() => {
    if (typeof document === "undefined") return;

    document.title = SEO_TITLE;

    const existing = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (existing) existing.setAttribute("content", SEO_DESCRIPTION);
    else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = SEO_DESCRIPTION;
      document.head.appendChild(meta);
    }
  }, []);

  const principalNumber = useMemo(() => parsePrincipalInt(principalText), [principalText]);
  const rateNumber = useMemo(() => parseRateNumber(rateText), [rateText]);

  const daysValue = useMemo(() => {
    if (selectedDays === "custom") {
      const d = parseInt(digitsOnly(customDaysText), 10);
      return Number.isFinite(d) && d > 0 ? d : 0;
    }
    return selectedDays;
  }, [selectedDays, customDaysText]);

  const effectiveDays = daysValue > 0 ? daysValue : DEFAULT_DAYS;

  const result = useMemo(() => {
    return calcNetDeposit({ principal: principalNumber, annualRatePct: rateNumber, days: effectiveDays });
  }, [principalNumber, rateNumber, effectiveDays]);

  const marketBucket = useMemo(() => getMarketBucket(effectiveDays), [effectiveDays]);

  const canCalculate = principalNumber > 0 && rateNumber > 0;

  // Premium micro animation for net card
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseKey = useMemo(() => `${principalText}|${rateText}|${effectiveDays}|${theme}`, [
    principalText,
    rateText,
    effectiveDays,
    theme,
  ]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(pulse, { toValue: 0.985, duration: 90, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [pulseKey, pulse]);

  async function onCopy() {
    if (!canCalculate) return;

    const text =
      `Net kazanç: ${formatTLInt(result.net)} TL\n` +
      `Anapara: ${formatTLInt(principalNumber)} TL\n` +
      `Faiz: %${rateText}\n` +
      `Vade: ${effectiveDays} gün\n` +
      `Stopaj: %${result.stopajPctUsed}`;

    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  }

  // ---- Scroll navigation (Landing menü + CTA) ----
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<{ calc?: number; market?: number; info?: number; seo?: number }>({});

  const onSectionLayout =
    (key: keyof typeof sectionY.current) =>
    (e: LayoutChangeEvent) => {
      sectionY.current[key] = e.nativeEvent.layout.y;
    };

  const scrollToKey = (key: keyof typeof sectionY.current) => {
    const y = sectionY.current[key];
    if (typeof y !== "number") return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 10), animated: true });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
      <View style={{ height: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0 }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.container, { backgroundColor: t.bg }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* ====== HERO / LANDING HEADER ====== */}
          <View style={[styles.hero, { borderColor: t.border }]}>
            {/* Subtle glow background */}
            <View style={[styles.heroGlow, { backgroundColor: isDark ? "rgba(64,247,178,0.10)" : "rgba(11,143,90,0.10)" }]} />
            <View style={[styles.heroGlow2, { backgroundColor: isDark ? "rgba(64,247,178,0.06)" : "rgba(11,143,90,0.06)" }]} />

            {/* Top bar */}
            <View style={styles.topBar}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.brand, { color: t.text }]}>Net Mevduat</Text>
                <Text style={[styles.tagline, { color: t.muted }]}>TL vadeli mevduat net getiri hesaplama</Text>
              </View>

              <Pressable
                onPress={() => setTheme((p) => (p === "dark" ? "light" : "dark"))}
                style={[styles.themeBtn, { backgroundColor: t.card, borderColor: t.border }]}
              >
                <Text style={{ color: t.text, fontWeight: "900" }}>{isDark ? "🌙" : "☀️"}</Text>
              </Pressable>
            </View>

            {/* Mini menu */}
            <View style={[styles.menuRow, { borderColor: t.border }]}>
              <Pressable onPress={() => scrollToKey("calc")} style={[styles.menuBtn, { backgroundColor: t.menuBg, borderColor: t.border }]}>
                <Text style={[styles.menuText, { color: t.text }]}>Hesapla</Text>
              </Pressable>
              <Pressable onPress={() => scrollToKey("market")} style={[styles.menuBtn, { backgroundColor: t.menuBg, borderColor: t.border }]}>
                <Text style={[styles.menuText, { color: t.text }]}>Piyasa</Text>
              </Pressable>
              <Pressable onPress={() => scrollToKey("info")} style={[styles.menuBtn, { backgroundColor: t.menuBg, borderColor: t.border }]}>
                <Text style={[styles.menuText, { color: t.text }]}>Bilgi</Text>
              </Pressable>
            </View>

            {/* Hero Net Card */}
            <Animated.View
              style={[
                styles.heroNetCard,
                { backgroundColor: t.netBg, borderColor: t.netBorder, transform: [{ scale: pulse }] },
              ]}
            >
              <Pressable onPress={onCopy} disabled={!canCalculate} style={[styles.copyBtn, { borderColor: t.netBorder }]}>
                <Text style={{ color: canCalculate ? t.accent : t.placeholder, fontWeight: "900" }}>
                  {copied ? "✓" : "⧉"}
                </Text>
              </Pressable>

              <Text style={[styles.heroNetTitle, { color: t.muted }]}>Elinize geçecek net TL</Text>

              <Text style={[styles.netValue, { color: canCalculate ? t.accent : t.placeholder }]}>
                + {formatTLInt(canCalculate ? result.net : 0)} TL
              </Text>

              <View style={styles.metaRow}>
                <View style={[styles.metaPill, { backgroundColor: t.metaBg, borderColor: t.netBorder }]}>
                  <Text style={{ color: t.muted, fontWeight: "900", fontSize: 12 }}>Vade: {effectiveDays} gün</Text>
                </View>
                <View style={[styles.metaPill, { backgroundColor: t.metaBg, borderColor: t.netBorder }]}>
                  <Text style={{ color: t.muted, fontWeight: "900", fontSize: 12 }}>Stopaj: %{result.stopajPctUsed}</Text>
                </View>
              </View>

              <Text style={[styles.micro, { color: t.muted }]}>
                Bilgilendirme amaçlıdır. Sonuçlar girdiğiniz faiz oranına göre hesaplanır.
              </Text>
            </Animated.View>

            {/* CTA */}
            <View style={styles.ctaRow}>
              <Pressable
                onPress={() => scrollToKey("calc")}
                style={[
                  styles.ctaPrimary,
                  { backgroundColor: t.accent, borderColor: t.accentBorder },
                ]}
              >
                <Text style={[styles.ctaPrimaryText, { color: isDark ? "#062217" : "#FFFFFF" }]}>
                  Hemen Hesapla
                </Text>
              </Pressable>

              <Pressable
                onPress={() => scrollToKey("market")}
                style={[styles.ctaSecondary, { borderColor: t.border, backgroundColor: t.card }]}
              >
                <Text style={[styles.ctaSecondaryText, { color: t.text }]}>Piyasa Aralığı</Text>
              </Pressable>
            </View>
          </View>

          {/* ====== HESAPLAMA (section) ====== */}
          <View onLayout={onSectionLayout("calc")} />

          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Hesaplama</Text>
            <Text style={[styles.hint, { color: t.muted }]}>Örnek değerler dolu. Değiştirince otomatik hesaplar.</Text>

            <View style={{ marginTop: 14, gap: 12 }}>
              <View>
                <Text style={[styles.label, { color: t.muted }]}>Anapara (TL)</Text>
                <TextInput
                  value={principalText}
                  onChangeText={(v) => setPrincipalText(formatThousandsTR(v))}
                  keyboardType="numeric"
                  placeholder="Örn: 100.000"
                  placeholderTextColor={t.placeholder}
                  style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
                />
              </View>

              <View>
                <Text style={[styles.label, { color: t.muted }]}>Faiz Oranı (%)</Text>
                <TextInput
                  value={rateText}
                  onChangeText={(v) => setRateText(formatRateTR(v))}
                  keyboardType="numeric"
                  placeholder="Örn: 42,5"
                  placeholderTextColor={t.placeholder}
                  style={[styles.input, { backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
                />
                <Text style={[styles.micro, { color: t.muted }]}>Ondalık için virgül kullanın (örn: 37,5).</Text>
              </View>

              <View>
                <Text style={[styles.label, { color: t.muted }]}>Vade (Gün)</Text>

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
                        style={[
                          styles.pill,
                          {
                            backgroundColor: active ? t.pillActiveBg : t.pillBg,
                            borderColor: active ? t.accentBorder : t.border,
                          },
                        ]}
                      >
                        <Text style={{ color: active ? t.text : t.muted, fontWeight: "900" }}>{d}</Text>
                      </Pressable>
                    );
                  })}

                  <Pressable
                    onPress={() => setSelectedDays("custom")}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: selectedDays === "custom" ? t.pillActiveBg : t.pillBg,
                        borderColor: selectedDays === "custom" ? t.accentBorder : t.border,
                      },
                    ]}
                  >
                    <Text style={{ color: selectedDays === "custom" ? t.text : t.muted, fontWeight: "900" }}>Özel</Text>
                  </Pressable>
                </View>

                {selectedDays === "custom" && (
                  <TextInput
                    value={customDaysText}
                    onChangeText={(v) => setCustomDaysText(digitsOnly(v))}
                    keyboardType="numeric"
                    placeholder="Gün girin (ör. 35 / 400)"
                    placeholderTextColor={t.placeholder}
                    style={[styles.input, { marginTop: 10, backgroundColor: t.inputBg, borderColor: t.border, color: t.text }]}
                  />
                )}
              </View>
            </View>
          </View>

          {/* ====== DETAY ====== */}
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Detay</Text>
            <Text style={[styles.line, { color: t.muted }]}>Brüt getiri: {formatTLInt(result.gross)} TL</Text>
            <Text style={[styles.line, { color: t.muted }]}>Stopaj kesintisi: {formatTLInt(result.withholding)} TL</Text>
            <Text style={[styles.lineStrong, { color: t.text }]}>
              Vade: {effectiveDays} gün — Uygulanan stopaj: %{result.stopajPctUsed}
            </Text>
            <Text style={[styles.line, { color: t.muted }]}>Efektif yıllık (EAY): {result.eay.toFixed(1)}%</Text>
          </View>

          {/* ====== PİYASA ====== */}
          <View onLayout={onSectionLayout("market")} />
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
              <Text style={[styles.cardTitle, { color: t.text }]}>Piyasa Aralığı</Text>
              <Text style={[styles.micro, { color: t.muted }]}>Güncelleme: {MARKET_RANGES_LAST_UPDATED}</Text>
            </View>

            <Text style={[styles.micro, { color: t.muted, marginTop: 8 }]}>
              Seçili vade: <Text style={{ color: t.text, fontWeight: "900" }}>{effectiveDays} gün</Text>
            </Text>

            <View style={{ marginTop: 12, gap: 8 }}>
              {MARKET_RANGES.map((r) => {
                const active = marketBucket === r.days;
                return (
                  <View
                    key={r.days}
                    style={[
                      styles.rangeLine,
                      {
                        backgroundColor: active ? t.rangeActiveBg : t.rangeBg,
                        borderColor: active ? t.accentBorder : t.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? t.text : t.muted, fontWeight: "900" }}>
                      {r.days} gün: %{r.min} – %{r.max}
                    </Text>
                    {active ? <Text style={{ color: t.accent, fontWeight: "900", fontSize: 11 }}>Uygulanan bant</Text> : null}
                  </View>
                );
              })}
            </View>

            {marketBucket === null ? (
              <Text style={[styles.micro, { color: t.muted, marginTop: 12 }]}>
                180 gün üzeri vadelerde oranlar banka/kampanya/koşullara göre çok daha değişken olabilir. Bu bölüm sabit aralık yerine bilgilendirme amaçlıdır.
              </Text>
            ) : (
              <Text style={[styles.micro, { color: t.muted, marginTop: 12 }]}>
                Not: Bu aralık bilgilendirme amaçlıdır. Sonuçlar, sizin girdiğiniz faiz oranı üzerinden hesaplanır.
              </Text>
            )}
          </View>

          {/* ====== BİLGİ ====== */}
          <View onLayout={onSectionLayout("info")} />
          <View style={[styles.infoCard, { backgroundColor: t.infoBg, borderColor: t.infoBorder }]}>
            <Text style={{ color: t.text, fontWeight: "900", fontSize: 13 }}>TCMB Bilgisi</Text>
            <Text style={[styles.micro, { color: t.muted, marginTop: 6 }]}>
              Politika faizi: <Text style={{ color: t.text, fontWeight: "900" }}>%{TCMB_POLICY_RATE_PCT}</Text> (PPK karar:{" "}
              {TCMB_POLICY_RATE_DECISION_DATE})
            </Text>
            <Text style={[styles.micro, { color: t.muted, marginTop: 4 }]}>
              Sonraki PPK toplantısı: <Text style={{ color: t.text, fontWeight: "900" }}>{TCMB_NEXT_MPC_MEETING_DATE}</Text>
            </Text>

            <Text style={[styles.micro, { color: t.muted, marginTop: 10 }]}>
              Bu araç yatırım danışmanlığı değildir. Hesaplamalar bilgilendirme amaçlıdır; oranlar/stopaj/koşullar değişebilir. Nihai tutar ve koşullar için resmi kaynakları esas alın.
            </Text>
          </View>

          {/* ====== SEO İÇERİK ====== */}
          <View onLayout={onSectionLayout("seo")} />
          <View style={[styles.seoBlock, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.seoH2, { color: t.text }]}>Vadeli Mevduat Nedir?</Text>
            <Text style={[styles.seoP, { color: t.muted }]}>
              Vadeli mevduat, bankaya belirli bir süre için yatırılan paranın faiz getirisi elde etmesini sağlayan bir tasarruf ürünüdür.
              NetMevduat.net üzerinden brüt ve net faiz getirilerinizi stopaj kesintisi dahil hesaplayabilirsiniz.
            </Text>

            <Text style={[styles.seoH3, { color: t.text }]}>Stopaj Oranları Nasıl Hesaplanır?</Text>
            <Text style={[styles.seoP, { color: t.muted }]}>
              Türkiye’de vadeli mevduatta stopaj oranı vadeye göre değişebilir. Bu araç, seçtiğiniz vade gününe göre stopajı otomatik uygular ve net kazancı gösterir.
              Yine de nihai oranlar için resmi kaynakları kontrol etmeniz önerilir.
            </Text>

            <Text style={[styles.seoH3, { color: t.text }]}>Mevduat Net Getiri Hesaplama</Text>
            <Text style={[styles.seoP, { color: t.muted }]}>
              Anapara, faiz oranı ve vade gününü girerek brüt getiri, stopaj kesintisi ve net kazancı tek ekranda görebilirsiniz.
              32/92/180 gün için piyasa aralığı bölümü ise sadece bilgilendirme amaçlı referans sağlar.
            </Text>
          </View>

          <Text style={[styles.footer, { color: t.placeholder }]}>© NetMevduat — sade, hızlı, net.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  container: { padding: 18, paddingBottom: 34 },

  // HERO
  hero: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 999,
    top: -220,
    left: -180,
  },
  heroGlow2: {
    position: "absolute",
    width: 380,
    height: 380,
    borderRadius: 999,
    bottom: -220,
    right: -180,
  },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  brand: { fontSize: 26, fontWeight: "900" },
  tagline: { marginTop: 2, fontSize: 12, fontWeight: "800" },

  themeBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  menuRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  menuBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: { fontSize: 12, fontWeight: "900" },

  heroNetCard: {
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    position: "relative",
  },
  heroNetTitle: { fontSize: 12, fontWeight: "900" },

  // shared
  card: { marginTop: 14, borderRadius: 18, borderWidth: 1, padding: 14 },
  cardTitle: { fontSize: 14, fontWeight: "900" },
  hint: { marginTop: 6, fontSize: 12, fontWeight: "700" },

  label: { fontSize: 12, fontWeight: "900", marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, fontWeight: "800" },

  micro: { marginTop: 6, fontSize: 11, fontWeight: "700" },

  pills: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },

  copyBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  netValue: { fontSize: 42, fontWeight: "900", marginTop: 6 },

  metaRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap", justifyContent: "center" },
  metaPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },

  line: { marginTop: 8, fontSize: 13, fontWeight: "800", textAlign: "center" },
  lineStrong: { marginTop: 10, fontSize: 13, fontWeight: "900", textAlign: "center" },

  rangeLine: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  infoCard: { marginTop: 14, borderRadius: 18, borderWidth: 1, padding: 14 },

  seoBlock: { marginTop: 14, borderRadius: 18, borderWidth: 1, padding: 14 },
  seoH2: { fontSize: 18, fontWeight: "900", marginBottom: 8 },
  seoH3: { fontSize: 14, fontWeight: "900", marginTop: 12, marginBottom: 6 },
  seoP: { fontSize: 12, fontWeight: "700", lineHeight: 18 },

  footer: { marginTop: 16, textAlign: "center", fontSize: 11, fontWeight: "800" },

  ctaRow: { marginTop: 14, flexDirection: "row", gap: 10 },
  ctaPrimary: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  ctaPrimaryText: { fontSize: 13, fontWeight: "900" },
  ctaSecondary: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  ctaSecondaryText: { fontSize: 13, fontWeight: "900" },
});

// Premium themes
const dark = {
  bg: "#070A12",
  card: "#0B1020",
  text: "#EAF0FF",
  muted: "#A6B0CC",
  placeholder: "#66709A",
  border: "#1B2442",
  inputBg: "#0E1630",

  accent: "#40F7B2",
  accentBorder: "#1E6A56",

  netBg: "#071B14",
  netBorder: "#154A3B",
  metaBg: "rgba(64,247,178,0.06)",

  rangeBg: "#0B1020",
  rangeActiveBg: "rgba(64,247,178,0.08)",

  pillBg: "#0B1020",
  pillActiveBg: "rgba(234,240,255,0.05)",

  infoBg: "#0D1430",
  infoBorder: "#1B2442",

  menuBg: "rgba(255,255,255,0.03)",
};

const light = {
  bg: "#F7F8FB",
  card: "#FFFFFF",
  text: "#0B1220",
  muted: "#4A5879",
  placeholder: "#8A93AA",
  border: "#E4E8F2",
  inputBg: "#FFFFFF",

  accent: "#0B8F5A",
  accentBorder: "#9CE8CB",

  netBg: "#ECFDF5",
  netBorder: "#B7F1DA",
  metaBg: "#FFFFFF",

  rangeBg: "#F7F8FB",
  rangeActiveBg: "#ECFDF5",

  pillBg: "#FFFFFF",
  pillActiveBg: "#F1F5FF",

  infoBg: "#EEF2FF",
  infoBorder: "#D7DEFF",

  menuBg: "#FFFFFF",
};