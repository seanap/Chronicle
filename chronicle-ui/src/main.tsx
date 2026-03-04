import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { AppShell } from "./components/app-shell";
import { AppRoutes } from "./app-routes";
import { appTheme } from "./theme/app-theme";
import { useAppReady } from "./hooks/use-app-ready";

function AppRoot() {
  const appReady = useAppReady();
  if (!appReady) {
    return null;
  }

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <BrowserRouter>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </BrowserRouter>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>
);
