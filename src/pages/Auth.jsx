import { useRef, useState } from "react";
import { supabase } from "../config/supabase";

// ---------------------------------------------------------------------------
// Text dictionary
//
// Every user-facing string lives here and is read through t("key").
// To connect the project's i18n system later, replace AUTH_TEXT and the
// t() helper inside the component with lookups from src/i18n/translations.js.
// The Kannada text is a first draft and should be reviewed by a native speaker.
// ---------------------------------------------------------------------------
const AUTH_TEXT = {
  en: {
    brandName: "Krishi Samparka",
    brandNameLocal: "ಕೃಷಿ ಸಂಪರ್ಕ",
    tagline: "Connect directly. Sell better.",
    languageLabel: "Language",
    accountTypeLabel: "I am a",
    farmerTitle: "Farmer / Seller",
    farmerDesc: "Sell your produce directly",
    buyerTitle: "Buyer / Customer",
    buyerDesc: "Find produce directly from farmers",
    loginTitle: "Login",
    loginSubtitle: "Welcome back. Please enter your details.",
    signupTitle: "Create your account",
    signupSubtitle: "Join Krishi Samparka in a few steps.",
    fullName: "Full Name",
    fullNamePlaceholder: "Enter your full name",
    email: "Email",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordPlaceholder: "Enter your password",
    confirmPassword: "Confirm Password",
    confirmPasswordPlaceholder: "Enter your password again",
    showPassword: "Show",
    hidePassword: "Hide",
    loginButton: "Login",
    signupButton: "Create Account",
    loggingIn: "Logging in...",
    creatingAccount: "Creating account...",
    noAccount: "Don't have an account?",
    haveAccount: "Already have an account?",
    switchToSignup: "Sign up",
    switchToLogin: "Login",
    errNameRequired: "Please enter your full name.",
    errEmailRequired: "Please enter your email.",
    errEmailInvalid: "Please enter a valid email address.",
    errPasswordRequired: "Please enter your password.",
    errPasswordShort: "Password must be at least 6 characters.",
    errPasswordMismatch: "Passwords do not match.",
    errAccountType: "Please choose an account type.",
    errInvalidCredentials: "Incorrect email or password.",
    errEmailNotConfirmed:
      "Your email is not confirmed yet. Please check your inbox and confirm it first.",
    errAlreadyRegistered:
      "An account with this email already exists. Please log in instead.",
    errWeakPassword: "This password is too weak. Please choose a stronger one.",
    errRateLimit: "Too many attempts. Please wait a little and try again.",
    errNetwork: "Could not reach the server. Please check your internet connection.",
    errGeneric: "Something went wrong. Please try again.",
    successLogin: "Login successful.",
    successSignupSession: "Your account has been created and you are signed in.",
    successSignupConfirm:
      "Account created. Please check your email and confirm your address, then log in.",
  },
  kn: {
    brandName: "Krishi Samparka",
    brandNameLocal: "ಕೃಷಿ ಸಂಪರ್ಕ",
    tagline: "ನೇರವಾಗಿ ಸಂಪರ್ಕಿಸಿ. ಉತ್ತಮವಾಗಿ ಮಾರಾಟ ಮಾಡಿ.",
    languageLabel: "ಭಾಷೆ",
    accountTypeLabel: "ನಾನು",
    farmerTitle: "ರೈತ / ಮಾರಾಟಗಾರ",
    farmerDesc: "ನಿಮ್ಮ ಬೆಳೆಯನ್ನು ನೇರವಾಗಿ ಮಾರಾಟ ಮಾಡಿ",
    buyerTitle: "ಖರೀದಿದಾರ / ಗ್ರಾಹಕ",
    buyerDesc: "ರೈತರಿಂದ ನೇರವಾಗಿ ಬೆಳೆ ಹುಡುಕಿ",
    loginTitle: "ಲಾಗಿನ್",
    loginSubtitle: "ಮರಳಿ ಸ್ವಾಗತ. ನಿಮ್ಮ ವಿವರಗಳನ್ನು ನಮೂದಿಸಿ.",
    signupTitle: "ನಿಮ್ಮ ಖಾತೆ ರಚಿಸಿ",
    signupSubtitle: "ಕೆಲವೇ ಹಂತಗಳಲ್ಲಿ Krishi Samparka ಗೆ ಸೇರಿ.",
    fullName: "ಪೂರ್ಣ ಹೆಸರು",
    fullNamePlaceholder: "ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರನ್ನು ನಮೂದಿಸಿ",
    email: "ಇಮೇಲ್",
    emailPlaceholder: "you@example.com",
    password: "ಪಾಸ್‌ವರ್ಡ್",
    passwordPlaceholder: "ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ",
    confirmPassword: "ಪಾಸ್‌ವರ್ಡ್ ದೃಢೀಕರಿಸಿ",
    confirmPasswordPlaceholder: "ಪಾಸ್‌ವರ್ಡ್ ಮತ್ತೊಮ್ಮೆ ನಮೂದಿಸಿ",
    showPassword: "ತೋರಿಸಿ",
    hidePassword: "ಮರೆಮಾಡಿ",
    loginButton: "ಲಾಗಿನ್",
    signupButton: "ಖಾತೆ ರಚಿಸಿ",
    loggingIn: "ಲಾಗಿನ್ ಆಗುತ್ತಿದೆ...",
    creatingAccount: "ಖಾತೆ ರಚಿಸಲಾಗುತ್ತಿದೆ...",
    noAccount: "ಖಾತೆ ಇಲ್ಲವೇ?",
    haveAccount: "ಈಗಾಗಲೇ ಖಾತೆ ಇದೆಯೇ?",
    switchToSignup: "ಸೈನ್ ಅಪ್",
    switchToLogin: "ಲಾಗಿನ್",
    errNameRequired: "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರನ್ನು ನಮೂದಿಸಿ.",
    errEmailRequired: "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಇಮೇಲ್ ನಮೂದಿಸಿ.",
    errEmailInvalid: "ದಯವಿಟ್ಟು ಸರಿಯಾದ ಇಮೇಲ್ ವಿಳಾಸ ನಮೂದಿಸಿ.",
    errPasswordRequired: "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ.",
    errPasswordShort: "ಪಾಸ್‌ವರ್ಡ್ ಕನಿಷ್ಠ 6 ಅಕ್ಷರಗಳಿರಬೇಕು.",
    errPasswordMismatch: "ಪಾಸ್‌ವರ್ಡ್‌ಗಳು ಹೊಂದಿಕೆಯಾಗುತ್ತಿಲ್ಲ.",
    errAccountType: "ದಯವಿಟ್ಟು ಖಾತೆಯ ಪ್ರಕಾರವನ್ನು ಆಯ್ಕೆಮಾಡಿ.",
    errInvalidCredentials: "ಇಮೇಲ್ ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ತಪ್ಪಾಗಿದೆ.",
    errEmailNotConfirmed:
      "ನಿಮ್ಮ ಇಮೇಲ್ ಇನ್ನೂ ದೃಢೀಕರಿಸಲಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಇನ್‌ಬಾಕ್ಸ್ ಪರಿಶೀಲಿಸಿ.",
    errAlreadyRegistered:
      "ಈ ಇಮೇಲ್‌ನೊಂದಿಗೆ ಈಗಾಗಲೇ ಖಾತೆ ಇದೆ. ದಯವಿಟ್ಟು ಲಾಗಿನ್ ಮಾಡಿ.",
    errWeakPassword: "ಈ ಪಾಸ್‌ವರ್ಡ್ ದುರ್ಬಲವಾಗಿದೆ. ಬಲವಾದ ಪಾಸ್‌ವರ್ಡ್ ಆರಿಸಿ.",
    errRateLimit: "ಹಲವು ಪ್ರಯತ್ನಗಳಾಗಿವೆ. ಸ್ವಲ್ಪ ಸಮಯ ಕಾದು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    errNetwork: "ಸರ್ವರ್ ಸಂಪರ್ಕ ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ನಿಮ್ಮ ಇಂಟರ್ನೆಟ್ ಪರಿಶೀಲಿಸಿ.",
    errGeneric: "ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    successLogin: "ಲಾಗಿನ್ ಯಶಸ್ವಿಯಾಗಿದೆ.",
    successSignupSession: "ನಿಮ್ಮ ಖಾತೆ ರಚಿಸಲಾಗಿದೆ ಮತ್ತು ನೀವು ಲಾಗಿನ್ ಆಗಿದ್ದೀರಿ.",
    successSignupConfirm:
      "ಖಾತೆ ರಚಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಇಮೇಲ್ ದೃಢೀಕರಿಸಿ, ನಂತರ ಲಾಗಿನ್ ಮಾಡಿ.",
  },
};

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "kn", label: "ಕನ್ನಡ" },
];

