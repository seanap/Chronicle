import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#f38b1d"
    },
    background: {
      default: "#101317",
      paper: "#171b21"
    }
  },
  shape: {
    borderRadius: 10
  },
  typography: {
    fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif"
  }
});
