// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import React from "react";
import { SignIn, SignUp, useUser } from "@clerk/react";
import { Redirect } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function AuthLoadingScreen() {
  return (
    <div className="min-h-[100dvh] bg-[#080d09] flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <img src={`${basePath}/icon-final2.png`} alt="ProxhqVPN" className="w-10 h-10" />
      </div>
      <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
    </div>
  );
}

function AuthBrandingPanel({ bullets }: { bullets: string[] }) {
  return (
    <div className="hidden lg:flex flex-col justify-between w-96 bg-gradient-to-b from-[#0d1610] to-[#080d09] border-r border-white/[0.06] p-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
          <img src={`${basePath}/icon-final2.png`} alt="" className="w-7 h-7" />
        </div>
        <span className="text-lg font-bold text-white">ProxhqVPN</span>
      </div>

      <div className="space-y-6">
        {bullets.map((feature) => (
          <div key={feature} className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            </div>
            <span className="text-sm text-white/88">{feature}</span>
          </div>
        ))}
      </div>

      <div className="text-xs text-white/70">
        © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  );
}

export function SignInPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [showClerk, setShowClerk] = React.useState(false);

  if (!isLoaded) return <AuthLoadingScreen />;
  if (isSignedIn) return <Redirect to="/app" />;

  return (
    <div className="flex min-h-[100dvh] bg-[#080d09]">
      <AuthBrandingPanel
        bullets={[
          "Military-grade WireGuard encryption",
          "Zero-logs privacy policy",
          "Double-hop anonymity",
          "Instant kill switch protection",
        ]}
      />

      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center lg:hidden mb-2">
            <img src={`${basePath}/icon-final2.png`} alt="ProxhqVPN" className="w-12 h-12 mx-auto mb-3" />
            <div className="text-xl font-bold text-white">ProxhqVPN</div>
          </div>

          {showClerk ? (
            <>
              <BackButton onClick={() => setShowClerk(false)} />
              <SignIn
                routing="path"
                path={`${basePath}/sign-in`}
                signUpUrl={`${basePath}/sign-up`}
                fallbackRedirectUrl={`${basePath}/dashboard`}
              />
            </>
          ) : (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-white">Welcome back</h1>
                <p className="text-sm text-white/55 mt-1">Choose how you want to sign in.</p>
              </div>

              <button
                onClick={() => setShowClerk(true)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.09] hover:border-white/20 transition-all group"
              >
                <GoogleIcon />
                <div className="text-left">
                  <div className="text-sm font-medium text-white">Continue with Google</div>
                  <div className="text-xs text-white/45">Sign in with your Gmail account</div>
                </div>
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.07]" />
                <span className="text-xs text-white/30">or</span>
                <div className="flex-1 h-px bg-white/[0.07]" />
              </div>

              <p className="text-center text-xs text-white/35">
                No account?{" "}
                <a href={`${basePath}/sign-up`} className="text-primary hover:underline">
                  Create one
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SignUpPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [showClerk, setShowClerk] = React.useState(false);

  if (!isLoaded) return <AuthLoadingScreen />;
  if (isSignedIn) return <Redirect to="/app" />;

  return (
    <div className="flex min-h-[100dvh] bg-[#080d09]">
      <AuthBrandingPanel
        bullets={[
          "Privacy that works from day one",
          "No email required — anonymous accounts available",
          "Download your VPN config in under 60 seconds",
          "60-node encrypted mesh network",
        ]}
      />

      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center lg:hidden mb-2">
            <img src={`${basePath}/icon-final2.png`} alt="ProxhqVPN" className="w-12 h-12 mx-auto mb-3" />
            <div className="text-xl font-bold text-white">ProxhqVPN</div>
          </div>

          {showClerk ? (
            <>
              <BackButton onClick={() => setShowClerk(false)} />
              <SignUp
                routing="path"
                path={`${basePath}/sign-up`}
                signInUrl={`${basePath}/sign-in`}
                fallbackRedirectUrl={`${basePath}/app`}
              />
            </>
          ) : (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-white">Create account</h1>
                <p className="text-sm text-white/55 mt-1">Choose how you want to get started.</p>
              </div>

              <button
                onClick={() => setShowClerk(true)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.09] hover:border-white/20 transition-all group"
              >
                <GoogleIcon />
                <div className="text-left">
                  <div className="text-sm font-medium text-white">Continue with Google</div>
                  <div className="text-xs text-white/45">Sign up with your Gmail account</div>
                </div>
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.07]" />
                <span className="text-xs text-white/30">or</span>
                <div className="flex-1 h-px bg-white/[0.07]" />
              </div>

              <p className="text-center text-xs text-white/35">
                Already have one?{" "}
                <a href={`${basePath}/sign-in`} className="text-primary hover:underline">
                  Sign in
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
