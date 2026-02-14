"use client";

import Link from "next/link";
import { Shield, Users, HeartPulse, CheckCircle, ArrowRight, Sparkles, Upload, Eye, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function useIntersectionObserver(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.15, ...options });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

function AnimatedCounter({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const { ref, isVisible } = useIntersectionObserver();

  useEffect(() => {
    if (!isVisible) return;
    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isVisible, target, duration]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}

function TypewriterText({ words, className }: { words: string[]; className?: string }) {
  const [currentWord, setCurrentWord] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    const word = words[currentWord];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        setDisplayText(word.substring(0, currentChar + 1));
        setCurrentChar(prev => prev + 1);
        if (currentChar + 1 === word.length) {
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        setDisplayText(word.substring(0, currentChar - 1));
        setCurrentChar(prev => prev - 1);
        if (currentChar - 1 === 0) {
          setIsDeleting(false);
          setCurrentWord(prev => (prev + 1) % words.length);
        }
      }
    }, isDeleting ? 40 : 80);

    return () => clearTimeout(timeout);
  }, [currentChar, isDeleting, currentWord, words]);

  return (
    <span className={className}>
      {displayText}
      <span className="typing-cursor" />
    </span>
  );
}

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="particle particle-1" style={{ top: "20%", left: "10%" }} />
      <div className="particle particle-2" style={{ top: "60%", left: "80%" }} />
      <div className="particle particle-3" style={{ top: "40%", left: "30%" }} />
      <div className="particle particle-1" style={{ top: "70%", left: "60%" }} />
      <div className="particle particle-2" style={{ top: "15%", left: "75%" }} />
      <div className="particle particle-3" style={{ top: "85%", left: "15%" }} />
      <div className="particle particle-1" style={{ top: "50%", left: "90%" }} />
      <div className="particle particle-2" style={{ top: "30%", left: "50%" }} />
      {/* Larger decorative blurs */}
      <div
        className="absolute w-72 h-72 rounded-full float-animation"
        style={{
          top: "10%",
          right: "-5%",
          background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute w-96 h-96 rounded-full float-animation-delayed"
        style={{
          bottom: "5%",
          left: "-10%",
          background: "radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}

export default function Home() {
  const heroSection = useIntersectionObserver();
  const featuresSection = useIntersectionObserver();
  const statsSection = useIntersectionObserver();
  const trustSection = useIntersectionObserver();

  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main className="min-h-screen animated-gradient-bg relative">
      <FloatingParticles />

      {/* Skip to main content for accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Header */}
      <header
        className="fixed top-0 w-full z-50 transition-all duration-500"
        style={{
          background: scrollY > 50 ? "rgba(255,255,255,0.85)" : "transparent",
          backdropFilter: scrollY > 50 ? "blur(20px) saturate(180%)" : "none",
          borderBottom: scrollY > 50 ? "1px solid rgba(0,0,0,0.06)" : "1px solid transparent",
          boxShadow: scrollY > 50 ? "0 4px 30px rgba(0,0,0,0.04)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <HeartPulse className="w-5 h-5 text-white heartbeat" />
              </div>
              <span className="font-semibold text-slate-800">
                BreastScreen<span className="text-blue-600">AI</span>
              </span>
            </div>
            <nav className="flex items-center gap-4">
              <Link
                href="/auth/login"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-all duration-200 hover:-translate-y-0.5"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className="btn btn-primary btn-shimmer text-sm py-2 px-5 shadow-lg shadow-blue-500/20"
              >
                <Sparkles className="w-4 h-4" />
                Get Started
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="main-content" className="pt-32 pb-20 px-4 relative">
        <div className="max-w-4xl mx-auto text-center" ref={heroSection.ref}>
          {/* Animated badge */}
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-md border border-blue-100 mb-8 shadow-sm transition-all duration-700 ${heroSection.isVisible ? "animate-fade-in-down" : "opacity-0"
              }`}
          >
            <Shield className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">
              Clinician-Verified Screening Support
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </div>

          {/* Animated heading */}
          <h1
            className={`text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight transition-all duration-700 ${heroSection.isVisible ? "animate-fade-in-up" : "opacity-0"
              }`}
          >
            Early Breast Cancer Screening,
            <br />
            <TypewriterText
              words={["Guided by Experts", "Powered by AI", "Built on Trust", "Reviewed by Doctors"]}
              className="animated-gradient-text"
            />
          </h1>

          <p
            className={`text-lg text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed transition-all duration-700 delay-200 ${heroSection.isVisible ? "animate-fade-in-up delay-200" : "opacity-0"
              }`}
          >
            A supportive screening tool that connects you with certified radiologists.
            Every result is personally reviewed by qualified medical professionals
            before reaching you.
          </p>

          {/* CTA Buttons */}
          <div
            className={`flex flex-col sm:flex-row gap-4 justify-center mb-12 transition-all duration-700 ${heroSection.isVisible ? "animate-fade-in-up delay-300" : "opacity-0"
              }`}
          >
            <Link
              href="/auth/register"
              className="btn btn-primary btn-shimmer text-base py-3 px-8 shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40"
            >
              <Users className="w-5 h-5" />
              Register as Patient
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/auth/register?type=doctor"
              className="btn btn-secondary text-base py-3 px-8 backdrop-blur-md bg-white/70"
            >
              <Shield className="w-5 h-5" />
              Join as Doctor
            </Link>
          </div>

          {/* Disclaimer Banner */}
          <div
            className={`disclaimer-banner max-w-2xl mx-auto transition-all duration-700 ${heroSection.isVisible ? "animate-fade-in-up delay-500" : "opacity-0"
              }`}
          >
            <p className="flex items-start gap-2">
              <span className="text-amber-600 font-bold">ℹ️</span>
              <span>
                <strong>Important:</strong> This is a research and support tool, not a diagnostic device.
                All findings are reviewed by board-certified medical professionals.
                Always consult your healthcare provider for medical advice.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4" ref={statsSection.ref}>
        <div className="max-w-5xl mx-auto">
          <div
            className={`grid grid-cols-2 md:grid-cols-4 gap-6 transition-all duration-700 ${statsSection.isVisible ? "animate-fade-in-up" : "opacity-0"
              }`}
          >
            {[
              { label: "Screenings Completed", value: 12500, icon: Eye, color: "blue" },
              { label: "Certified Doctors", value: 150, icon: Shield, color: "indigo" },
              { label: "Regions Covered", value: 45, icon: Users, color: "emerald" },
              { label: "Patient Satisfaction", value: 98, suffix: "%", icon: Star, color: "amber" },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`card-glass p-6 text-center stat-card stat-card-${stat.color} transition-all duration-500`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <stat.icon className={`w-6 h-6 mx-auto mb-3 text-${stat.color}-500 icon-bounce`} />
                <p className="text-3xl font-bold text-slate-900 mb-1">
                  <AnimatedCounter target={stat.value} />
                  {stat.suffix || "+"}
                </p>
                <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 relative" ref={featuresSection.ref}>
        <div className="max-w-6xl mx-auto">
          <div
            className={`text-center mb-16 transition-all duration-700 ${featuresSection.isVisible ? "animate-fade-in-up" : "opacity-0"
              }`}
          >
            <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-50 rounded-full mb-4 uppercase tracking-wider">
              Simple Process
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              How It Works
            </h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              Three simple steps to get expert-reviewed screening results
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connection line behind cards */}
            <div className="hidden md:block absolute top-24 left-[16.66%] right-[16.66%] h-0.5 bg-gradient-to-r from-blue-200 via-indigo-200 to-green-200" />

            {/* Step 1 */}
            <div
              className={`card-interactive p-8 text-center relative transition-all duration-700 ${featuresSection.isVisible ? "animate-fade-in-up delay-100" : "opacity-0"
                }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/25 icon-bounce">
                <Upload className="w-7 h-7 text-white" />
              </div>
              <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shadow-lg">
                1
              </div>
              <h3 className="font-bold text-slate-900 mb-3 text-lg">
                Upload Your Mammogram
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Securely upload your mammogram images. Your data is encrypted
                and handled with the highest privacy standards.
              </p>
            </div>

            {/* Step 2 */}
            <div
              className={`card-interactive p-8 text-center relative transition-all duration-700 ${featuresSection.isVisible ? "animate-fade-in-up delay-300" : "opacity-0"
                }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/25 icon-bounce">
                <Eye className="w-7 h-7 text-white" />
              </div>
              <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shadow-lg">
                2
              </div>
              <h3 className="font-bold text-slate-900 mb-3 text-lg">
                Expert Review
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                A certified radiologist personally reviews your case.
                AI assists the doctor—it never makes decisions alone.
              </p>
            </div>

            {/* Step 3 */}
            <div
              className={`card-interactive p-8 text-center relative transition-all duration-700 ${featuresSection.isVisible ? "animate-fade-in-up delay-500" : "opacity-0"
                }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/25 icon-bounce">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
              <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-emerald-600 text-white text-sm font-bold flex items-center justify-center shadow-lg">
                3
              </div>
              <h3 className="font-bold text-slate-900 mb-3 text-lg">
                Clear Results
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Receive a clear, easy-to-understand summary with
                recommended next steps from your reviewing physician.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20 px-4" ref={trustSection.ref}>
        <div className="max-w-4xl mx-auto">
          <div
            className={`card-glass p-8 md:p-12 pulse-glow transition-all duration-700 ${trustSection.isVisible ? "animate-scale-in" : "opacity-0"
              }`}
          >
            <div className="text-center mb-8">
              <span className="inline-block px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full mb-4 uppercase tracking-wider">
                Your Safety First
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Built on Trust & Safety
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  title: "Human-First Approach",
                  desc: "AI is advisory only. Doctors make all decisions.",
                  delay: "delay-100",
                },
                {
                  title: "Verified Doctors",
                  desc: "All reviewers are board-certified with verified credentials.",
                  delay: "delay-200",
                },
                {
                  title: "Privacy Protected",
                  desc: "Your data is encrypted and never shared without consent.",
                  delay: "delay-300",
                },
                {
                  title: "Calm Communication",
                  desc: "Clear, reassuring language—never alarming terminology.",
                  delay: "delay-400",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className={`flex items-start gap-4 p-4 rounded-xl transition-all duration-300 hover:bg-white/60 hover:shadow-sm group cursor-default ${trustSection.isVisible ? `animate-fade-in-left ${item.delay}` : "opacity-0"
                    }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-sm text-slate-600 mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-slate-600 mb-8 max-w-lg mx-auto">
            Join thousands of patients and doctors who trust our platform for
            expert-reviewed breast cancer screening.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/register"
              className="btn btn-primary btn-shimmer text-base py-3 px-8 shadow-xl shadow-blue-500/25"
            >
              <Sparkles className="w-5 h-5" />
              Start Your Screening
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-slate-200/50 backdrop-blur-md bg-white/30">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <HeartPulse className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-700">
              BreastScreen<span className="text-blue-600">AI</span>
            </span>
          </div>
          <p className="text-sm text-slate-500">
            © 2026 BreastScreenAI. A research and clinical support platform.
            <br />
            <span className="text-xs">
              This tool is not a substitute for professional medical advice, diagnosis, or treatment.
            </span>
          </p>
        </div>
      </footer>
    </main>
  );
}
