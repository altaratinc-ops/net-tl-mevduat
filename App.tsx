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
  Modal,
  LayoutChangeEvent,
} from "react-native";

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

const DEFAULT_PRINCIPAL = 500000;
const DEFAULT_RATE = 42.5;
const DEFAULT_DAYS = 32;

const SEO_TITLE = "Net Mevduat – TL Vadeli Mevduat Net Getiri Hesaplama";
const SEO_DESCRIPTION =
  "TL vadeli mevduat net getiri hesaplama aracı. Stopaj dahil net kazancınızı hızlı ve sade şekilde hesaplayın. 32/92/180 gün için piyasa aralığı bilgilendirmesi içerir.";

// ✅ SEO (Domain)
const SEO_URL = "https://netmevduat.net/";
const SEO_IMAGE = "https://netmevduat.net/favicon.png"; // şimdilik yeterli (ileride 1200x630 og.png yaparız)

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
  // Nokta yazılırsa virgüle çevir
  s = s.replace(/\./g, ",");
  // Sadece rakam ve virgül
  s = s.replace(/[^0-9,]/g, "");

  // Tek virgül kalsın
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

function getMarketRangeByBucket(bucket: 32 | 92 | 180 | null) {
  if (!bucket) return null;
  return MARKET_RANGES.find((x) => x.days === bucket) ?? null;
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

function SlidePanelModal(props: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  theme: {
    bg: string;
    bgSoft: string;
    card: string;
    text: string;
    muted: string;
    border: string;
  };
}) {
  const { visible, onClose, title, subtitle, children, theme } = props;

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
      mass: 0.7,
    }).start();
  }, [visible, anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ width: "100%" }}>
          <Animated.View
            style={[
              styles.modalPanel,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                transform: [{ translateY }],
                opacity,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: "900", fontSize: 14 }}>{title}</Text>
                {subtitle ? (
                  <Text style={{ color: theme.muted, fontWeight: "800", fontSize: 11, marginTop: 4 }}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>

              <Pressable
                onPress={onClose}
                style={[styles.modalCloseBtn, { borderColor: theme.border, backgroundColor: theme.bgSoft }]}
              >
                <Text style={{ color: theme.text, fontWeight: "900" }}>✕</Text>
              </Pressable>
            </View>

            <View style={{ marginTop: 10 }}>{children}</View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function App() {
  // ✅ Sadece light tema (dark kaldırıldı)
  const t = light;

const scrollRef = useRef<ScrollView>(null as any);
  const netCardYRef = useRef<number>(0);
  const heroYRef = useRef<number>(0);

  const [principalText, setPrincipalText] = useState(() => formatTLInt(DEFAULT_PRINCIPAL));
  const [rateText, setRateText] = useState(() => DEFAULT_RATE.toString().replace(".", ","));
  const [selectedDays, setSelectedDays] = useState<32 | 92 | 180 | "custom">(DEFAULT_DAYS);
  const [customDaysText, setCustomDaysText] = useState(() => String(DEFAULT_DAYS));
  const [copied, setCopied] = useState(false);

  const [marketOpen, setMarketOpen] = useState(false);
  const [tcmbOpen, setTcmbOpen] = useState(false);
  const [stopajOpen, setStopajOpen] = useState(false);


  const openMarket = () => {
    setTcmbOpen(false);
    setMarketOpen(true);
  };
  const openStopaj = () => {
    setMarketOpen(false);
    setTcmbOpen(false);
    setStopajOpen(true);
  };

  const openTcmb = () => {
    setMarketOpen(false);
    setStopajOpen(false);
    setTcmbOpen(true);
  };
  const closeAll = () => {
    setMarketOpen(false);
    setStopajOpen(false);
    setTcmbOpen(false);
  };

  // ✅ SEO (Web) — canonical + meta tags (index.html yokken en iyi yöntem)
  useEffect(() => {
    if (typeof document === "undefined") return;

    document.title = SEO_TITLE;

    const upsertMeta = (selector: string, attrs: Record<string, string>) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        document.head.appendChild(el);
      }
      Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
    };

    const upsertLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        document.head.appendChild(el);
      }
      el.setAttribute("href", href);
    };

    // canonical
    upsertLink("canonical", SEO_URL);

    // description
    upsertMeta('meta[name="description"]', { name: "description", content: SEO_DESCRIPTION });

    // OpenGraph
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: SEO_TITLE });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: SEO_DESCRIPTION });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: SEO_URL });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: SEO_IMAGE });

    // Twitter
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary" });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: SEO_TITLE });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: SEO_DESCRIPTION });
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: SEO_IMAGE });

    // robots
    upsertMeta('meta[name="robots"]', { name: "robots", content: "index,follow" });
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

  const canCalculate = principalNumber > 0 && rateNumber > 0;

  // pulse
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseKey = useMemo(() => `${principalText}|${rateText}|${effectiveDays}`, [
    principalText,
    rateText,
    effectiveDays,
  ]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(pulse, { toValue: 0.985, duration: 90, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [pulseKey, pulse]);

  // flash
  const ctaFlash = useRef(new Animated.Value(0)).current;
  const flashNetCard = () => {
    Animated.sequence([
      Animated.timing(ctaFlash, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(ctaFlash, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  };
  const flashOpacity = ctaFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

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

  const marketBucket = useMemo(() => getMarketBucket(effectiveDays), [effectiveDays]);
  const range = useMemo(() => getMarketRangeByBucket(marketBucket), [marketBucket]);

  const miniMarketText = useMemo(() => {
    if (marketBucket === null) return "Piyasa: 180+ gün için sabit aralık yok (banka/kampanya değişken).";
    if (!range) return "Piyasa: bilgi bulunamadı.";
    return `Piyasa (${marketBucket} gün): %${range.min} – %${range.max} (bilgilendirme)`;
  }, [marketBucket, range]);

  const selectedChipText = useMemo(() => {
    if (marketBucket === null) return `📌 Seçili vade: ${effectiveDays} gün (180+ → aralık değişken)`;
    if (!range) return `📌 Seçili vade: ${effectiveDays} gün`;
    return `📌 Seçili vade: ${effectiveDays} gün → Piyasa bant: %${range.min}–%${range.max}`;
  }, [marketBucket, range, effectiveDays]);

  const onHeroLayout = (e: LayoutChangeEvent) => {
    heroYRef.current = e.nativeEvent.layout.y;
  };

  const onNetCardLayout = (e: LayoutChangeEvent) => {
    netCardYRef.current = e.nativeEvent.layout.y;
  };

  const scrollToY = (y: number) => {
    const targetY = Math.max(0, Math.floor(y));
    const anyRef: any = scrollRef.current as any;

    if (anyRef?.scrollTo) {
      anyRef.scrollTo({ y: targetY, animated: true });
      return;
    }
    if (anyRef?.getScrollResponder) {
      try {
        anyRef.getScrollResponder()?.scrollTo?.({ y: targetY, animated: true });
        return;
      } catch {}
    }

    // Web fallback (scroll the page)
    if (typeof window !== "undefined" && (window as any)?.scrollTo) {
      try {
        (window as any).scrollTo({ top: targetY, behavior: "smooth" });
      } catch {
        (window as any).scrollTo(0, targetY);
      }
    }
  };

  const scrollToNetCard = () => {
    // ✅ En stabil yöntem: onLayout ile aldığımız Y'ye scroll
    // (RN Web dahil) bazen ilk denemede state/render yüzünden kaçırabiliyor,
    // bu yüzden 2 frame + küçük timeout ile garanti ediyoruz.
    const calcY = () => Math.max(0, (heroYRef.current ?? 0) + (netCardYRef.current ?? 0) - 16);

    const doScroll = () => {
      const y = calcY();
      const anyRef: any = scrollRef.current as any;

      if (anyRef?.scrollTo) {
        anyRef.scrollTo({ y, animated: true });
      } else if (anyRef?.getScrollResponder) {
        try {
          anyRef.getScrollResponder()?.scrollTo?.({ y, animated: true });
        } catch {}
      }

      // Web fallback (sayfa scroll)
      if (typeof window !== "undefined" && (window as any)?.scrollTo) {
        try {
          (window as any).scrollTo({ top: y, behavior: "smooth" });
        } catch {
          (window as any).scrollTo(0, y);
        }
      }
    };

    requestAnimationFrame(() => {
      doScroll();
      requestAnimationFrame(() => {
        doScroll();
        setTimeout(doScroll, 60);
      });
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
      <View style={{ height: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0 }} />

      {/* Piyasa Modal */}
      <SlidePanelModal
        visible={marketOpen}
        onClose={closeAll}
        title="Piyasa"
        subtitle={`Güncelleme: ${MARKET_RANGES_LAST_UPDATED}`}
        theme={t}
      >
        <View style={[styles.chip, { borderColor: t.border, backgroundColor: t.bgSoft }]}>
          <Text style={{ color: t.text, fontWeight: "900", fontSize: 12 }}>{selectedChipText}</Text>
        </View>

        <View style={{ gap: 8, marginTop: 10 }}>
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
                  📈 {r.days} gün: %{r.min} – %{r.max}
                </Text>
                {active ? <Text style={{ color: t.accent, fontWeight: "900", fontSize: 11 }}>Seçili</Text> : null}
              </View>
            );
          })}
        </View>

        <Text style={[styles.micro, { color: t.muted, marginTop: 10 }]}>
          🛈{" "}
          {marketBucket === null
            ? "180 gün üzeri vadelerde oranlar banka/kampanya/koşullara göre daha değişken olabilir. Bu panel bilgilendirme amaçlıdır."
            : "Bu aralık bilgilendirme amaçlıdır. Sonuçlar sizin girdiğiniz faiz oranı üzerinden hesaplanır."}
        </Text>
      </SlidePanelModal>

            {/* Stopaj Modal */}
      <SlidePanelModal
        visible={stopajOpen}
        onClose={closeAll}
        title="Stopaj Oranları"
        subtitle="TL vadeli mevduat için (bilgilendirme)"
        theme={t}
      >
        <View style={[styles.tcmbBox, { borderColor: t.border, backgroundColor: t.bgSoft }]}>
          <Text style={[styles.micro, { color: t.muted }]}>
            ≤ 180 gün: <Text style={{ color: t.text, fontWeight: "900" }}>%{STOPAJ_TL_UP_TO_6M}</Text>
          </Text>
          <Text style={[styles.micro, { color: t.muted, marginTop: 6 }]}>
            181–365 gün: <Text style={{ color: t.text, fontWeight: "900" }}>%{STOPAJ_TL_UP_TO_1Y}</Text>
          </Text>
          <Text style={[styles.micro, { color: t.muted, marginTop: 6 }]}>
            365+ gün: <Text style={{ color: t.text, fontWeight: "900" }}>%{STOPAJ_TL_OVER_1Y}</Text>
          </Text>
        </View>
        <Text style={[styles.micro, { color: t.muted, marginTop: 10 }]}>
          Not: Stopaj oranları zaman içinde değişebilir. Bu ekran bilgilendirme amaçlıdır.
        </Text>
      </SlidePanelModal>

{/* TCMB Modal */}
      <SlidePanelModal
        visible={tcmbOpen}
        onClose={closeAll}
        title="Faiz Kararı"
        subtitle="TCMB politika faizi ve toplantı tarihleri"
        theme={t}
      >
        <View style={[styles.tcmbBox, { borderColor: t.border, backgroundColor: t.bgSoft }]}>
          <Text style={[styles.micro, { color: t.muted }]}>
            Politika faizi: <Text style={{ color: t.text, fontWeight: "900" }}>%{TCMB_POLICY_RATE_PCT}</Text>
          </Text>
          <Text style={[styles.micro, { color: t.muted, marginTop: 6 }]}>
            PPK karar tarihi: <Text style={{ color: t.text, fontWeight: "900" }}>{TCMB_POLICY_RATE_DECISION_DATE}</Text>
          </Text>
          <Text style={[styles.micro, { color: t.muted, marginTop: 6 }]}>
            Sonraki PPK: <Text style={{ color: t.text, fontWeight: "900" }}>{TCMB_NEXT_MPC_MEETING_DATE}</Text>
          </Text>
        </View>

        <Text style={[styles.micro, { color: t.muted, marginTop: 10 }]}>
          Bu araç yatırım danışmanlığı değildir. Hesaplamalar bilgilendirme amaçlıdır; oranlar/stopaj/koşullar değişebilir.
          Nihai tutar ve koşullar için resmi kaynakları esas alın.
        </Text>
      </SlidePanelModal>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.container, { backgroundColor: t.bg }]}
          keyboardShouldPersistTaps="handled"
        >
          <View onLayout={onHeroLayout} style={[styles.hero, { borderColor: t.border }]}>
            {/* glowlar: arka plan */}
            <View
              pointerEvents="none"
              style={[
                styles.heroGlow,
                {
                  backgroundColor: "rgba(11,143,90,0.10)",
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.heroGlow2,
                {
                  backgroundColor: "rgba(11,143,90,0.06)",
                },
              ]}
            />

            <View style={styles.topBar}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.brand, { color: t.text }]}>Net Mevduat</Text>
                <Text style={[styles.tagline, { color: t.muted }]}>TL vadeli mevduat net getiri hesaplama</Text>
              </View></View>

            {/* Üst menü: Piyasa + Faiz Kararı */}
            <View style={[styles.menuRow, { borderColor: t.border }]}>
              <Pressable
                onPress={() => (marketOpen ? closeAll() : openMarket())}
                style={[styles.menuBtn, { backgroundColor: t.menuBg, borderColor: t.border }]}
              >
                <Text style={[styles.menuText, { color: t.text }]}>Piyasa</Text>
              </Pressable>

              <Pressable
                onPress={() => (stopajOpen ? closeAll() : openStopaj())}
                style={[styles.menuBtn, { backgroundColor: t.menuBg, borderColor: t.border }]}
              >
                <Text style={[styles.menuText, { color: t.text }]}>Stopaj</Text>
              </Pressable>

              <Pressable
                onPress={() => (tcmbOpen ? closeAll() : openTcmb())}
                style={[styles.menuBtn, { backgroundColor: t.menuBg, borderColor: t.border }]}
              >
                <Text style={[styles.menuText, { color: t.text }]}>Faiz Kararı</Text>
              </Pressable>
            </View>

            <Animated.View
              onLayout={onNetCardLayout}
              style={[
                styles.netCard,
                { backgroundColor: t.netBg, borderColor: t.netBorder, transform: [{ scale: pulse }] },
              ]}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    borderRadius: 20,
                    opacity: flashOpacity,
                    backgroundColor: "rgba(11,143,90,0.10)",
                  },
                ]}
              />

              <Pressable onPress={onCopy} disabled={!canCalculate} style={[styles.copyBtn, { borderColor: t.netBorder }]}>
                <Text style={{ color: canCalculate ? t.accent : t.placeholder, fontWeight: "900" }}>
                  {copied ? "✓" : "⧉"}
                </Text>
              </Pressable>

              <Text style={[styles.netTitle, { color: t.muted }]}>Elinize geçecek net TL</Text>
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

              <View style={[styles.miniInfoRow, { borderColor: t.netBorder }]}>
                <Text style={[styles.miniInfoText, { color: t.muted }]} numberOfLines={2}>
                  {miniMarketText}
                </Text>
                <Pressable onPress={openMarket} style={[styles.miniInfoBtn, { borderColor: t.netBorder }]}>
                  <Text style={{ color: t.accent, fontWeight: "900", fontSize: 12 }}>Aç</Text>
                </Pressable>
              </View>

              <Text style={[styles.micro, { color: t.muted }]}>
                Bilgilendirme amaçlıdır. Sonuçlar girdiğiniz faiz oranına göre hesaplanır.
              </Text>
            </Animated.View>

            {/* Küçük Detay */}
            <View style={[styles.compactDetail, { backgroundColor: t.card, borderColor: t.border }]}>
              <View style={styles.compactRow}>
                <View style={styles.compactItem}>
                  <Text style={[styles.compactLabel, { color: t.muted }]}>Brüt</Text>
                  <Text style={[styles.compactValue, { color: t.text }]}>{formatTLInt(result.gross)} TL</Text>
                </View>

                <View style={[styles.compactDivider, { backgroundColor: t.border }]} />

                <View style={styles.compactItem}>
                  <Text style={[styles.compactLabel, { color: t.muted }]}>Stopaj</Text>
                  <Text style={[styles.compactValue, { color: t.text }]}>{formatTLInt(result.withholding)} TL</Text>
                </View>

                <View style={[styles.compactDivider, { backgroundColor: t.border }]} />

                <View style={styles.compactItem}>
                  <Text style={[styles.compactLabel, { color: t.muted }]}>EAY</Text>
                  <Text style={[styles.compactValue, { color: t.text }]}>{result.eay.toFixed(1)}%</Text>
                </View>
              </View>
              <Text style={[styles.micro, { color: t.muted, marginTop: 8 }]}>
                Vade: {effectiveDays} gün — Uygulanan stopaj: %{result.stopajPctUsed}
              </Text>
            </View>

            {/* Inputs */}
            <View style={[styles.heroInputs, { backgroundColor: t.card, borderColor: t.border }]}>
              <View style={{ gap: 10 }}>
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
                  <Text style={[styles.micro, { color: t.muted }]}>Ondalık için virgül (örn: 37,5).</Text>
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
                      style={[
                        styles.input,
                        { marginTop: 10, backgroundColor: t.inputBg, borderColor: t.border, color: t.text },
                      ]}
                    />
                  )}
                </View>
              </View>

              {/* CTA: Hemen Hesapla → Net karta götür */}
              <View style={{ marginTop: 12 }}>
                <Pressable
                  onPress={() => {
                    closeAll();
                    flashNetCard();
                    scrollToNetCard();
                  }}
                  style={[styles.ctaPrimary, { backgroundColor: t.accent, borderColor: t.accentBorder }]}
                >
                  <Text style={[styles.ctaPrimaryText, { color: "#FFFFFF" }]}>Hemen Hesapla</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* SEO */}
   {/* SEO */}
