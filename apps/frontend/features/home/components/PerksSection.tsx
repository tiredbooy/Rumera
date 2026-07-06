import {
  Truck,
  ShieldCheck,
  Wallet,
  Headphones,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/features/motion/components/reveal";

interface Perk {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const perks: Perk[] = [
  {
    icon: Truck,
    title: "ارسال سریع و مطمئن",
    desc: "تحویل به سراسر کشور با بسته‌بندی ایمن",
  },
  {
    icon: ShieldCheck,
    title: "اصالت تضمین‌شده",
    desc: "مستقیم از برند و واردکنندهٔ رسمی",
  },
  {
    icon: Wallet,
    title: "پرداخت امن",
    desc: "درگاه امن بانکی و کیف پول رومرا",
  },
  {
    icon: Headphones,
    title: "پشتیبانی واقعی",
    desc: "همراه شما، پیش و پس از خرید",
  },
];

export function PerksSection() {
  return (
    <section className="border-b border-border/60 bg-card/30">
      <div className="container-px mx-auto grid max-w-7xl gap-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {perks.map((perk, i) => (
          <Reveal key={perk.title} delay={i * 0.06} y={12}>
            <div className="hover-lift group/perk flex h-full items-center gap-4 rounded-2xl border border-border/60 bg-card/50 p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10 transition-colors duration-300 group-hover/perk:bg-primary group-hover/perk:text-primary-foreground">
                <perk.icon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-medium">{perk.title}</p>
                <p className="text-xs text-muted-foreground">{perk.desc}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
