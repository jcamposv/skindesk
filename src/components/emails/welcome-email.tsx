import { APP_NAME } from "@/lib/constants";

interface WelcomeEmailProps {
  name: string;
  appUrl: string;
}

const containerStyle: React.CSSProperties = {
  backgroundColor: "#FAFAF7",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: 0,
  padding: "40px 16px",
  color: "#1a1a1a",
};

const cardStyle: React.CSSProperties = {
  maxWidth: 560,
  margin: "0 auto",
  background: "#ffffff",
  borderRadius: 12,
  border: "1px solid #E6E6E1",
  padding: 32,
};

const headingStyle: React.CSSProperties = {
  margin: "0 0 16px",
  color: "#5D6F68",
  fontSize: 24,
  fontWeight: 600,
};

const buttonStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: 16,
  padding: "12px 20px",
  background: "#5D6F68",
  color: "#ffffff",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 600,
};

/** Welcome email rendered to HTML by Resend's `react` prop. */
export function WelcomeEmail({ name, appUrl }: WelcomeEmailProps) {
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={headingStyle}>¡Bienvenido a {APP_NAME}, {name}!</h1>
        <p style={{ lineHeight: 1.6, margin: "0 0 12px" }}>
          Estamos felices de tenerte. {APP_NAME} combina tecnología y
          dermatología para ayudarte a entender tu piel y construir rutinas
          personalizadas.
        </p>
        <p style={{ lineHeight: 1.6, margin: "0 0 12px" }}>
          Empieza completando tu perfil de piel desde el dashboard.
        </p>
        <a href={appUrl} style={buttonStyle}>
          Ir al dashboard
        </a>
        <p style={{ marginTop: 24, fontSize: 12, color: "#8A8A82" }}>
          Si no creaste esta cuenta, ignora este mensaje.
        </p>
      </div>
    </div>
  );
}

export default WelcomeEmail;