// Values match what the database stores as the user's role
const ACCOUNT_TYPES = [
  { value: "farmer", titleKey: "farmerTitle", descKey: "farmerDesc" },
  { value: "buyer", titleKey: "buyerTitle", descKey: "buyerDesc" },
];

const MIN_PASSWORD_LENGTH = 6;

// ---------------------------------------------------------------------------
// Styles (scoped with the "ks-auth" prefix so nothing else is affected)
// ---------------------------------------------------------------------------
const AUTH_CSS = `
.ks-auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: #f4f9f4;
  color: #1f2937;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Kannada", sans-serif;
  box-sizing: border-box;
}
.ks-auth-page *, .ks-auth-page *::before, .ks-auth-page *::after {
  box-sizing: border-box;
}
.ks-auth-card {
  width: 100%;
  max-width: 460px;
  background: #ffffff;
  border: 1px solid #e3ece3;
  border-radius: 20px;
  padding: 28px 24px;
  box-shadow: 0 4px 18px rgba(20, 60, 30, 0.08);
  text-align: left;
}
.ks-auth-lang {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 8px;
}
.ks-auth-lang-label {
  font-size: 12px;
  color: #6b7280;
  margin-right: 4px;
}
.ks-auth-lang-btn {
  min-height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid #cfdccf;
  background: #ffffff;
  color: #374151;
  font-size: 14px;
  cursor: pointer;
}
.ks-auth-lang-btn[aria-pressed="true"] {
  background: #166534;
  border-color: #166534;
  color: #ffffff;
  font-weight: 600;
}
.ks-auth-brand {
  text-align: center;
  margin-bottom: 20px;
}
.ks-auth-logo {
  width: 56px;
  height: 56px;
  margin: 0 auto 10px;
  border-radius: 50%;
  background: #e8f5e9;
  color: #166534;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ks-auth-brand-name {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  font-weight: 700;
  color: #14532d;
}
.ks-auth-brand-local {
  margin: 2px 0 0;
  font-size: 16px;
  color: #4b5563;
}
.ks-auth-tagline {
  margin: 8px 0 0;
  font-size: 15px;
  color: #4b5563;
}
.ks-auth-section-label {
  display: block;
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}
.ks-auth-types {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 20px;
}
.ks-auth-type {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  text-align: left;
  padding: 12px;
  min-height: 112px;
  border-radius: 14px;
  border: 2px solid #dbe5db;
  background: #ffffff;
  color: #1f2937;
  cursor: pointer;
  font-family: inherit;
}
.ks-auth-type[aria-checked="true"] {
  border-color: #16a34a;
  background: #f0fdf4;
}
.ks-auth-type-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #eef2ee;
  color: #4b5563;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ks-auth-type[aria-checked="true"] .ks-auth-type-icon {
  background: #16a34a;
  color: #ffffff;
}
.ks-auth-type-title {
  font-size: 14px;
  font-weight: 700;
}
.ks-auth-type-desc {
  font-size: 12.5px;
  line-height: 1.35;
  color: #4b5563;
}
.ks-auth-heading {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  color: #111827;
}
.ks-auth-subheading {
  margin: 0 0 16px;
  font-size: 14px;
  color: #6b7280;
}
.ks-auth-field {
  margin-bottom: 14px;
}
.ks-auth-label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}
.ks-auth-input-wrap {
  position: relative;
}
.ks-auth-input {
  width: 100%;
  min-height: 48px;
  padding: 10px 14px;
  border: 1.5px solid #c9d6c9;
  border-radius: 12px;
  background: #ffffff;
  color: #111827;
  font-size: 16px;
  font-family: inherit;
}
.ks-auth-input::placeholder {
  color: #9ca3af;
}
.ks-auth-input.ks-has-toggle {
  padding-right: 72px;
}
.ks-auth-toggle {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  min-height: 36px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #166534;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.ks-auth-submit {
  width: 100%;
  min-height: 50px;
  margin-top: 6px;
  border: none;
  border-radius: 12px;
  background: #16a34a;
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
}
.ks-auth-submit:hover {
  background: #15803d;
}
.ks-auth-submit:disabled {
  background: #86b997;
  cursor: not-allowed;
}
.ks-auth-message {
  margin: 0 0 14px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.4;
}
.ks-auth-message-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}
.ks-auth-message-success {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
}
.ks-auth-switch {
  margin: 18px 0 0;
  text-align: center;
  font-size: 14px;
  color: #4b5563;
}
.ks-auth-switch-btn {
  margin-left: 4px;
  padding: 6px 4px;
  border: none;
  background: transparent;
  color: #166534;
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  text-decoration: underline;
  cursor: pointer;
}
.ks-auth-lang-btn:focus-visible,
.ks-auth-type:focus-visible,
.ks-auth-input:focus-visible,
.ks-auth-toggle:focus-visible,
.ks-auth-submit:focus-visible,
.ks-auth-switch-btn:focus-visible {
  outline: 3px solid #86efac;
  outline-offset: 2px;
}
.ks-auth-input:focus {
  border-color: #16a34a;
}
@media (max-width: 380px) {
  .ks-auth-card { padding: 22px 16px; }
  .ks-auth-types { grid-template-columns: 1fr; }
  .ks-auth-type { min-height: 0; }
}
`;

