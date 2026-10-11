import { useEffect, useState } from "react";
import { supabase } from "./config/supabase";
import Auth from "./pages/Auth";
import FarmerDashboard from "./pages/FarmerDashboard";
import BuyerDashboard from "./pages/BuyerDashboard";
import { GoogleMarketMap } from "./components/Map/GoogleMarketMap";

const pageStyle = {
  maxWidth: "1100px",
  margin: "0 auto",
  padding: "24px 16px",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  textAlign: "left",
};

const headingStyle = {
  margin: 0,
  fontSize: "32px",
  lineHeight: 1.2,
};

const subtitleStyle = {
  margin: "4px 0 20px",
  fontSize: "16px",
  opacity: 0.75,
};

const mapContainerStyle = {
  width: "100%",
  height: "600px",
  border: "1px solid #cccccc",
  borderRadius: "8px",
  overflow: "hidden",
};

const loadingStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f4f9f4",
  color: "#4b5563",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  fontSize: "15px",
};

// Used only by the "profile problem" screen below
const messageBoxStyle = {
  maxWidth: "460px",
  padding: "24px",
  background: "#ffffff",
  border: "1px solid #e3ece3",
  borderRadius: "16px",
  textAlign: "center",
  lineHeight: 1.5,
};

const messageTitleStyle = {
  margin: "0 0 8px",
  fontSize: "18px",
  color: "#111827",
};

const messageTextStyle = {
  margin: "0 0 16px",
  fontSize: "14px",
  color: "#4b5563",
};

const messageButtonsStyle = {
  display: "flex",
  justifyContent: "center",
  gap: "10px",
  flexWrap: "wrap",
};

