import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { Link as RouterLink, useLocation } from "react-router-dom";
import type { PropsWithChildren } from "react";
import { APP_ROUTES } from "../config/routes";

const LINKS = APP_ROUTES.map((route) => ({
  path: route.path,
  label: route.label
}));

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const isActivePath = (path: string): boolean =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Chronicle SPA
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          {LINKS.map((item) => (
            <Button
              key={item.path}
              component={RouterLink}
              to={item.path}
              variant={isActivePath(item.path) ? "contained" : "outlined"}
              size="small"
              aria-current={isActivePath(item.path) ? "page" : undefined}
            >
              {item.label}
            </Button>
          ))}
        </Box>
      </Box>
      <Box>{children}</Box>
    </Container>
  );
}