<View style={[styles.seoBlock, { backgroundColor: t.card, borderColor: t.border }]}>
  <Text style={[styles.seoH2, { color: t.text }]}>
    2026 Güncel Vadeli Mevduat Net Getiri Hesaplama Rehberi (Stopaj Dahil)
  </Text>

  <Text style={[styles.seoP, { color: t.muted }]}>
    Vadeli mevduat, paranızı bankaya belirli bir süreyle (vade) bağlayarak faiz geliri elde etmenizi sağlayan
    tasarruf ürünüdür. “Mevduat hesaplama” denince çoğu kişi sadece faiz oranına bakar; oysa gerçek kazanç,
    brüt faizden sonra kesilen stopaj ve vade gün sayısı gibi detaylarla netleşir. NetMevduat.net, anapara,
    faiz oranı ve vade gününü girerek brüt kazancı, stopaj kesintisini ve elinize geçecek net getiriyi saniyeler
    içinde gösterir. Böylece bankalar arasında karşılaştırma yaparken “kağıt üstünde iyi duran” oranlarla
    “gerçekte cebinize giren” net tutar arasındaki farkı net şekilde görürsünüz.
  </Text>

  <Text style={[styles.seoH3, { color: t.text }]}>Mevduat Net Getiri Nedir?</Text>
  <Text style={[styles.seoP, { color: t.muted }]}>
    Net getiri; brüt faiz tutarından stopaj (vergi) kesintisi çıkarıldıktan sonra yatırımcının eline geçen gerçek
    kazançtır. Örneğin yıllık %40 faiz oranı yüksek gibi görünse de, stopaj kesintisi sonrasında net kazanç bir miktar
    düşer. Ayrıca vade gününüz (32 gün mü, 92 gün mü, 180 gün mü?) net sonucu ciddi etkiler. Bu yüzden mevduat
    getirisi değerlendirirken sadece “yıllık faiz” değil, “net kazanç” üzerinden konuşmak en doğru yaklaşımdır.
  </Text>

  <Text style={[styles.seoH3, { color: t.text }]}>Stopaj Dahil Mevduat Hesaplama Neden Önemlidir?</Text>
  <Text style={[styles.seoP, { color: t.muted }]}>
    Türkiye’de TL vadeli mevduatta stopaj oranları vade süresine göre değişebilir. Kısa vadeli mevduatta uygulanan
    oran ile daha uzun vadelerde uygulanan oran farklı olabildiği için, brüt faiz hesabı çoğu zaman yanıltıcı olur.
    NetMevduat.net, vade gün sayınıza göre stopajı otomatik uygular ve “brüt” ile “net” farkını açıkça gösterir.
    Böylece “aynı faiz oranıyla” bile vadeye göre net kazancın nasıl değiştiğini hızlıca görüp karar verebilirsiniz.
  </Text>

  <Text style={[styles.seoH3, { color: t.text }]}>Mevduat Faizi Nasıl Hesaplanır?</Text>
  <Text style={[styles.seoP, { color: t.muted }]}>
    Mevduat faiz hesaplaması temel olarak üç değişkene dayanır: anapara, yıllık faiz oranı ve vade (gün).
    Basit yaklaşımda brüt faiz, anapara × yıllık faiz × (gün/365) mantığıyla hesaplanır. Sonrasında stopaj kesintisi
    uygulanır ve net kazanç bulunur. NetMevduat.net bu hesabı otomatik yapar; ayrıca brüt tutarı ve stopajı ayrı ayrı
    göstererek şeffaf bir karşılaştırma sağlar. Böylece “hesaplama doğru mu?” şüphesi yaşamadan sonucu net şekilde
    takip edersiniz.
  </Text>

  <Text style={[styles.seoH3, { color: t.text }]}>32 Gün, 92 Gün ve 180 Gün Vadeli Mevduat Karşılaştırması</Text>
  <Text style={[styles.seoP, { color: t.muted }]}>
    Türkiye’de en yaygın vadelerden bazıları 32 gün, 92 gün ve 180 gündür. 32 gün vade genellikle daha esnek olduğu için
    tercih edilir; 92 ve 180 gün vadelerde ise dönemsel kampanyalarla farklı oranlar görülebilir. Ancak hangi vadenin
    daha iyi olduğu “tek bir oran” üzerinden değil, net getiri üzerinden değerlendirilmelidir. NetMevduat.net’te vade
    gününü değiştirerek aynı anapara ve faiz oranıyla farklı vadelerin net sonucunu saniyeler içinde görebilirsiniz.
  </Text>

  <Text style={[styles.seoH3, { color: t.text }]}>Piyasa Faiz Aralığı Ne İşe Yarar?</Text>
  <Text style={[styles.seoP, { color: t.muted }]}>
    Uygulamada yer alan “Piyasa” bölümü, belirli vadeler için genel bir bilgilendirme aralığı sunar. Bu aralıklar,
    bankaların kampanyalarına, müşteri segmentine, şube/kanal koşullarına ve güncel piyasaya göre değişebilir.
    Dolayısıyla piyasa aralığı bir “referans” gibi düşünülmelidir. Nihai kazancı ise sizin girdiğiniz faiz oranı belirler.
    En iyi yaklaşım, bankanızın sunduğu oranı girip net sonuca bakmak ve bunu diğer seçeneklerle kıyaslamaktır.
  </Text>

  <Text style={[styles.seoH3, { color: t.text }]}>Faiz Oranı Yüksekse Kazanç Her Zaman Daha mı Yüksek?</Text>
  <Text style={[styles.seoP, { color: t.muted }]}>
    Her zaman değil. Çünkü (1) vade gün sayısı, (2) stopaj oranı ve (3) paranın ne kadar süre bağlı kaldığı net kazancı
    değiştirir. Örneğin kısa vadede yüksek oran yakalasanız bile gün sayısı düşük olduğu için toplam net getiri beklediğiniz
    kadar yüksek olmayabilir. Diğer yandan daha uzun vadede brüt oran biraz daha düşük olsa bile, daha uzun süre faiz işlediği
    için toplam net kazanç artabilir. Bu nedenle en sağlıklı yöntem, farklı vade ve oran senaryolarını net kazanç üzerinden
    karşılaştırmaktır.
  </Text>

  <Text style={[styles.seoH3, { color: t.text }]}>EAY (Efektif Yıllık Getiri) Nedir?</Text>
  <Text style={[styles.seoP, { color: t.muted }]}>
    EAY, belirli bir vadede elde ettiğiniz net kazancı yıllık bazda karşılaştırılabilir hale getirmek için kullanılan bir göstergedir.
    Örneğin 32 gün vadede net getiriniz yüksek görünse bile, bunu yıla yaydığınızda farklı vadelerle karşılaştırmanız daha kolay olur.
    NetMevduat.net, EAY değerini de hesaplayarak “hangi seçenek yıllık bazda daha avantajlı?” sorusuna daha net bir perspektif sağlar.
  </Text>

  <Text style={[styles.seoH3, { color: t.text }]}>2026’da Mevduat Stratejisi Nasıl Düşünülmeli?</Text>
  <Text style={[styles.seoP, { color: t.muted }]}>
    2026 yılında mevduat stratejisi belirlerken tek bir “doğru” yok; çünkü faiz ortamı, enflasyon beklentileri, merkez bankası kararları
    ve bankaların kampanya iştahı zaman içinde değişebilir. Bu yüzden yatırımcılar genelde iki şeye odaklanır: (1) Vade esnekliği (paraya
    ne kadar zamanda yeniden erişmek istediğiniz) ve (2) Net getiri. Kısa vadelerde yeniden fiyatlama avantajı olurken, orta vadelerde daha
    stabil bir getiri hedeflenebilir. En doğru karar, kendi nakit ihtiyacınıza göre vade seçip net kazancı karşılaştırmaktır.
  </Text>

  <Text style={[styles.seoH3, { color: t.text }]}>Mevduat Hesaplama Aracı Nasıl Kullanılır?</Text>
  <Text style={[styles.seoP, { color: t.muted }]}>
    Kullanım çok basit: (1) Anapara tutarını girin. (2) Bankanızın sunduğu yıllık faiz oranını yazın. (3) Vade gününü seçin (32 / 92 / 180
    veya özel gün). Sistem brüt kazancı, stopaj kesintisini ve net getiriyi otomatik hesaplar. İsterseniz sonuç kartındaki kopyalama özelliğiyle
    net sonucu tek tıkla paylaşabilir veya not olarak saklayabilirsiniz.
  </Text>

  <Text style={[styles.seoH3, { color: t.text }]}>Sık Yapılan Hatalar</Text>
  <Text style={[styles.seoP, { color: t.muted }]}>
    Mevduat hesaplamada en sık yapılan hata, brüt faiz tutarını “net kazanç” sanmaktır. İkinci hata, farklı vadeleri karşılaştırırken gün sayısını
    dikkate almamaktır. Üçüncü hata ise stopajı tamamen göz ardı etmektir. NetMevduat.net bu hataları ortadan kaldırmak için brüt, stopaj ve neti
    ayrı ayrı gösterir; vade değiştirildiğinde sonucu anında günceller.
  </Text>

  <Text style={[styles.seoH3, { color: t.text }]}>Sonuç</Text>
  <Text style={[styles.seoP, { color: t.muted }]}>
    Vadeli mevduat net getiri hesaplama, yatırım kararının temelidir. Sadece faiz oranına değil, stopaj dahil net kazanca odaklanmak gerekir.
    NetMevduat.net; sade arayüzü, hızlı hesaplama mantığı ve bilgilendirme panelleriyle mevduat kararınızı daha bilinçli vermenize yardımcı olur.
    İlerleyen aşamalarda farklı senaryolar, ek rehber içerikler ve daha kapsamlı bilgilendirmelerle bu sayfa genişletilebilir.
  </Text>
   <Text style={[styles.seoH3, { color: t.text }]}>
  Yasal Uyarı