const primaryButtonStyle = {
  minHeight: "40px",
  padding: "0 18px",
  border: "none",
  borderRadius: "10px",
  background: "#14532d",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  minHeight: "40px",
  padding: "0 18px",
  border: "1px solid #cfdccf",
  borderRadius: "10px",
  background: "#ffffff",
  color: "#374151",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

// Market map screen.
function MapPage() {
  const [selectedRegionId, setSelectedRegionId] = useState(null);

  const handleRegionSelect = (region) => {
    if (region) {
      setSelectedRegionId(region.id);
    }
  };

  return (
    <div style={pageStyle}>
      <h1 style={headingStyle}>Krishi Samparka <span lang="kn">ಕೃಷಿ ಸಂಪರ್ಕ</span></h1>
      <p style={subtitleStyle}>Agricultural Market Intelligence</p>

      <div style={mapContainerStyle}>
        <GoogleMarketMap
          onRegionSelect={handleRegionSelect}
          selectedRegionId={selectedRegionId}
        />
      </div>
    </div>
  );
}

// Shown when a logged-in user's profile is missing, cannot be read, or has an
// account type we do not recognise. Always offers Logout so nobody gets stuck.
function ProfileProblem({ title, message, onRetry, onLogout }) {
  return (
    <div style={loadingStyle}>
      <div style={messageBoxStyle} role="alert">
        <h1 style={messageTitleStyle}>{title}</h1>
        <p style={messageTextStyle}>{message}</p>
        <div style={messageButtonsStyle}>
          {onRetry && (
            <button type="button" style={primaryButtonStyle} onClick={onRetry}>
              Try again
            </button>
          )}
          <button type="button" style={secondaryButtonStyle} onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  // session = the Supabase session object, or null when logged out
  const [session, setSession] = useState(null);
  // true until we know whether a saved session exists (avoids a login flash)
  const [checkingSession, setCheckingSession] = useState(true);

  // profiles.account_type of the logged-in user ("farmer" or "buyer")
  const [accountType, setAccountType] = useState(null);
  // idle | loading | ready | missing | error
  const [profileStatus, setProfileStatus] = useState("idle");
  const [profileError, setProfileError] = useState("");
  // Bumped by the "Try again" button to reload the profile
  const [profileAttempt, setProfileAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // 1. On start (and refresh), ask Supabase for the saved session
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) {
          return;
        }
        if (error) {
          console.error("Could not read Supabase session:", error);
        }
        setSession(data ? data.session : null);
      })
      .catch((error) => {
        console.error("Could not read Supabase session:", error);
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingSession(false);
        }
      });

    // 2. Listen for login, logout and token refresh
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setCheckingSession(false);
      }
    );

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Only the user's id matters here. Token refreshes create a new session
  // object but keep the same id, so they do not reload the profile.
  const userId = session && session.user ? session.user.id : null;

  // 3. Once a user is logged in, read their account type from public.profiles.
  //    If no profile exists yet, create it from the signup metadata.
  useEffect(() => {
    if (!userId) {
      setAccountType(null);
      setProfileStatus("idle");
      setProfileError("");
      return undefined;
    }

    let cancelled = false;
    setAccountType(null);
    setProfileStatus("loading");
    setProfileError("");

    async function loadProfile() {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("account_type")
          .eq("id", userId)
          .maybeSingle();

        if (cancelled) {
          return;
        }
        if (error) {
          throw error;
        }

        let profile = data;

        if (!profile) {
          // No profile yet (for example the user just confirmed their email
          // and logged in for the first time). Create it from the metadata
          // that Auth.jsx saved during signup.
          const meta =
            (session && session.user && session.user.user_metadata) || {};
          const metaType = String(meta.account_type || "").trim().toLowerCase();
          const metaName = String(meta.full_name || "").trim();

          if ((metaType === "farmer" || metaType === "buyer") && metaName) {
            const { error: createError } = await supabase
              .from("profiles")
              .upsert(
                {
                  id: userId,
                  full_name: metaName,
                  account_type: metaType,
                  location: null,
                },
                { onConflict: "id", ignoreDuplicates: true }
              );

            if (cancelled) {
              return;
            }
            // 23505 = profile already exists, which is fine
            if (createError && createError.code !== "23505") {
              throw createError;
            }

            // Read it back so the dashboard uses what is really stored
            const retry = await supabase
              .from("profiles")
              .select("account_type")
              .eq("id", userId)
              .maybeSingle();

            if (cancelled) {
              return;
            }
            if (retry.error) {
              throw retry.error;
            }
            profile = retry.data;
          }
        }

        if (!profile) {
          setProfileStatus("missing");
          return;
        }

        setAccountType(String(profile.account_type || "").trim().toLowerCase());
        setProfileStatus("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error("Could not load profile:", error);
        setProfileError(error && error.message ? error.message : "Unknown error");
        setProfileStatus("error");
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [userId, profileAttempt]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      // The session listener above sets session to null and shows <Auth />.
    } catch (error) {
      console.error("Could not log out:", error);
    }
  };

  const handleRetry = () => {
    setProfileAttempt((count) => count + 1);
  };

  if (checkingSession) {
    return <div style={loadingStyle}>Loading...</div>;
  }

  if (!session) {
    return <Auth />;
  }

  // Logged in, but the profile has not been read yet
  if (profileStatus === "idle" || profileStatus === "loading") {
    return <div style={loadingStyle}>Loading your account...</div>;
  }

  if (profileStatus === "error") {
    return (
      <ProfileProblem
        title="Could not load your profile"
        message={"Something went wrong while loading your account: " + profileError}
        onRetry={handleRetry}
        onLogout={handleLogout}
      />
    );
  }

  if (profileStatus === "missing") {
    return (
      <ProfileProblem
        title="Profile not found"
        message="We could not find a profile for your account. If you just signed up, wait a moment and try again."
        onRetry={handleRetry}
        onLogout={handleLogout}
      />
    );
  }

  if (accountType === "farmer") {
    return <FarmerDashboard />;
  }

  if (accountType === "buyer") {
    return <BuyerDashboard />;
  }

  return (
    <ProfileProblem
      title="Unknown account type"
      message={
        accountType
          ? 'Your account type "' + accountType + '" is not recognised. Please log out and contact support.'
          : "Your account has no account type set. Please log out and contact support."
      }
      onRetry={handleRetry}
      onLogout={handleLogout}
    />
  );
}

export default App;