// ---------------------------------------------------------------------------
// Small inline icons (no icon library needed)
// ---------------------------------------------------------------------------
function LeafIcon({ size }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z" />
      <path d="M2 21c0-3 1.9-5.4 5-6" />
    </svg>
  );
}

function BasketIcon({ size }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 11 4-7" />
      <path d="m19 11-4-7" />
      <path d="M2 11h20" />
      <path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4" />
    </svg>
  );
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Turns a Supabase auth error into one of our translatable message keys.
function getErrorKey(error, mode) {
  const code = error && error.code ? String(error.code) : "";
  const text = error && error.message ? String(error.message).toLowerCase() : "";

  if (code === "invalid_credentials" || text.includes("invalid login credentials")) {
    return "errInvalidCredentials";
  }
  if (code === "email_not_confirmed" || text.includes("email not confirmed")) {
    return "errEmailNotConfirmed";
  }
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    text.includes("already registered")
  ) {
    return "errAlreadyRegistered";
  }
  if (code === "weak_password" || text.includes("weak password")) {
    return "errWeakPassword";
  }
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    text.includes("rate limit")
  ) {
    return "errRateLimit";
  }
  if (text.includes("failed to fetch") || text.includes("network")) {
    return "errNetwork";
  }
  // Log the original error for developers; show a friendly message to users
  console.error("Supabase " + mode + " error:", error);
  return "errGeneric";
}