</Text>

<Text style={[styles.seoP, { color: t.muted }]}>
  Bu sitede yer alan mevduat hesaplama sonuçları bilgilendirme amaçlıdır.
  NetMevduat.net yatırım danışmanlığı hizmeti vermez. Hesaplamalar,
  kullanıcı tarafından girilen faiz oranı ve vade bilgilerine göre matematiksel
  olarak oluşturulur. Nihai faiz oranları, stopaj oranları ve banka koşulları
  değişkenlik gösterebilir. Yatırım kararları öncesinde resmi banka
  kaynaklarının ve güncel mevzuatın kontrol edilmesi önerilir.
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

  // ✅ FIX: stacking context
  hero: { borderWidth: 1, borderRadius: 22, padding: 14, overflow: "hidden", position: "relative" },

  // ✅ FIX: glow her zaman arkada
  heroGlow: { position: "absolute", width: 420, height: 420, borderRadius: 999, top: -220, left: -180, zIndex: 0 },
  heroGlow2: { position: "absolute", width: 380, height: 380, borderRadius: 999, bottom: -220, right: -180, zIndex: 0 },

  // ✅ FIX: içerik her zaman üstte
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    position: "relative",
    zIndex: 2,
  },

  brand: { fontSize: 26, fontWeight: "900" },
  tagline: { marginTop: 2, fontSize: 12, fontWeight: "800", lineHeight: 16, marginBottom: 6 },

  themeBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  // ✅ FIX
  menuRow: { marginTop: 8, flexDirection: "row", gap: 8, borderTopWidth: 1, paddingTop: 12, position: "relative", zIndex: 2 },
  menuBtn: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  menuText: { fontSize: 12, fontWeight: "900" },

  // ✅ FIX
  netCard: {
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    position: "relative",
    zIndex: 2,
    ...(Platform.OS === "android" ? { elevation: 2 } : null),
  },
  netTitle: { fontSize: 12, fontWeight: "900" },
  netValue: { fontSize: 42, fontWeight: "900", marginTop: 6 },

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

  metaRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap", justifyContent: "center" },
  metaPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },

  miniInfoRow: {
    marginTop: 10,
    width: "100%",
    borderTopWidth: 1,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "space-between",
  },
  miniInfoText: { flex: 1, fontSize: 11, fontWeight: "800", lineHeight: 16 },
  miniInfoBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },

  // ✅ FIX
  compactDetail: { marginTop: 12, borderRadius: 18, borderWidth: 1, padding: 12, position: "relative", zIndex: 2 },
  compactRow: { flexDirection: "row", alignItems: "center" },
  compactItem: { flex: 1, alignItems: "center" },
  compactLabel: { fontSize: 11, fontWeight: "900" },
  compactValue: { marginTop: 4, fontSize: 13, fontWeight: "900" },
  compactDivider: { width: 1, height: 34, marginHorizontal: 8 },

  // ✅ FIX
  heroInputs: { marginTop: 12, borderRadius: 20, borderWidth: 1, padding: 14, position: "relative", zIndex: 2 },

  label: { fontSize: 12, fontWeight: "900", marginBottom: 6, marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, fontWeight: "800" },
  micro: { marginTop: 6, fontSize: 11, fontWeight: "700" },

  pills: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },

  ctaPrimary: { borderRadius: 16, paddingVertical: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  ctaPrimaryText: { fontSize: 13, fontWeight: "900" },

  rangeLine: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chip: { borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },

  seoBlock: { marginTop: 14, borderRadius: 18, borderWidth: 1, padding: 14 },
  seoH2: { fontSize: 18, fontWeight: "900", marginBottom: 8 },
  seoH3: { fontSize: 14, fontWeight: "900", marginTop: 12, marginBottom: 6 },
  seoP: { fontSize: 12, fontWeight: "700", lineHeight: 18 },

  footer: { marginTop: 16, textAlign: "center", fontSize: 11, fontWeight: "800" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", paddingTop: 70, paddingHorizontal: 14 },
  modalPanel: { width: "100%", borderRadius: 18, borderWidth: 1, padding: 12 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tcmbBox: { borderWidth: 1, borderRadius: 14, padding: 12 },
});

const light = {
  bg: "#F7F8FB",
  bgSoft: "#FFFFFF",
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

  menuBg: "#FFFFFF",
};