import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/roles";
import { UtasLogo } from "@/components/common/utas-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check, FileCheck2, FileText, ListChecks, Network } from "lucide-react";

const STEPS = [
  {
    icon: FileText,
    title: "قدّم النموذج",
    description: "اختر النموذج المطلوب وأدخل بياناتك مباشرة عبر البوابة.",
  },
  {
    icon: Network,
    title: "التوجيه التلقائي",
    description: "يُوجَّه طلبك تلقائياً إلى المعتمد المختص حسب الهيكل التنظيمي.",
  },
  {
    icon: ListChecks,
    title: "تتبّع الحالة",
    description: "تابع مسار الاعتماد لحظة بلحظة من لوحة طلباتك.",
  },
  {
    icon: FileCheck2,
    title: "احصل على النسخة المعتمدة",
    description: "بعد الاعتماد، حمّل نسخة PDF رسمية من طلبك فوراً.",
  },
];

export default async function RootPage() {
  const profile = await getCurrentProfile();
  if (profile) redirect(ROLE_HOME[profile.role]);

  return (
    <div dir="rtl" lang="ar" className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-[rgba(45,52,138,0.09)] bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
          <div className="flex items-center gap-2 font-semibold">
            <UtasLogo size={40} title="جامعة التقنية والعلوم التطبيقية" />
            <span>مستند</span>
          </div>
          <Button asChild variant="default">
            <Link href="/login">تسجيل الدخول</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b">
          {/* Brand pattern texture — behind all hero content. */}
          <svg
            className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-5"
            aria-hidden="true"
          >
            <defs>
              <pattern id="hero-pattern" width="72" height="72" patternUnits="userSpaceOnUse">
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--utas-navy)" strokeWidth="1.5" />
                <circle cx="54" cy="54" r="15" fill="none" stroke="var(--utas-orange)" strokeWidth="1.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-pattern)" />
          </svg>

          <div className="relative z-10 mx-auto grid max-w-5xl gap-10 px-4 py-20 sm:px-6 sm:py-28 md:grid-cols-[55fr_45fr] md:items-center md:gap-8">
            {/* Text column */}
            <div className="text-center md:text-start">
              <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                مستند. من التقديم إلى الاعتماد، دون تنقّل بين المكاتب
              </h1>
              <p className="mx-auto mt-4 max-w-[400px] text-sm leading-relaxed text-muted-foreground md:mx-0">
                طلبك يُوجَّه تلقائيًا عبر الهيكل التنظيمي، وتتابع حالته أولًا بأول حتى اعتماده
                وتوثيقه.
              </p>
              <div className="mt-6 flex justify-center md:justify-start">
                <Button asChild variant="cta" size="lg" className="gap-2">
                  <Link href="/login">
                    تسجيل الدخول
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                اعتمادات متعددة المراحل · توجيه حسب الهيكل التنظيمي · تصدير PDF فوري
              </p>
            </div>

            {/* Illustration column */}
            <div className="relative mx-auto hidden h-[270px] w-full max-w-[280px] md:block">
              {/* Layer 0 — soft background circle, centered */}
              <div
                className="absolute left-1/2 top-1/2 z-0 h-[210px] w-[210px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: "#E9EDFB" }}
              />

              {/* Layer 10 — tilted document card, lower-left */}
              <div className="absolute bottom-[6%] left-[4%] z-10 h-[104px] w-[150px] -rotate-[9deg] rounded-[10px] border border-border bg-white p-3 shadow-sm">
                <div className="space-y-1.5">
                  <div className="h-1.5 w-3/4 rounded-full bg-gray-200" />
                  <div className="h-1.5 w-full rounded-full bg-gray-200" />
                  <div className="h-1.5 w-2/3 rounded-full bg-gray-200" />
                </div>
              </div>

              {/* Layer 20 — logo tile, centered, above the document card */}
              <div className="absolute left-1/2 top-1/2 z-20 flex h-[74px] w-[74px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-border bg-white shadow-sm">
                <UtasLogo size={44} title="جامعة التقنية والعلوم التطبيقية" />
              </div>

              {/* Layer 30 — orange checkmark badge, upper-right of the logo tile */}
              <div className="absolute right-[calc(50%-37px)] top-[calc(50%-37px)] z-30 flex h-[30px] w-[30px] translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-utas-orange text-white shadow-sm">
                <Check className="h-4 w-4" />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-muted/30 py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-bold tracking-tight">كيف تعمل المنصة</h2>
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <Card
                  key={step.title}
                  className={cn(
                    "border-t-[3px] p-5 text-center",
                    i % 2 === 0 ? "border-t-utas-navy" : "border-t-utas-orange"
                  )}
                >
                  <span
                    className={cn(
                      "mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full",
                      i % 2 === 0 ? "bg-utas-navy/10 text-utas-navy" : "bg-utas-orange/10 text-utas-orange"
                    )}
                  >
                    <step.icon className="h-5 w-5" />
                  </span>
                  <p className="mb-1 text-xs font-semibold text-primary">{`الخطوة ${i + 1}`}</p>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center">
        <p className="text-sm font-semibold">مستند</p>
        <p className="mt-1 text-xs text-muted-foreground">
          جامعة التقنية والعلوم التطبيقية · مركز نظم المعلومات
        </p>
      </footer>
    </div>
  );
}