// ---------------------------------------------------------------------------
// Profile creation
//
// Creates the row in public.profiles for a user who has a valid session.
// - Uses INSERT ... ON CONFLICT DO NOTHING (upsert + ignoreDuplicates), so an
//   existing profile is never overwritten and no duplicate-key error occurs.
// - Needs only the INSERT policy (it does not read the table back).
// - The id always comes from the authenticated user, never hard-coded.
// ---------------------------------------------------------------------------
async function createProfileIfMissing({ userId, fullName, accountType }) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName,
      account_type: accountType,
      location: null,
    },
    { onConflict: "id", ignoreDuplicates: true }
  );

  // 23505 = unique violation: the profile already exists, which is fine
  if (error && error.code !== "23505") {
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Component
//
// Props (all optional, for the next steps):
//   onAuthSuccess({ mode, session, user, accountType }) is called after a
//   successful login, or a signup that returns a session immediately.
// ---------------------------------------------------------------------------
export default function Auth({ onAuthSuccess }) {
  const [language, setLanguage] = useState("en");
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [accountType, setAccountType] = useState("farmer");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // message = { type: "error" | "success", key: "<text key>" } or null.
  // Storing the key (not the text) lets the message follow the language.
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false); // blocks double submits immediately

  const t = (key) => {
    const dictionary = AUTH_TEXT[language] || AUTH_TEXT.en;
    return dictionary[key] || AUTH_TEXT.en[key] || key;
  };

  const isSignup = mode === "signup";

  const switchMode = (nextMode) => {
    if (loading) {
      return;
    }
    setMode(nextMode);
    setMessage(null);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  };

  // Returns an error key, or null when the form is valid
  const validate = () => {
    const trimmedEmail = email.trim();

    if (isSignup && !fullName.trim()) {
      return "errNameRequired";
    }
    if (!trimmedEmail) {
      return "errEmailRequired";
    }
    if (!isValidEmail(trimmedEmail)) {
      return "errEmailInvalid";
    }
    if (!password) {
      return "errPasswordRequired";
    }
    if (isSignup) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        return "errPasswordShort";
      }
      if (confirmPassword !== password) {
        return "errPasswordMismatch";
      }
      if (!ACCOUNT_TYPES.some((type) => type.value === accountType)) {
        return "errAccountType";
      }
    }
    return null;
  };

  const handleLogin = async (trimmedEmail) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password: password,
    });

    if (error) {
      setMessage({ type: "error", key: getErrorKey(error, "login") });
      return;
    }

    setPassword("");
    setMessage({ type: "success", key: "successLogin" });

    if (typeof onAuthSuccess === "function") {
      onAuthSuccess({
        mode: "login",
        session: data ? data.session : null,
        user: data ? data.user : null,
        accountType: accountType,
      });
    }
  };

  const handleSignup = async (trimmedEmail) => {
    const trimmedName = fullName.trim();

    // full_name and account_type are stored in the auth user's metadata.
    // If email confirmation is on, App.jsx reads them after the first login
    // to create the profile.
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password: password,
      options: {
        data: {
          full_name: trimmedName,
          account_type: accountType,
        },
      },
    });

    if (error) {
      setMessage({ type: "error", key: getErrorKey(error, "signup") });
      return;
    }

    // With email confirmation on, Supabase returns a fake user with no
    // identities when the email is already registered (no error is thrown).
    const user = data ? data.user : null;
    if (user && Array.isArray(user.identities) && user.identities.length === 0) {
      setMessage({ type: "error", key: "errAlreadyRegistered" });
      return;
    }

    setPassword("");
    setConfirmPassword("");

    if (data && data.session) {
      // Case 1: no email confirmation. The user is signed in, so create the
      // profile now, using the authenticated user's id.
      const sessionUser = data.session.user || user;
      if (sessionUser && sessionUser.id) {
        try {
          await createProfileIfMissing({
            userId: sessionUser.id,
            fullName: trimmedName,
            accountType: accountType,
          });
        } catch (profileError) {
          // The account exists. App.jsx will create the profile from the
          // user metadata if it is still missing, so do not block the user.
          console.error("Could not create profile at signup:", profileError);
        }
      }

      setMessage({ type: "success", key: "successSignupSession" });
      if (typeof onAuthSuccess === "function") {
        onAuthSuccess({
          mode: "signup",
          session: data.session,
          user: user,
          accountType: accountType,
        });
      }
    } else {
      // Case 2: email confirmation is on. There is no session yet, so the
      // profile cannot be created now. The metadata above is kept for later.
      setMessage({ type: "success", key: "successSignupConfirm" });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    const errorKey = validate();
    if (errorKey) {
      setMessage({ type: "error", key: errorKey });
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setMessage(null);

    try {
      const trimmedEmail = email.trim();
      if (isSignup) {
        await handleSignup(trimmedEmail);
      } else {
        await handleLogin(trimmedEmail);
      }
    } catch (unexpectedError) {
      console.error("Auth request failed:", unexpectedError);
      setMessage({ type: "error", key: getErrorKey(unexpectedError, mode) });
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const submitLabel = loading
    ? isSignup
      ? t("creatingAccount")
      : t("loggingIn")
    : isSignup
    ? t("signupButton")
    : t("loginButton");

  const passwordType = showPassword ? "text" : "password";

  return (
    <div className="ks-auth-page">
      <style>{AUTH_CSS}</style>

      <div className="ks-auth-card">
        <div className="ks-auth-lang" role="group" aria-label={t("languageLabel")}>
          <span className="ks-auth-lang-label">{t("languageLabel")}</span>
          {LANGUAGES.map((item) => (
            <button
              key={item.code}
              type="button"
              className="ks-auth-lang-btn"
              aria-pressed={language === item.code}
              onClick={() => setLanguage(item.code)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="ks-auth-brand">
          <img className="ks-brand-logo" src="/krishi-samparka-logo.jpeg" alt="Krishi Samparka farming logo" />
          <h1 className="ks-auth-brand-name">{t("brandName")}</h1>
          <p className="ks-auth-brand-local">{t("brandNameLocal")}</p>
          <p className="ks-auth-tagline">{t("tagline")}</p>
        </div>

        <span className="ks-auth-section-label" id="ks-auth-type-label">
          {t("accountTypeLabel")}
        </span>
        <div
          className="ks-auth-types"
          role="radiogroup"
          aria-labelledby="ks-auth-type-label"
        >
          {ACCOUNT_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              role="radio"
              className="ks-auth-type"
              aria-checked={accountType === type.value}
              disabled={loading}
              onClick={() => setAccountType(type.value)}
            >
              <span className="ks-auth-type-icon">
                {type.value === "farmer" ? (
                  <LeafIcon size={18} />
                ) : (
                  <BasketIcon size={18} />
                )}
              </span>
              <span className="ks-auth-type-title">{t(type.titleKey)}</span>
              <span className="ks-auth-type-desc">{t(type.descKey)}</span>
            </button>
          ))}
        </div>

        <h2 className="ks-auth-heading">
          {isSignup ? t("signupTitle") : t("loginTitle")}
        </h2>
        <p className="ks-auth-subheading">
          {isSignup ? t("signupSubtitle") : t("loginSubtitle")}
        </p>

        {message && (
          <p
            className={
              "ks-auth-message " +
              (message.type === "error"
                ? "ks-auth-message-error"
                : "ks-auth-message-success")
            }
            role={message.type === "error" ? "alert" : "status"}
          >
            {t(message.key)}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {isSignup && (
            <div className="ks-auth-field">
              <label className="ks-auth-label" htmlFor="ks-auth-name">
                {t("fullName")}
              </label>
              <input
                id="ks-auth-name"
                className="ks-auth-input"
                type="text"
                autoComplete="name"
                placeholder={t("fullNamePlaceholder")}
                value={fullName}
                disabled={loading}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
          )}

          <div className="ks-auth-field">
            <label className="ks-auth-label" htmlFor="ks-auth-email">
              {t("email")}
            </label>
            <input
              id="ks-auth-email"
              className="ks-auth-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              disabled={loading}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="ks-auth-field">
            <label className="ks-auth-label" htmlFor="ks-auth-password">
              {t("password")}
            </label>
            <div className="ks-auth-input-wrap">
              <input
                id="ks-auth-password"
                className="ks-auth-input ks-has-toggle"
                type={passwordType}
                autoComplete={isSignup ? "new-password" : "current-password"}
                placeholder={t("passwordPlaceholder")}
                value={password}
                disabled={loading}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="ks-auth-toggle"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? t("hidePassword") : t("showPassword")}
              </button>
            </div>
          </div>

          {isSignup && (
            <div className="ks-auth-field">
              <label className="ks-auth-label" htmlFor="ks-auth-confirm">
                {t("confirmPassword")}
              </label>
              <input
                id="ks-auth-confirm"
                className="ks-auth-input"
                type={passwordType}
                autoComplete="new-password"
                placeholder={t("confirmPasswordPlaceholder")}
                value={confirmPassword}
                disabled={loading}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          )}

          <button type="submit" className="ks-auth-submit" disabled={loading}>
            {submitLabel}
          </button>
        </form>

        <p className="ks-auth-switch">
          {isSignup ? t("haveAccount") : t("noAccount")}
          <button
            type="button"
            className="ks-auth-switch-btn"
            onClick={() => switchMode(isSignup ? "login" : "signup")}
            disabled={loading}
          >
            {isSignup ? t("switchToLogin") : t("switchToSignup")}
          </button>
        </p>
      </div>
    </div>
  );
}
